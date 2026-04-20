#!/usr/bin/env node

/**
 * One-time script: Graduate top 10 IAB ideas into IranENovin discussions.
 *
 * Run with:
 *   GITHUB_BOT_TOKEN=xxx GITHUB_ORG=IranENovin GITHUB_IDEAS_REPO=ideas \
 *   GITHUB_IDEAS_CATEGORY_ID=xxx node scripts/initial-graduate-top-ideas.js
 */

const fs = require('fs')
const path = require('path')

const TOKEN = process.env.GITHUB_BOT_TOKEN
const ORG = process.env.GITHUB_ORG || 'IranENovin'
const REPO = process.env.GITHUB_IDEAS_REPO || 'ideas'
const CATEGORY_ID = process.env.GITHUB_IDEAS_CATEGORY_ID

if (!TOKEN || !CATEGORY_ID) {
  console.error('Missing GITHUB_BOT_TOKEN or GITHUB_IDEAS_CATEGORY_ID')
  process.exit(1)
}

const CACHE_PATH = path.join(__dirname, '../_data/iranazadabad-cache.json')
const LOG_PATH = path.join(__dirname, '../_data/initial-graduation-log.json')

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

function buildAttributionBody(idea) {
  const date = new Date(idea.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return `> 🤝 **Originally posted on [IranAzadAbad](https://github.com/IranAzadAbad/ideas)
> by [@${idea.author.login}](https://github.com/${idea.author.login}) on ${date}.**
> **[View original →](${idea.sourceUrl})**
>
> IranENovin community is taking this idea forward.

<!-- source:iranazadabad:${idea.nativeId} -->

---

## Original idea

${idea.body}
`
}

async function main() {
  if (!fs.existsSync(CACHE_PATH)) {
    console.error('Cache file not found. Run sync-iranazadabad.js first.')
    process.exit(1)
  }

  const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
  const top10 = cache.ideas
    .sort((a, b) => b.voteCount - a.voteCount)
    .slice(0, 10)

  console.log(`Graduating top ${top10.length} ideas...`)

  // Get repo ID
  const repoData = await graphql(
    `query($owner: String!, $repo: String!) { repository(owner: $owner, name: $repo) { id } }`,
    { owner: ORG, repo: REPO }
  )
  const repoId = repoData.repository.id

  const log = []

  for (const idea of top10) {
    console.log(`  ${idea.nativeId}: ${idea.title} (${idea.voteCount} votes)`)
    try {
      const body = buildAttributionBody(idea)
      const result = await graphql(
        `mutation($repoId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
          createDiscussion(input: { repositoryId: $repoId, categoryId: $categoryId, title: $title, body: $body }) {
            discussion { number url }
          }
        }`,
        { repoId, categoryId: CATEGORY_ID, title: idea.title, body }
      )
      const disc = result.createDiscussion.discussion
      console.log(`    → Created discussion #${disc.number}: ${disc.url}`)

      // Add stage:validated label via REST
      await fetch(
        `https://api.github.com/repos/${ORG}/${REPO}/issues/${disc.number}/labels`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ labels: ['stage:validated'] }),
        }
      )

      log.push({
        nativeId: idea.nativeId,
        title: idea.title,
        voteCount: idea.voteCount,
        discussionNumber: disc.number,
        discussionUrl: disc.url,
      })

      await new Promise(r => setTimeout(r, 1000))
    } catch (err) {
      console.error(`    Failed: ${err.message}`)
    }
  }

  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2))
  console.log(`\nDone. Log written to ${LOG_PATH}`)
}

main().catch(err => {
  console.error('Failed:', err)
  process.exit(1)
})
