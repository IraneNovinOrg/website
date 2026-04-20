/**
 * Migrate JSON data files to SQLite.
 * Run once: npx tsx scripts/migrate-to-sqlite.ts
 */

import { getDb } from "../lib/db/index";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function migrate() {
  const db = getDb();
  const dataDir = join(process.cwd(), "_data");
  console.log("Migrating JSON data to SQLite...\n");

  // 1. Migrate users
  const usersFile = join(dataDir, "users.json");
  if (existsSync(usersFile)) {
    const users = JSON.parse(readFileSync(usersFile, "utf-8"));
    const insert = db.prepare(`
      INSERT OR IGNORE INTO users (id, email, name, avatar_url, github_login,
        bio, skills, location, timezone, languages, hours_per_week, categories,
        telegram_handle, linkedin_url, is_public_profile, profile_completed,
        reputation_score, provider, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let count = 0;
    for (const u of users) {
      try {
        insert.run(
          u.id, u.email, u.name, u.avatar_url, u.github_login,
          u.bio, JSON.stringify(u.skills || []),
          u.location || null, u.timezone || null,
          JSON.stringify(u.languages || []),
          u.hoursPerWeek || u.hours_per_week || null,
          JSON.stringify(u.categories || []),
          u.telegramHandle || u.telegram_handle || null,
          u.linkedInUrl || u.linkedin_url || null,
          u.isPublicProfile || u.is_public_profile ? 1 : 0,
          u.profileCompleted || u.profile_completed ? 1 : 0,
          u.reputationScore || u.reputation_score || 0,
          u.provider || "email",
          u.password_hash || null,
          u.created_at || new Date().toISOString()
        );
        count++;
      } catch (e) {
        console.error(`  Skipped user ${u.email}:`, (e as Error).message);
      }
    }
    console.log(`  ✓ Migrated ${count} users`);
  }

  // 2. Migrate teams → projects + roles + applicants
  const teamsFile = join(dataDir, "teams.json");
  if (existsSync(teamsFile)) {
    const teams = JSON.parse(readFileSync(teamsFile, "utf-8"));
    let count = 0;
    for (const t of teams) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO projects (id, slug, title, status, lead_user_id,
            source_idea_id, source_idea_title, github_repo_url, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          t.id, t.projectSlug || t.id, t.name || t.ideaTitle, t.status,
          t.leadUserId, t.ideaId, t.ideaTitle, t.repoUrl, t.createdAt
        );

        for (const role of t.roles || []) {
          db.prepare(`
            INSERT OR IGNORE INTO project_roles (id, project_id, title, is_filled, filled_by, filled_name)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(genId(), t.id, role.title, role.filled ? 1 : 0, role.userId, role.userName);
        }

        for (const app of t.applicants || []) {
          db.prepare(`
            INSERT OR IGNORE INTO project_applicants (id, project_id, user_id, user_name, role, message, skills, applied_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(genId(), t.id, app.userId, app.userName, app.role, app.message, JSON.stringify(app.skills || []), app.appliedAt);
        }

        count++;
      } catch (e) {
        console.error(`  Skipped team ${t.id}:`, (e as Error).message);
      }
    }
    console.log(`  ✓ Migrated ${count} teams → projects`);
  }

  // 3. Migrate tasks
  const tasksFile = join(dataDir, "tasks.json");
  if (existsSync(tasksFile)) {
    const tasks = JSON.parse(readFileSync(tasksFile, "utf-8"));
    let count = 0;
    for (const t of tasks) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO tasks (id, idea_id, title, description, skills_needed,
            time_estimate, output_type, status, assignee_id, assignee_name,
            claimed_at, due_date, source, parent_task_id, task_order, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          t.id, t.ideaId, t.title, t.description,
          JSON.stringify(t.skillsNeeded || []),
          t.timeEstimate, t.outputType, t.status,
          t.assigneeId, t.assigneeName, t.claimedAt, t.dueDate,
          t.source, t.parentTaskId, t.order || 0, t.createdAt
        );

        // Migrate notes
        for (const note of t.notes || []) {
          db.prepare(`
            INSERT INTO task_notes (id, task_id, author_id, author_name, content, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(genId(), t.id, note.authorId, note.authorName, note.content, note.createdAt);
        }

        count++;
      } catch (e) {
        console.error(`  Skipped task ${t.id}:`, (e as Error).message);
      }
    }
    console.log(`  ✓ Migrated ${count} tasks`);
  }

  // 4. Migrate submissions
  const subsFile = join(dataDir, "submissions.json");
  if (existsSync(subsFile)) {
    const subs = JSON.parse(readFileSync(subsFile, "utf-8"));
    let count = 0;
    for (const s of subs) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO submissions (id, task_id, idea_id, author_id, author_name,
            type, content, ai_review, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          s.id, s.taskId, s.ideaId, s.authorId, s.authorName,
          s.type, s.content, s.aiReview ? JSON.stringify(s.aiReview) : null,
          s.status, s.createdAt
        );
        count++;
      } catch (e) {
        console.error(`  Skipped submission ${s.id}:`, (e as Error).message);
      }
    }
    console.log(`  ✓ Migrated ${count} submissions`);
  }

  // 5. Migrate reviews
  const reviewsFile = join(dataDir, "reviews.json");
  if (existsSync(reviewsFile)) {
    const reviews = JSON.parse(readFileSync(reviewsFile, "utf-8"));
    let count = 0;
    for (const r of reviews) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO expert_reviews (id, submission_id, reviewer_id, reviewer_name,
            decision, comment, via, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(r.id, r.submissionId, r.reviewerId, r.reviewerName, r.decision, r.comment, r.via, r.createdAt);
        count++;
      } catch (e) {
        console.error(`  Skipped review:`, (e as Error).message);
      }
    }
    console.log(`  ✓ Migrated ${count} reviews`);
  }

  // 6. Migrate telegram links
  const linksFile = join(dataDir, "telegram-links.json");
  if (existsSync(linksFile)) {
    const links = JSON.parse(readFileSync(linksFile, "utf-8"));
    let count = 0;
    for (const l of links) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO telegram_links (user_id, telegram_chat_id, telegram_username, linked_at)
          VALUES (?, ?, ?, ?)
        `).run(l.userId, l.telegramChatId, l.telegramUsername, l.linkedAt);
        count++;
      } catch (e) {
        console.error(`  Skipped link:`, (e as Error).message);
      }
    }
    console.log(`  ✓ Migrated ${count} telegram links`);
  }

  console.log("\n✅ Migration complete!");
  console.log(`Database: _data/iranenovin.db`);
}

migrate();
