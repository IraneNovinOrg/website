/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/index";
import { getAllTasksGrouped } from "@/lib/ai-tasks";

export async function GET() {
  const db = getDb();

  const totalIdeas = (db.prepare("SELECT COUNT(*) as c FROM ideas").get() as any).c || 0;
  const activeProjects = (db.prepare(
    "SELECT COUNT(*) as c FROM ideas WHERE project_status IN ('active', 'needs-contributors')"
  ).get() as any).c || 0;
  const contributors = (db.prepare("SELECT COUNT(*) as c FROM users").get() as any).c || 0;
  const helpOffers = (db.prepare("SELECT COUNT(*) as c FROM help_offers").get() as any).c || 0;

  // Task stats from JSON file (single read)
  const taskMap = getAllTasksGrouped();
  let totalTasks = 0;
  let completedTasks = 0;
  for (const tasks of Array.from(taskMap.values())) {
    totalTasks += tasks.length;
    completedTasks += tasks.filter(t => t.status === "accepted").length;
  }

  const totalHoursEstimated = (() => {
    const tasks = db.prepare("SELECT time_estimate FROM tasks").all() as any[];
    return tasks.reduce((sum: number, t: any) => {
      const hours = parseInt((t.time_estimate || "").replace(/[^0-9]/g, "")) || 0;
      return sum + hours;
    }, 0);
  })();

  const completedHoursEstimated = (() => {
    const tasks = db.prepare("SELECT time_estimate FROM tasks WHERE status = 'accepted'").all() as any[];
    return tasks.reduce((sum: number, t: any) => {
      const hours = parseInt((t.time_estimate || "").replace(/[^0-9]/g, "")) || 0;
      return sum + hours;
    }, 0);
  })();

  const activeContributors = (db.prepare(
    "SELECT COUNT(DISTINCT assignee_id) as c FROM tasks WHERE assignee_id IS NOT NULL"
  ).get() as any).c || 0;

  return NextResponse.json(
    { totalIdeas, activeProjects, contributors, helpOffers, totalTasks, completedTasks, totalHoursEstimated, completedHoursEstimated, activeContributors },
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate" } }
  );
}
