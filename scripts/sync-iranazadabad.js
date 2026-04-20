const fs = require('fs')
const path = require('path')

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const OUTPUT_PATH = path.join(__dirname, '../_data/iranazadabad-cache.json')

// ─── GraphQL: fetch discussions ordered by updatedAt ─────────────────────────

const GRAPHQL_QUERY = `
  query GetDiscussions($cursor: String) {
    repository(owner: "IranAzadAbad", name: "ideas") {
      discussions(
        first: 100
        after: $cursor
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        pageInfo { hasNextPage endCursor }
        nodes {
          number
          title
          body
          createdAt
          updatedAt
          url
          upvoteCount
          author { login avatarUrl }
          category { name emoji }
          labels(first: 10) { nodes { name color } }
          comments { totalCount }
          reactions(content: THUMBS_UP) { totalCount }
        }
      }
    }
  }
`

async function graphql(query, variables = {}) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${await res.text()}`)
  const json = await res.json()
  if (json.errors) {
    const msg = json.errors[0]?.message || JSON.stringify(json.errors)
    if (msg.includes('rate limit') || msg.includes('API rate limit')) {
      console.warn('Rate limited — will retry next run.')
      return null
    }
    throw new Error(`GraphQL error: ${msg}`)
  }
  return json.data
}

function stripMarkdown(text = '') {
  return text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/>\s/g, '')
    .replace(/\n+/g, ' ')
    .trim()
}

function inferStage(voteCount) {
  if (voteCount >= 20) return 'validated'
  if (voteCount >= 5) return 'gaining'
  return 'submitted'
}

function transformNode(node) {
  const votes = node.reactions?.totalCount ?? node.upvoteCount ?? 0
  return {
    id: `iae-${node.number}`,
    nativeId: node.number,
    title: node.title,
    body: node.body,
    bodyPreview: stripMarkdown(node.body).slice(0, 200),
    category: node.category?.name ?? 'General',
    categoryEmoji: node.category?.emoji ?? '💬',
    source: 'iranazadabad',
    sourceUrl: node.url,
    author: {
      login: node.author?.login ?? 'ghost',
      avatarUrl: node.author?.avatarUrl ?? '',
      profileUrl: `https://github.com/${node.author?.login ?? 'ghost'}`,
    },
    voteCount: votes,
    commentCount: node.comments?.totalCount ?? 0,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    labels: node.labels?.nodes ?? [],
    stage: inferStage(votes),
    helpOffersCount: 0,
    graduatedTo: null,
  }
}

// ─── Load existing cache ───────────────────────────────────────────────────────

function loadCache() {
  if (!fs.existsSync(OUTPUT_PATH)) {
    return { fetchedAt: null, lastIncrementalAt: null, totalCount: 0, ideas: [] }
  }
  try {
    return JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'))
  } catch {
    return { fetchedAt: null, lastIncrementalAt: null, totalCount: 0, ideas: [] }
  }
}

// ─── Incremental sync ────────────────────────────────────────────────────────

async function incrementalSync(sinceISO) {
  const updated = []
  let cursor = null
  let hasNextPage = true
  let hitOldContent = false

  while (hasNextPage && !hitOldContent) {
    const data = await graphql(GRAPHQL_QUERY, { cursor })
    if (!data) return null // rate limited

    const { nodes, pageInfo } = data.repository.discussions

    for (const node of nodes) {
      if (node.updatedAt <= sinceISO) {
        hitOldContent = true
        break
      }
      updated.push(transformNode(node))
    }

    hasNextPage = pageInfo.hasNextPage && !hitOldContent
    cursor = pageInfo.endCursor
    if (hasNextPage) await new Promise(r => setTimeout(r, 300))
  }

  return updated
}

// ─── Full sync ───────────────────────────────────────────────────────────────

async function fullSync() {
  const all = []
  let cursor = null
  let hasNextPage = true
  let page = 1

  while (hasNextPage) {
    console.log(`  Full sync page ${page}...`)
    const data = await graphql(GRAPHQL_QUERY, { cursor })
    if (!data) {
      console.warn('Rate limited during full sync — saving partial results.')
      break
    }
    const { nodes, pageInfo } = data.repository.discussions
    all.push(...nodes.map(transformNode))
    hasNextPage = pageInfo.hasNextPage
    cursor = pageInfo.endCursor
    page++
    if (hasNextPage) await new Promise(r => setTimeout(r, 500))
  }

  return all
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date().toISOString()
  const cache = loadCache()

  const dir = path.dirname(OUTPUT_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  let ideas

  if (!cache.lastIncrementalAt || cache.ideas.length === 0) {
    console.log('No existing cache — running full sync...')
    ideas = await fullSync()
    console.log(`Full sync complete: ${ideas.length} ideas fetched.`)
  } else {
    console.log(`Incremental sync since ${cache.lastIncrementalAt}...`)
    const updated = await incrementalSync(cache.lastIncrementalAt)

    if (updated === null) {
      console.warn('Rate limited — keeping existing cache unchanged.')
      process.exit(0)
    }

    if (updated.length === 0) {
      console.log('No changes since last sync.')
      cache.lastIncrementalAt = now
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(cache, null, 2))
      process.exit(0)
    }

    console.log(`${updated.length} discussions updated since last sync.`)

    const existingMap = new Map(cache.ideas.map(i => [i.nativeId, i]))
    for (const updatedIdea of updated) {
      existingMap.set(updatedIdea.nativeId, updatedIdea)
    }

    ideas = Array.from(existingMap.values())
    ideas.sort((a, b) => b.voteCount - a.voteCount)
    console.log(`Cache now contains ${ideas.length} total ideas.`)
  }

  const newCache = {
    fetchedAt: now,
    lastIncrementalAt: now,
    totalCount: ideas.length,
    ideas,
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(newCache, null, 2))
  console.log(`Cache written to ${OUTPUT_PATH}`)

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, 'CACHE_UPDATED=true\n')
  }
}

main().catch(err => {
  console.error('Sync error:', err.message)
  process.exit(1)
})
