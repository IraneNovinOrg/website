"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, ExternalLink, Circle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks: any[];
  projectSlug: string;
}

export default function TaskList({ tasks: initialTasks, projectSlug }: Props) {
  const t = useTranslations("projectWorkspace");
  const { data: session } = useSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tasks, setTasks] = useState<any[]>(initialTasks);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);

    try {
      const res = await fetch(`/api/projects/${projectSlug}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      if (res.ok) {
        const data = await res.json();
        setTasks((prev) => [data.task, ...prev]);
        setTitle("");
        setDescription("");
        setShowForm(false);
      }
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      {session && (
        <div className="mb-4">
          {showForm ? (
            <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-border p-4">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("taskTitle")}
                required
              />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("taskDescription")}
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={creating}
                  size="sm"
                  className="bg-primary text-white"
                >
                  {creating ? "..." : t("createTask")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(true)}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              {t("addTask")}
            </Button>
          )}
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">{t("noTasks")}</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <a
              key={task.id}
              href={task.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {task.state === "open" ? (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{task.title}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </div>
                {task.assignee && (
                  <div className="mt-1 flex items-center gap-1">
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={task.assignee.avatar_url} />
                      <AvatarFallback className="text-[8px]">
                        {task.assignee.login[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">
                      {task.assignee.login}
                    </span>
                  </div>
                )}
              </div>
              <Badge
                variant="outline"
                className={`text-xs ${task.state === "open" ? "text-green-600" : "text-purple-600"}`}
              >
                {task.state}
              </Badge>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
