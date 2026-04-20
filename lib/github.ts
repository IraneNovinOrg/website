import { Octokit } from "@octokit/rest";
import { graphql } from "@octokit/graphql";
import {
  GITHUB_ORG,
  GITHUB_IDEAS_REPO,
  GITHUB_BOT_TOKEN,
} from "./constants";
import type { Idea, IdeaDetail, Comment, Project, Member } from "@/types";

function getOctokit(token?: string) {
  return new Octokit({ auth: token || GITHUB_BOT_TOKEN });
}

function getGraphql(token?: string) {
  return graphql.defaults({
    headers: { authorization: `token ${token || GITHUB_BOT_TOKEN}` },
  });
}

function parseStatus(labels: string[]): Idea["status"] {
  if (labels.includes("project-created")) return "project-created";
  if (labels.includes("in-progress")) return "in-progress";
  if (labels.includes("closed")) return "closed";
  return "open";
}

interface DiscussionNode {
  number: number;
  title: string;
  body: string;
  createdAt: string;
  url: string;
  author: { login: string; avatarUrl: string } | null;
  category: { name: string };
  labels: { nodes: { name: string }[] };
  reactions: { totalCount: number };
  comments: { totalCount: number };
}

export async function getIdeas(
  category?: string,
  sort?: "top" | "new" | "trending",
  page = 1,
  limit = 20
): Promise<{ ideas: Idea[]; total: number; hasMore: boolean }> {
  try {
    const gql = getGraphql();
    const result = await gql<{
      repository: {
        discussions: {
          totalCount: number;
          nodes: DiscussionNode[];
        };
      };
    }>(
      `query($owner: String!, $repo: String!, $first: Int!, $orderBy: DiscussionOrderField!) {
        repository(owner: $owner, name: $repo) {
          discussions(first: $first, orderBy: {field: $orderBy, direction: DESC}) {
            totalCount
            nodes {
              number
              title
              body
              createdAt
              url
              author { login avatarUrl }
              category { name }
              labels(first: 10) { nodes { name } }
              reactions(content: THUMBS_UP) { totalCount }
              comments { totalCount }
            }
          }
        }
      }`,
      {
        owner: GITHUB_ORG,
        repo: GITHUB_IDEAS_REPO,
        first: Math.min(limit * page, 100),
        orderBy: sort === "new" ? "CREATED_AT" : "CREATED_AT",
      }
    );

    let ideas: Idea[] = result.repository.discussions.nodes.map(
      (d) => ({
        id: d.number,
        title: d.title,
        body: d.body,
        category: d.category.name,
        author: d.author
          ? { login: d.author.login, avatarUrl: d.author.avatarUrl }
          : { login: "anonymous", avatarUrl: "" },
        voteCount: d.reactions.totalCount,
        commentCount: d.comments.totalCount,
        createdAt: d.createdAt,
        labels: d.labels.nodes.map((l) => l.name),
        status: parseStatus(d.labels.nodes.map((l) => l.name)),
        url: d.url,
      })
    );

    if (category && category !== "all") {
      ideas = ideas.filter(
        (i) => i.category.toLowerCase() === category.toLowerCase()
      );
    }

    if (sort === "top") {
      ideas.sort((a, b) => b.voteCount - a.voteCount);
    } else if (sort === "trending") {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      ideas = ideas.filter(
        (i) => new Date(i.createdAt).getTime() > weekAgo
      );
      ideas.sort((a, b) => b.voteCount - a.voteCount);
    }

    const startIdx = (page - 1) * limit;
    const paged = ideas.slice(startIdx, startIdx + limit);

    return {
      ideas: paged,
      total: result.repository.discussions.totalCount,
      hasMore: startIdx + limit < ideas.length,
    };
  } catch (e) {
    console.error("Failed to fetch ideas:", e);
    return { ideas: [], total: 0, hasMore: false };
  }
}

export async function getIdea(discussionNumber: number): Promise<IdeaDetail | null> {
  try {
    const gql = getGraphql();
    const result = await gql<{
      repository: {
        discussion: DiscussionNode & {
          comments: {
            totalCount: number;
            nodes: {
              id: string;
              body: string;
              createdAt: string;
              author: { login: string; avatarUrl: string } | null;
            }[];
          };
        };
      };
    }>(
      `query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          discussion(number: $number) {
            number
            title
            body
            createdAt
            url
            author { login avatarUrl }
            category { name }
            labels(first: 10) { nodes { name } }
            reactions(content: THUMBS_UP) { totalCount }
            comments(first: 100) {
              totalCount
              nodes {
                id
                body
                createdAt
                author { login avatarUrl }
              }
            }
          }
        }
      }`,
      {
        owner: GITHUB_ORG,
        repo: GITHUB_IDEAS_REPO,
        number: discussionNumber,
      }
    );

    const d = result.repository.discussion;
    if (!d) return null;

    return {
      id: d.number,
      title: d.title,
      body: d.body,
      category: d.category.name,
      author: d.author
        ? { login: d.author.login, avatarUrl: d.author.avatarUrl }
        : { login: "anonymous", avatarUrl: "" },
      voteCount: d.reactions.totalCount,
      commentCount: d.comments.totalCount,
      createdAt: d.createdAt,
      labels: d.labels.nodes.map((l) => l.name),
      status: parseStatus(d.labels.nodes.map((l) => l.name)),
      url: d.url,
      comments: d.comments.nodes.map((c, idx) => ({
        id: idx,
        body: c.body,
        author: c.author
          ? { login: c.author.login, avatarUrl: c.author.avatarUrl }
          : { login: "anonymous", avatarUrl: "" },
        createdAt: c.createdAt,
      })),
    };
  } catch (e) {
    console.error("Failed to fetch idea:", e);
    return null;
  }
}

export async function createIdea(
  title: string,
  body: string,
  categoryId: string,
  authorToken?: string
): Promise<Idea | null> {
  try {
    const gql = getGraphql(authorToken);

    // First get the repository ID
    const repoResult = await gql<{
      repository: { id: string };
    }>(
      `query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) { id }
      }`,
      { owner: GITHUB_ORG, repo: GITHUB_IDEAS_REPO }
    );

    const result = await gql<{
      createDiscussion: {
        discussion: {
          number: number;
          title: string;
          body: string;
          createdAt: string;
          url: string;
          author: { login: string; avatarUrl: string };
          category: { name: string };
        };
      };
    }>(
      `mutation($repoId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
        createDiscussion(input: {
          repositoryId: $repoId,
          categoryId: $categoryId,
          title: $title,
          body: $body
        }) {
          discussion {
            number title body createdAt url
            author { login avatarUrl }
            category { name }
          }
        }
      }`,
      {
        repoId: repoResult.repository.id,
        categoryId,
        title,
        body,
      }
    );

    const d = result.createDiscussion.discussion;
    return {
      id: d.number,
      title: d.title,
      body: d.body,
      category: d.category.name,
      author: { login: d.author.login, avatarUrl: d.author.avatarUrl },
      voteCount: 0,
      commentCount: 0,
      createdAt: d.createdAt,
      labels: [],
      status: "open",
      url: d.url,
    };
  } catch (e) {
    console.error("Failed to create idea:", e);
    return null;
  }
}

export async function upvoteIdea(
  discussionNumber: number,
  userToken?: string
): Promise<number> {
  try {
    const gql = getGraphql(userToken);

    // Get discussion node ID
    const result = await gql<{
      repository: { discussion: { id: string; reactions: { totalCount: number } } };
    }>(
      `query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          discussion(number: $number) {
            id
            reactions(content: THUMBS_UP) { totalCount }
          }
        }
      }`,
      { owner: GITHUB_ORG, repo: GITHUB_IDEAS_REPO, number: discussionNumber }
    );

    const nodeId = result.repository.discussion.id;

    await gql(
      `mutation($subjectId: ID!) {
        addReaction(input: { subjectId: $subjectId, content: THUMBS_UP }) {
          reaction { content }
        }
      }`,
      { subjectId: nodeId }
    );

    return result.repository.discussion.reactions.totalCount + 1;
  } catch (e) {
    console.error("Failed to upvote:", e);
    return 0;
  }
}

export async function addComment(
  discussionNumber: number,
  body: string,
  authorToken?: string,
  anonymousName?: string
): Promise<Comment | null> {
  try {
    const gql = getGraphql(authorToken);

    // Get discussion node ID
    const result = await gql<{
      repository: { discussion: { id: string } };
    }>(
      `query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          discussion(number: $number) { id }
        }
      }`,
      { owner: GITHUB_ORG, repo: GITHUB_IDEAS_REPO, number: discussionNumber }
    );

    const commentBody = !authorToken
      ? anonymousName
        ? `**[${anonymousName}]:** ${body}`
        : `**[Anonymous]:** ${body}`
      : body;

    const commentResult = await gql<{
      addDiscussionComment: {
        comment: {
          id: string;
          body: string;
          createdAt: string;
          author: { login: string; avatarUrl: string };
        };
      };
    }>(
      `mutation($discussionId: ID!, $body: String!) {
        addDiscussionComment(input: { discussionId: $discussionId, body: $body }) {
          comment {
            id body createdAt
            author { login avatarUrl }
          }
        }
      }`,
      { discussionId: result.repository.discussion.id, body: commentBody }
    );

    const c = commentResult.addDiscussionComment.comment;
    return {
      id: 0,
      body: c.body,
      author: { login: c.author.login, avatarUrl: c.author.avatarUrl },
      createdAt: c.createdAt,
    };
  } catch (e) {
    console.error("Failed to add comment:", e);
    return null;
  }
}

export async function getProjects(): Promise<Project[]> {
  try {
    const octokit = getOctokit();
    const { data: repos } = await octokit.repos.listForOrg({
      org: GITHUB_ORG,
      type: "public",
      sort: "updated",
      per_page: 100,
    });

    const excluded = [GITHUB_IDEAS_REPO, ".github"];
    const projects: Project[] = [];

    for (const repo of repos) {
      if (excluded.includes(repo.name)) continue;

      let contributors: { login: string; avatarUrl: string }[] = [];
      try {
        const { data } = await octokit.repos.listContributors({
          owner: GITHUB_ORG,
          repo: repo.name,
          per_page: 10,
        });
        contributors = data
          .filter((c): c is typeof c & { login: string } => !!c.login)
          .map((c) => ({
            login: c.login!,
            avatarUrl: c.avatar_url || "",
          }));
      } catch {
        // ignore
      }

      const topics = repo.topics || [];
      const description = repo.description || "";

      // Parse lookingFor from description tags like [needs: designer]
      const lookingForMatches = description.match(
        /\[needs:\s*([^\]]+)\]/gi
      );
      const lookingFor = lookingForMatches
        ? lookingForMatches.map((m) =>
            m.replace(/\[needs:\s*/i, "").replace("]", "").trim()
          )
        : [];

      // Parse status from topics
      let status: Project["status"] = "planning";
      if (topics.includes("launched")) status = "launched";
      else if (topics.includes("building")) status = "building";

      // Parse source idea ID from description
      const ideaMatch = description.match(/idea-(\d+)/);
      const sourceIdeaId = ideaMatch ? parseInt(ideaMatch[1]) : undefined;

      const isCodeProject = !topics.includes("non-code");

      projects.push({
        id: repo.id,
        slug: repo.name,
        title: repo.name
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        description: description
          .replace(/\[needs:[^\]]+\]/gi, "")
          .replace(/idea-\d+/g, "")
          .trim(),
        status,
        techTags: topics.filter(
          (t) => !["launched", "building", "planning", "non-code"].includes(t)
        ),
        lookingFor,
        contributorCount: contributors.length,
        contributors: contributors.slice(0, 5),
        sourceIdeaId,
        repoUrl: repo.html_url,
        externalUrl: repo.homepage || undefined,
        isCodeProject,
        createdAt: repo.created_at || new Date().toISOString(),
      });
    }

    return projects;
  } catch (e) {
    console.error("Failed to fetch projects:", e);
    return [];
  }
}

export async function getProject(slug: string): Promise<Project | null> {
  const projects = await getProjects();
  return projects.find((p) => p.slug === slug) || null;
}

export async function getOrgMembers(): Promise<Member[]> {
  try {
    const octokit = getOctokit();
    const { data: members } = await octokit.orgs.listMembers({
      org: GITHUB_ORG,
      per_page: 100,
    });

    const result: Member[] = [];

    for (const m of members) {
      let userData = {
        name: m.login,
        bio: "",
        created_at: new Date().toISOString(),
      };
      try {
        const { data } = await octokit.users.getByUsername({
          username: m.login,
        });
        userData = {
          name: data.name || data.login,
          bio: data.bio || "",
          created_at: data.created_at,
        };
      } catch {
        // ignore
      }

      const skills = userData.bio
        ? userData.bio
            .split(/[,|·]/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 5)
        : [];

      result.push({
        login: m.login,
        name: userData.name,
        avatarUrl: m.avatar_url,
        role: "member",
        skills,
        joinedAt: userData.created_at,
        bio: userData.bio,
      });
    }

    return result;
  } catch (e) {
    console.error("Failed to fetch members:", e);
    return [];
  }
}

export async function addOrgMember(
  githubUsername: string
): Promise<boolean> {
  try {
    const octokit = getOctokit();
    await octokit.orgs.setMembershipForUser({
      org: GITHUB_ORG,
      username: githubUsername,
      role: "member",
    });
    return true;
  } catch (e) {
    console.error("Failed to add org member:", e);
    return false;
  }
}

export async function createAnonymousSuggestion(
  title: string,
  body: string,
  email?: string
): Promise<boolean> {
  try {
    const octokit = getOctokit();
    const issueBody = email
      ? `${body}\n\n---\n*Submitted anonymously. Contact: ${email}*`
      : `${body}\n\n---\n*Submitted anonymously.*`;

    await octokit.issues.create({
      owner: GITHUB_ORG,
      repo: GITHUB_IDEAS_REPO,
      title: `[Suggestion] ${title}`,
      body: issueBody,
      labels: ["anonymous-suggestion"],
    });
    return true;
  } catch (e) {
    console.error("Failed to create anonymous suggestion:", e);
    return false;
  }
}

export async function getStats(): Promise<{
  ideasCount: number;
  projectsCount: number;
  membersCount: number;
}> {
  try {
    const [ideas, projects, members] = await Promise.all([
      getIdeas(undefined, "new", 1, 1),
      getProjects(),
      getOrgMembers(),
    ]);
    return {
      ideasCount: ideas.total,
      projectsCount: projects.length,
      membersCount: members.length,
    };
  } catch {
    return { ideasCount: 0, projectsCount: 0, membersCount: 0 };
  }
}
