import fs from "fs";
import path from "path";
import { GITHUB_ORG, GITHUB_BOT_TOKEN } from "./constants";

const TEAMS_FILE = path.join(process.cwd(), "_data", "teams.json");

export interface TeamRole {
  title: string;
  filled: boolean;
  userId: string | null;
  userName: string | null;
}

export interface TeamApplicant {
  userId: string;
  userName: string;
  role: string;
  message: string;
  skills: string[];
  appliedAt: string;
}

export interface Team {
  id: string;
  ideaId: string;
  ideaTitle: string;
  projectSlug: string | null;
  name: string;
  leadUserId: string;
  leadName: string;
  status: "forming" | "active" | "archived";
  roles: TeamRole[];
  applicants: TeamApplicant[];
  githubTeamSlug: string | null;
  repoUrl: string | null;
  createdAt: string;
}

function ensureDir() {
  const dir = path.dirname(TEAMS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readTeams(): Team[] {
  ensureDir();
  if (!fs.existsSync(TEAMS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(TEAMS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeTeams(teams: Team[]) {
  ensureDir();
  fs.writeFileSync(TEAMS_FILE, JSON.stringify(teams, null, 2));
}

function genId(): string {
  return "team-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

export async function createTeam(params: {
  ideaId: string;
  ideaTitle: string;
  leadUserId: string;
  leadName: string;
  roles: string[];
  createRepo: boolean;
}): Promise<Team | null> {
  const teams = readTeams();

  // Check if team already exists for this idea
  if (teams.find((t) => t.ideaId === params.ideaId)) return null;

  const slug = slugify(params.ideaTitle);
  let githubTeamSlug: string | null = null;
  let repoUrl: string | null = null;

  // Create GitHub Team if bot token available
  if (GITHUB_BOT_TOKEN) {
    try {
      const teamRes = await fetch(
        `https://api.github.com/orgs/${GITHUB_ORG}/teams`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GITHUB_BOT_TOKEN}`,
            Accept: "application/vnd.github+json",
          },
          body: JSON.stringify({
            name: slug,
            description: `Team for: ${params.ideaTitle}`,
            privacy: "closed",
          }),
        }
      );
      if (teamRes.ok) {
        const teamData = await teamRes.json();
        githubTeamSlug = teamData.slug;
      }
    } catch (e) {
      console.error("Failed to create GitHub Team:", e);
    }

    // Create repo if requested
    if (params.createRepo) {
      try {
        const repoRes = await fetch(
          `https://api.github.com/orgs/${GITHUB_ORG}/repos`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${GITHUB_BOT_TOKEN}`,
              Accept: "application/vnd.github+json",
            },
            body: JSON.stringify({
              name: slug,
              description: `Project: ${params.ideaTitle} | IranENovin Community`,
              auto_init: true,
              has_issues: true,
              has_projects: true,
              has_wiki: true,
            }),
          }
        );
        if (repoRes.ok) {
          const repoData = await repoRes.json();
          repoUrl = repoData.html_url;

          // Create initial labels
          for (const label of ["task", "bug", "enhancement", "help wanted"]) {
            await fetch(
              `https://api.github.com/repos/${GITHUB_ORG}/${slug}/labels`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${GITHUB_BOT_TOKEN}`,
                  Accept: "application/vnd.github+json",
                },
                body: JSON.stringify({
                  name: label,
                  color: label === "task" ? "0969da" : undefined,
                }),
              }
            ).catch(() => {});
          }
        }
      } catch (e) {
        console.error("Failed to create repo:", e);
      }
    }
  }

  const team: Team = {
    id: genId(),
    ideaId: params.ideaId,
    ideaTitle: params.ideaTitle,
    projectSlug: params.createRepo ? slug : null,
    name: params.ideaTitle,
    leadUserId: params.leadUserId,
    leadName: params.leadName,
    status: "forming",
    roles: params.roles.map((r) => ({
      title: r,
      filled: false,
      userId: null,
      userName: null,
    })),
    applicants: [],
    githubTeamSlug,
    repoUrl,
    createdAt: new Date().toISOString(),
  };

  teams.push(team);
  writeTeams(teams);
  return team;
}

export function getTeamByIdea(ideaId: string): Team | null {
  return readTeams().find((t) => t.ideaId === ideaId) ?? null;
}

export function getTeamById(teamId: string): Team | null {
  return readTeams().find((t) => t.id === teamId) ?? null;
}

export function getTeamsForUser(userId: string): Team[] {
  return readTeams().filter(
    (t) =>
      t.leadUserId === userId ||
      t.roles.some((r) => r.userId === userId) ||
      t.applicants.some((a) => a.userId === userId)
  );
}

export function getAllTeams(): Team[] {
  return readTeams();
}

export function getActiveTeamCount(): number {
  return readTeams().filter((t) => t.status !== "archived").length;
}

export function getGraduatedTeamCount(): number {
  return readTeams().filter((t) => t.projectSlug !== null).length;
}

export async function applyToTeam(
  teamId: string,
  userId: string,
  userName: string,
  role: string,
  message: string,
  skills: string[]
): Promise<boolean> {
  const teams = readTeams();
  const idx = teams.findIndex((t) => t.id === teamId);
  if (idx < 0) return false;

  // Check if already applied
  if (teams[idx].applicants.some((a) => a.userId === userId)) return false;

  teams[idx].applicants.push({
    userId,
    userName,
    role,
    message,
    skills,
    appliedAt: new Date().toISOString(),
  });

  writeTeams(teams);
  return true;
}

export async function acceptApplicant(
  teamId: string,
  applicantUserId: string
): Promise<boolean> {
  const teams = readTeams();
  const idx = teams.findIndex((t) => t.id === teamId);
  if (idx < 0) return false;

  const appIdx = teams[idx].applicants.findIndex(
    (a) => a.userId === applicantUserId
  );
  if (appIdx < 0) return false;

  const applicant = teams[idx].applicants[appIdx];

  // Fill the role
  const roleIdx = teams[idx].roles.findIndex(
    (r) => r.title === applicant.role && !r.filled
  );
  if (roleIdx >= 0) {
    teams[idx].roles[roleIdx].filled = true;
    teams[idx].roles[roleIdx].userId = applicant.userId;
    teams[idx].roles[roleIdx].userName = applicant.userName;
  }

  // Remove from applicants
  teams[idx].applicants.splice(appIdx, 1);

  // Check if all roles filled → mark active
  if (teams[idx].roles.every((r) => r.filled)) {
    teams[idx].status = "active";
  }

  writeTeams(teams);

  // Add to GitHub Team if possible
  if (GITHUB_BOT_TOKEN && teams[idx].githubTeamSlug) {
    try {
      // We'd need the GitHub username — skip if not available
    } catch {
      // ignore
    }
  }

  return true;
}

export async function rejectApplicant(
  teamId: string,
  applicantUserId: string
): Promise<boolean> {
  const teams = readTeams();
  const idx = teams.findIndex((t) => t.id === teamId);
  if (idx < 0) return false;

  teams[idx].applicants = teams[idx].applicants.filter(
    (a) => a.userId !== applicantUserId
  );

  writeTeams(teams);
  return true;
}
