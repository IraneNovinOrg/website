import { getDb, findOptedInExperts as dbFindExperts } from "./db/index";
import { getTelegramChatId } from "./telegram/bot";

export interface ExpertReview {
  id: string;
  submissionId: string;
  reviewerId: string;
  reviewerName: string;
  decision: "approve" | "reject" | "comment";
  comment: string;
  via: "website" | "telegram";
  createdAt: string;
}

export function findExpertsForTask(
  skillsNeeded: string[],
  excludeUserId?: string
): { userId: string; name: string; matchReason: string; hasTelegram: boolean }[] {
  const experts = dbFindExperts(skillsNeeded, excludeUserId);

  return experts.map((u) => ({
    userId: u.id,
    name: u.name || u.email,
    matchReason: `Skills: ${u.skills.filter((s) => skillsNeeded.includes(s)).join(", ")}`,
    hasTelegram: !!getTelegramChatId(u.id),
  })).slice(0, 10);
}

export function addExpertReview(
  submissionId: string,
  reviewerId: string,
  reviewerName: string,
  decision: "approve" | "reject" | "comment",
  comment: string,
  via: "website" | "telegram"
): ExpertReview {
  const id = `rev-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;
  getDb().prepare(
    `INSERT INTO expert_reviews (id, submission_id, reviewer_id, reviewer_name, decision, comment, via)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, submissionId, reviewerId, reviewerName, decision, comment, via);

  return { id, submissionId, reviewerId, reviewerName, decision, comment, via, createdAt: new Date().toISOString() };
}

export function getReviewsForSubmission(submissionId: string): ExpertReview[] {
  return getDb().prepare(
    "SELECT * FROM expert_reviews WHERE submission_id = ?"
  ).all(submissionId) as ExpertReview[];
}

export function isSubmissionApproved(submissionId: string): boolean {
  const reviews = getReviewsForSubmission(submissionId);
  const approvals = reviews.filter((r) => r.decision === "approve");
  const rejections = reviews.filter((r) => r.decision === "reject");
  return approvals.length >= 1 && rejections.length === 0;
}
