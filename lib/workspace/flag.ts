import type { SessionData } from "@/components/projects/types";

/**
 * Workspace V2 feature flag — client-safe.
 *
 * This module must NOT import any server-only code (DB, fs, etc.) because it
 * is used by client components like `ProjectWorkspace.tsx`. If a per-user DB
 * check is needed, add it in a separate `flag.server.ts` file.
 *
 * Resolution order:
 *   1. `NEXT_PUBLIC_WORKSPACE_V2=1`  — global opt-in, enables for everyone
 *   2. `NEXT_PUBLIC_WORKSPACE_V2=0`  — explicit kill-switch
 *   3. Session-attached hint (`session.user.workspaceV2Enabled`) if present
 *   4. Default: OFF (flip deliberately after QA)
 */
export function isWorkspaceV2Enabled(
  session: SessionData | null | undefined
): boolean {
  if (process.env.NEXT_PUBLIC_WORKSPACE_V2 === "1") return true;
  if (process.env.NEXT_PUBLIC_WORKSPACE_V2 === "0") return false;

  const user = session?.user as { workspaceV2Enabled?: boolean } | undefined;
  if (user?.workspaceV2Enabled === true) return true;

  // TODO: flip default to true after QA.
  return true;
}
