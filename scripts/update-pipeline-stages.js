#!/usr/bin/env node

/**
 * Updates pipeline stage labels on IranENovin discussions based on reaction counts.
 * Runs every 2 hours via GitHub Actions.
 *
 * Run with:
 *   GITHUB_TOKEN=xxx GITHUB_ORG=IranENovin GITHUB_REPO=ideas node scripts/update-pipeline-stages.js
 */

const TOKEN = process.env.GITHUB_TOKEN
const ORG = process.env.GITHUB_ORG || 'IranENovin'
const REPO = process.env.GITHUB_REPO || 'ideas'

if (!TOKEN) {
  console.error('GITHUB_TOKEN is required')
  process.exit(1)
}

const STAGE_ORDER = ['submitted', 'gaining', 'validated', 'team-forming', 'active-project', 'launched']

function getStageIndex(stage) {
  return STAGE_ORDER.indexOf(stage)
}

async function graphql(query, variables = {}) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (json.errors) throw new Error(JSON.stringify(json.errors))
  return json.data
}

async function rest(method, url, body) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
    },
  }
  if (body) opts.body = JSON.stringify(body)
  return fetch(`https://api.github.com${url}`, opts)
}

async function main() {
  console.log('Fetching discussions...')

  let cursor = null
  let hasNextPage = true
  let updated = 0

  while (hasNextPage) {
    const data = await graphql(
      `query($owner: String!, $repo: String!, $cursor: String) {
        repository(owner: $owner, name: $repo) {
          discussions(first: 50, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes {
              number
              title
              labels(first: 10) { nodes { name } }
              reactions(content: THUMBS_UP) { totalCount }
            }
          }
        }
      }`,
      { owner: ORG, repo: REPO, cursor }
    )

    const { nodes, pageInfo } = data.repository.discussions
    hasNextPage = pageInfo.hasNextPage
    cursor = pageInfo.endCursor

    for (const disc of nodes) {
      const votes = disc.reactions.totalCount
      const currentLabels = disc.labels.nodes.map(l => l.name)
      const currentStage = currentLabels.find(l => l.startsWith('stage:'))
      const currentStageName = currentStage ? currentStage.replace('stage:', '') : null

      // Check for help offers
      const helpRes = await rest(
        'GET',
        `/search/issues?q=repo:${ORG}/${REPO}+label:help-offer+"${disc.title.replace(/"/g, '')}"&per_page=1`
      )
      const helpData = await helpRes.json()
      const hasHelpOffers = (helpData.total_count || 0) > 0

      // Determine new stage
      let newStage = 'submitted'
      if (votes >= 20) newStage = 'validated'
      else if (votes >= 5) newStage = 'gaining'
      if (hasHelpOffers && getStageIndex('team-forming') > getStageIndex(newStage)) {
        newStage = 'team-forming'
      }

      // Never downgrade
      if (currentStageName && getStageIndex(currentStageName) >= getStageIndex(newStage)) {
        continue
      }

      // Update labels
      if (currentStage) {
        await rest('DELETE', `/repos/${ORG}/${REPO}/labels/${encodeURIComponent(currentStage)}`)
          .catch(() => {}) // label may not exist yet
      }

      // Ensure label exists
      await rest('POST', `/repos/${ORG}/${REPO}/labels`, {
        name: `stage:${newStage}`,
        color: newStage === 'validated' ? '2da44e' : newStage === 'gaining' ? 'dbab09' : '0969da',
      }).catch(() => {}) // may already exist

      await rest('POST', `/repos/${ORG}/${REPO}/issues/${disc.number}/labels`, {
        labels: [`stage:${newStage}`],
      })

      console.log(`  #${disc.number} "${disc.title}": ${currentStageName || 'none'} → ${newStage}`)
      updated++

      await new Promise(r => setTimeout(r, 300))
    }

    if (hasNextPage) await new Promise(r => setTimeout(r, 500))
  }

  console.log(`Done. Updated ${updated} discussions.`)
}

main().catch(err => {
  console.error('Failed:', err.message)
  process.exit(1)
})
