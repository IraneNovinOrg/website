"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import AuthModal from "@/components/auth/AuthModal";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";

export default function SubmitPage() {
  const t = useTranslations("submit");
  const tAuth = useTranslations("auth");
  const { data: session } = useSession();
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [type, setType] = useState("idea");
  const [language, setLanguage] = useState("en");
  const [images, setImages] = useState<File[]>([]);
  const [leadProject, setLeadProject] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<
    { id: string; name: string; emoji: string }[]
  >([]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => setCategories(data.categories || []))
      .catch((e) => console.error("Failed to load categories:", e));
  }, []);

  if (!session) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="mb-4 text-3xl font-bold">{t("title")}</h1>
        <p className="mb-6 text-muted-foreground">
          {tAuth("signInReason", { action: tAuth("submitAction") })}
        </p>
        <button
          onClick={() => setAuthOpen(true)}
          className="rounded-lg bg-primary px-6 py-2 font-medium text-white hover:bg-primary/90"
        >
          {tAuth("signIn")}
        </button>
        <AuthModal
          open={authOpen}
          onClose={() => setAuthOpen(false)}
          action={tAuth("submitAction") as string}
        />
      </div>
    );
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (title.trim().length < 10) errs.title = t("titleMinLength");
    if (title.trim().length > 150) errs.title = t("titleMaxLength");
    if (!categoryId) errs.categoryId = t("categoryRequired");
    if (body.trim().length < 20) errs.body = t("descMinLength");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newImages = Array.from(files).filter(
      (f) => f.type.startsWith("image/") && f.size < 5 * 1024 * 1024
    );
    setImages((prev) => [...prev, ...newImages].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      // Upload images first if any
      let imageMarkdown = "";
      if (images.length > 0) {
        for (const img of images) {
          const base64 = await fileToBase64(img);
          const uploadRes = await fetch("/api/upload-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: img.name,
              content: base64,
            }),
          });
          if (!uploadRes.ok) {
            const err = await uploadRes
              .json()
              .catch(() => ({ error: `HTTP ${uploadRes.status}` }));
            throw new Error(
              err.error || `Failed to upload ${img.name} (${uploadRes.status})`
            );
          }
          const { url } = await uploadRes.json();
          imageMarkdown += `\n\n![${img.name}](${url})`;
        }
      }

      const fullBody = body + imageMarkdown;

      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body: fullBody,
          categoryId,
          tags,
          type,
          language,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const result = await res.json();
      toast.success("Idea submitted!");
      const ideaUrl = `/ideas/${result.idea.id}`;
      router.push(leadProject ? `${ideaUrl}?startBuilding=true` : ideaUrl);
    } catch (e) {
      console.error("Submit idea failed:", e);
      toast.error((e as Error).message || "Failed to submit idea");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">{t("title")}</h1>

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <Label>{t("titleField")}</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("titlePlaceholder")}
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title}</p>
          )}
        </div>

        <div>
          <Label>{t("category")}</Label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t("selectCategory")}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.emoji} {cat.name}
              </option>
            ))}
          </select>
          {errors.categoryId && (
            <p className="mt-1 text-sm text-red-600">{errors.categoryId}</p>
          )}
        </div>

        <div>
          <Label>{t("description")}</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("descriptionPlaceholder")}
            rows={8}
          />
          <div className="mt-1 flex justify-between">
            <p className="text-xs text-muted-foreground">
              {t("supportsMarkdown")}
            </p>
            <p className="text-xs text-muted-foreground">
              {body.length} / 20 min
            </p>
          </div>
          {errors.body && (
            <p className="mt-1 text-sm text-red-600">{errors.body}</p>
          )}
        </div>

        {/* Image upload */}
        <div>
          <Label>{t("images")}</Label>
          <div className="mt-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageAdd}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <ImagePlus className="h-4 w-4" />
              {t("addImages")}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("imagesHint")}
            </p>
          </div>
          {images.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {images.map((img, idx) => (
                <div
                  key={idx}
                  className="relative rounded-lg border bg-gray-50 px-3 py-1.5 text-xs dark:bg-gray-800"
                >
                  {img.name}
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="ms-2 text-red-500"
                  >
                    <X className="inline h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <Label>{t("tags")}</Label>
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={t("tagsPlaceholder")}
          />
        </div>

        <div>
          <Label>{t("type")}</Label>
          <div className="mt-1 flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="idea"
                checked={type === "idea"}
                onChange={(e) => setType(e.target.value)}
                className="accent-primary"
              />
              <span className="text-sm">{t("typeIdea")}</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="project-ready"
                checked={type === "project-ready"}
                onChange={(e) => setType(e.target.value)}
                className="accent-primary"
              />
              <span className="text-sm">{t("typeProject")}</span>
            </label>
          </div>
        </div>

        <div>
          <Label>{t("language")}</Label>
          <div className="mt-1 flex gap-4">
            {(["en", "fa", "both"] as const).map((lang) => (
              <label key={lang} className="flex items-center gap-2">
                <input
                  type="radio"
                  value={lang}
                  checked={language === lang}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="accent-primary"
                />
                <span className="text-sm">
                  {lang === "en"
                    ? t("langEn")
                    : lang === "fa"
                      ? t("langFa")
                      : t("langBoth")}
                </span>
              </label>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-gray-50 p-3 dark:bg-gray-800">
          <input
            type="checkbox"
            checked={leadProject}
            onChange={(e) => setLeadProject(e.target.checked)}
            className="accent-primary"
          />
          <div>
            <p className="text-sm font-medium">{t("leadProject")}</p>
            <p className="text-xs text-muted-foreground">{t("leadProjectDesc")}</p>
          </div>
        </label>

        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-primary text-white hover:bg-primary/90"
          size="lg"
        >
          {submitting ? t("submitting") : t("submitButton")}
        </Button>
      </form>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:image/xxx;base64, prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
