#!/usr/bin/env node

/**
 * Run with:
 *   GITHUB_BOT_TOKEN=xxx GITHUB_ORG=IranENovin GITHUB_IDEAS_REPO=ideas node scripts/get-category-ids.js
 *
 * Lists all GitHub Discussion categories and their IDs for easy .env copy-paste.
 */

const token = process.env.GITHUB_BOT_TOKEN;
const org = process.env.GITHUB_ORG || "IranENovin";
const repo = process.env.GITHUB_IDEAS_REPO || "ideas";

if (!token) {
  console.error("Error: GITHUB_BOT_TOKEN environment variable is required");
  process.exit(1);
}

async function main() {
  const query = `
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        discussionCategories(first: 25) {
          nodes {
            id
            name
            emoji
            description
          }
        }
      }
    }
  `;

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { owner: org, repo } }),
  });

  const data = await response.json();

  if (data.errors) {
    console.error("GraphQL errors:", JSON.stringify(data.errors, null, 2));
    process.exit(1);
  }

  const categories = data.data.repository.discussionCategories.nodes;

  console.log("\n=== Discussion Category IDs ===\n");
  console.log("Copy the appropriate ID to your .env.local file:\n");

  for (const cat of categories) {
    console.log(`${cat.emoji || "  "} ${cat.name}`);
    console.log(`   GITHUB_IDEAS_CATEGORY_ID=${cat.id}`);
    console.log(`   Description: ${cat.description || "N/A"}\n`);
  }

  console.log("=== Done ===\n");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
