"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Shield, UserPlus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Matches `_config/ai.json` → `adminEmails`. Source of truth lives in
// `lib/admin.ts`; this component is a thin UI over that module's API route.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AdminSettings() {
  const [admins, setAdmins] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/admins");
      if (res.ok) {
        const data = await res.json();
        setAdmins(Array.isArray(data.admins) ? data.admins : []);
      } else {
        toast.error("Failed to load admin list");
      }
    } catch {
      toast.error("Failed to load admin list");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.email) setCurrentEmail(String(j.email).toLowerCase().trim());
      })
      .catch(() => { /* ignore */ });
  }, [fetchAdmins]);

  const handleAdd = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email) {
      setFormError("Email is required");
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setFormError("Enter a valid email address");
      return;
    }
    if (admins.includes(email)) {
      setFormError("That email is already an admin");
      return;
    }

    setFormError(null);
    setAdding(true);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAdmins(Array.isArray(data.admins) ? data.admins : admins);
        setNewEmail("");
        toast.success(`Added ${email} as admin`);
      } else {
        const msg = data?.error || "Failed to add admin";
        setFormError(msg);
        toast.error(msg);
      }
    } catch (err) {
      const msg = `Error: ${err}`;
      setFormError(msg);
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (email: string) => {
    if (currentEmail && email === currentEmail) {
      toast.error("You cannot remove your own admin access");
      return;
    }
    if (admins.length <= 1) {
      toast.error("Cannot remove the last admin");
      return;
    }
    if (!confirm(`Remove ${email} from admins?`)) return;

    setRemovingEmail(email);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAdmins(Array.isArray(data.admins) ? data.admins : admins.filter((e) => e !== email));
        toast.success(`Removed ${email}`);
      } else {
        toast.error(data?.error || "Failed to remove admin");
      }
    } catch (err) {
      toast.error(`Error: ${err}`);
    } finally {
      setRemovingEmail(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Admin list */}
      <div className="rounded-lg border border-iran-green/20 bg-white p-5 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 font-bold">
              <Shield className="h-4 w-4 text-iran-green" /> Current Admins
            </h3>
            <p className="text-xs text-muted-foreground">
              Stored in <code className="rounded bg-iran-green/10 px-1">_config/ai.json</code> → <code>adminEmails</code>
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-iran-green/30 hover:bg-iran-green/10"
            onClick={fetchAdmins}
            disabled={loading}
          >
            <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {loading && admins.length === 0 ? (
          <div className="space-y-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : admins.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No admins configured.</p>
        ) : (
          <ul className="space-y-2">
            {admins.map((email) => {
              const isSelf = currentEmail === email;
              const isLast = admins.length <= 1;
              const disabled = isSelf || isLast || removingEmail === email;
              const tooltip = isSelf
                ? "You can't remove your own admin access"
                : isLast
                  ? "Can't remove the last admin"
                  : "Remove admin";
              return (
                <li
                  key={email}
                  className="flex items-center justify-between gap-2 rounded border border-iran-green/10 bg-iran-green/5 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-iran-green" />
                    <span className="truncate font-mono text-sm">{email}</span>
                    {isSelf && (
                      <Badge className="ml-1 border border-iran-gold/30 bg-iran-gold/10 text-[10px] text-iran-gold">
                        you
                      </Badge>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(email)}
                    disabled={disabled}
                    title={tooltip}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-iran-red hover:bg-iran-red/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    {removingEmail === email ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          {admins.length} admin{admins.length === 1 ? "" : "s"} · Admins can manage projects, trigger AI, and edit this list.
        </p>
      </div>

      {/* Add admin form */}
      <form
        onSubmit={handleAdd}
        className="rounded-lg border border-iran-green/20 bg-white p-5 dark:bg-gray-900"
      >
        <h3 className="mb-2 flex items-center gap-2 font-bold">
          <UserPlus className="h-4 w-4 text-iran-green" /> Add Admin
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          The user must sign in at least once with this email (GitHub, Google, or password) for the permission to apply.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => {
              setNewEmail(e.target.value);
              if (formError) setFormError(null);
            }}
            placeholder="new-admin@example.com"
            disabled={adding}
            className="min-w-[240px] flex-1 border-iran-green/20 focus:border-iran-green focus-visible:ring-iran-green/40"
          />
          <Button
            type="submit"
            disabled={adding || !newEmail.trim()}
            className="bg-iran-green text-white shadow-iran-green hover:bg-iran-deep-green"
          >
            {adding ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Adding...
              </>
            ) : (
              <>
                <UserPlus className="mr-1 h-4 w-4" /> Add
              </>
            )}
          </Button>
        </div>
        {formError && (
          <p className="mt-2 text-xs text-iran-red">{formError}</p>
        )}
      </form>
    </div>
  );
}

export default AdminSettings;
