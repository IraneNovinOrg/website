/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { getDb } from "./db/index";

export type TrustLevel = 1 | 2 | 3 | 4;

export const TRUST_LABELS: Record<number, string> = {
  1: "New Member",
  2: "Contributor",
  3: "Reviewer",
  4: "Lead",
};

export const TRUST_COLORS: Record<number, string> = {
  1: "bg-gray-100 text-gray-700",
  2: "bg-blue-100 text-blue-700",
  3: "bg-purple-100 text-purple-700",
  4: "bg-amber-100 text-amber-700",
};

export function getUserTrustLevel(userId: string): number {
  const db = getDb();
  const user = db.prepare("SELECT trust_level FROM users WHERE id = ?").get(userId) as any;
  return user?.trust_level ?? 1;
}

export function canSubmitIdea(_trustLevel: number): boolean {
  return true; // Everyone can submit ideas (level 1+)
}

export function canVote(_trustLevel: number): boolean {
  return true; // Everyone can vote (level 1+)
}

export function canComment(_trustLevel: number): boolean {
  return true; // Everyone can comment (level 1+)
}

export function canClaimTask(trustLevel: number): boolean {
  return trustLevel >= 1; // All registered users can claim tasks
}

export function canProposeTask(trustLevel: number): boolean {
  return trustLevel >= 1; // All registered users can propose tasks
}

export function canReviewSubmission(trustLevel: number): boolean {
  return trustLevel >= 3; // Reviewers+ can review
}

export function canEditProjectDoc(trustLevel: number): boolean {
  return trustLevel >= 3; // Reviewers+ can edit docs
}

export function canManageProject(trustLevel: number): boolean {
  return trustLevel >= 4; // Leads+ can manage projects
}

// Auto-promote based on activity
export function checkAutoPromotion(userId: string): number | null {
  const db = getDb();
  const user = db.prepare("SELECT trust_level FROM users WHERE id = ?").get(userId) as any;
  if (!user) return null;
  const currentLevel = user.trust_level || 1;

  if (currentLevel >= 3) return null; // Don't auto-promote above level 3

  // Level 1 → 2: after posting 1 idea OR 3 comments
  if (currentLevel === 1) {
    const commentCount = (db.prepare(
      "SELECT COUNT(*) as c FROM idea_comments WHERE author_id = ? AND source = 'local'"
    ).get(userId) as any)?.c || 0;
    // Check help offers too
    const helpCount = (db.prepare(
      "SELECT COUNT(*) as c FROM help_offers WHERE user_id = ?"
    ).get(userId) as any)?.c || 0;
    if (commentCount >= 3 || helpCount >= 1) {
      db.prepare("UPDATE users SET trust_level = 2 WHERE id = ?").run(userId);
      return 2;
    }
  }

  // Level 2 → 3: after completing 5 tasks
  if (currentLevel === 2) {
    const completedTasks = (db.prepare(
      "SELECT COUNT(*) as c FROM tasks WHERE assignee_id = ? AND status = 'accepted'"
    ).get(userId) as any)?.c || 0;
    if (completedTasks >= 5) {
      db.prepare("UPDATE users SET trust_level = 3 WHERE id = ?").run(userId);
      return 3;
    }
  }

  return null;
}
