"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Zap, Sparkles, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

type SkillName =
  | "reply-to-comment"
  | "review-submission"
  | "match-experts"
  | "suggest-improvements"
  | "generate-weekly-digest"
  | "update-document"
  | "reply-to-task-note";

interface SkillDef {
  name: SkillName;
  label: string;
  description: string;
  requires: Array<"ideaId" | "commentId" | "submissionId" | "noteId">;
}

const SKILLS: SkillDef[] = [
  { name: "reply-to-comment", label: "Reply to Comment", description: "AI drafts a reply to a specific comment.", requires: ["commentId"] },
  { name: "reply-to-task-note", label: "Reply to Task Note", description: "AI drafts a reply to a task note.", requires: ["noteId"] },
  { name: "review-submission", label: "Review Submission", description: "AI reviews a task submission and suggests a decision.", requires: ["submissionId"] },
  { name: "match-experts", label: "Match Experts", description: "Find opted-in experts whose skills match the idea.", requires: ["ideaId"] },
  { name: "suggest-improvements", label: "Suggest Improvements", description: "AI suggests improvements to the idea/project.", requires: ["ideaId"] },
  { name: "update-document", label: "Update Project Document", description: "AI regenerates the project overview doc.", requires: ["ideaId"] },
  { name: "generate-weekly-digest", label: "Weekly Digest", description: "Generate this week's community digest.", requires: [] },
];

export function SkillTriggerPanel() {
  const [selected, setSelected] = useState<SkillName>("match-experts");
  const [ideaId, setIdeaId] = useState("");
  const [commentId, setCommentId] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [noteId, setNoteId] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; data?: any; error?: string } | null>(null);

  const skillDef = SKILLS.find(s => s.name === selected)!;

  const trigger = async () => {
    // Validate required fields
    const payload: Record<string, string> = {};
    for (const req of skillDef.requires) {
      const val = req === "ideaId" ? ideaId : req === "commentId" ? commentId : req === "submissionId" ? submissionId : noteId;
      if (!val.trim()) {
        toast.error(`${req} is required for this skill`);
        return;
      }
      payload[req] = val.trim();
    }

    setRunning(true);
    setResult(null);
    try {
      let res = await fetch(`/api/ai/skills/${selected}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Fallback if dedicated endpoint doesn't exist
      if (res.status === 404 || res.status === 405) {
        res = await fetch("/api/admin/ai-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "skill",
            skill: selected,
            ...payload,
          }),
        });
      }

      const data = await res.json();
      if (res.ok && (data.success !== false)) {
        setResult({ success: true, data });
        toast.success(`Skill '${skillDef.label}' executed`);
      } else {
        setResult({ success: false, error: data.error || `Request failed (${res.status})` });
        toast.error(data.error || "Skill failed");
      }
    } catch (e) {
      setResult({ success: false, error: (e as Error).message });
      toast.error(`Error: ${e}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-lg border border-iran-gold/30 bg-gradient-to-br from-iran-gold/5 to-transparent p-5 dark:bg-gray-900">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-iran-gold" />
        <h3 className="font-bold">AI Skill Trigger</h3>
        <Badge className="bg-iran-gold/10 text-iran-gold border-iran-gold/30" variant="outline">
          Manual
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium">Skill</label>
          <select
            value={selected}
            onChange={(e) => { setSelected(e.target.value as SkillName); setResult(null); }}
            className="w-full rounded-md border border-iran-green/20 bg-background px-3 py-2 text-sm focus:border-iran-green focus:outline-none focus:ring-1 focus:ring-iran-green/40"
          >
            {SKILLS.map(s => (
              <option key={s.name} value={s.name}>{s.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">{skillDef.description}</p>
        </div>

        <div className="space-y-2">
          {skillDef.requires.includes("ideaId") && (
            <div>
              <label className="mb-1 block text-xs font-medium">Idea ID</label>
              <Input
                value={ideaId}
                onChange={(e) => setIdeaId(e.target.value)}
                placeholder="e.g. iae-42"
                className="border-iran-green/20 focus:border-iran-green focus-visible:ring-iran-green/40"
              />
            </div>
          )}
          {skillDef.requires.includes("commentId") && (
            <div>
              <label className="mb-1 block text-xs font-medium">Comment ID</label>
              <Input
                value={commentId}
                onChange={(e) => setCommentId(e.target.value)}
                placeholder="comment id"
                className="border-iran-green/20 focus:border-iran-green focus-visible:ring-iran-green/40"
              />
            </div>
          )}
          {skillDef.requires.includes("submissionId") && (
            <div>
              <label className="mb-1 block text-xs font-medium">Submission ID</label>
              <Input
                value={submissionId}
                onChange={(e) => setSubmissionId(e.target.value)}
                placeholder="submission id"
                className="border-iran-green/20 focus:border-iran-green focus-visible:ring-iran-green/40"
              />
            </div>
          )}
          {skillDef.requires.includes("noteId") && (
            <div>
              <label className="mb-1 block text-xs font-medium">Note ID</label>
              <Input
                value={noteId}
                onChange={(e) => setNoteId(e.target.value)}
                placeholder="task note id"
                className="border-iran-green/20 focus:border-iran-green focus-visible:ring-iran-green/40"
              />
            </div>
          )}
          {skillDef.requires.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              No inputs required. Click &quot;Trigger&quot; to run.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button
          onClick={trigger}
          disabled={running}
          className="bg-gradient-iran text-white shadow-iran-green hover:opacity-95"
        >
          {running ? (
            <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Running…</>
          ) : (
            <><Zap className="mr-1 h-4 w-4" /> Trigger Skill</>
          )}
        </Button>
      </div>

      {result && (
        <div className={`mt-4 rounded-md border p-3 text-sm ${
          result.success
            ? "border-iran-green/30 bg-iran-green/5"
            : "border-iran-red/30 bg-iran-red/5"
        }`}>
          <p className="mb-2 flex items-center gap-2 font-medium">
            {result.success ? (
              <><CheckCircle2 className="h-4 w-4 text-iran-green" /> Skill executed successfully</>
            ) : (
              <><XCircle className="h-4 w-4 text-iran-red" /> Skill failed</>
            )}
          </p>
          <pre className="overflow-auto whitespace-pre-wrap rounded bg-white/60 p-2 text-xs dark:bg-black/30">
            {JSON.stringify(result.success ? result.data : { error: result.error }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default SkillTriggerPanel;
