/**
 * i18n-aware notification templates.
 *
 * Each key maps to an EN + FA rendering function. Callers pass `data` which
 * is interpolated into the strings. Unknown types fall back to a generic
 * "Update" title with a best-effort body. Never throws.
 */

export type NotificationTemplateType =
  | "comment_reply"
  | "ai_reply"
  | "task_assigned"
  | "task_submitted"
  | "task_reviewed"
  | "mentioned"
  | "weekly_digest"
  | "idea_graduated"
  | "submission_reviewed"
  | string;

export type TemplateLocale = "en" | "fa";

export interface RenderedTemplate {
  title: string;
  body: string;
}

function str(data: Record<string, unknown>, key: string, fallback = ""): string {
  const v = data[key];
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

type Renderer = (data: Record<string, unknown>) => RenderedTemplate;

const TEMPLATES: Record<string, Record<TemplateLocale, Renderer>> = {
  comment_reply: {
    en: (d) => ({
      title: `${str(d, "actorName", "Someone")} replied to your comment`,
      body: str(d, "preview", "Open the discussion to see the reply."),
    }),
    fa: (d) => ({
      title: `${str(d, "actorName", "کسی")} به نظر شما پاسخ داد`,
      body: str(d, "preview", "برای دیدن پاسخ، گفت‌وگو را باز کنید."),
    }),
  },
  ai_reply: {
    en: (d) => ({
      title: "AI Assistant replied to your comment",
      body: str(d, "preview", "The AI shared some thoughts on your comment."),
    }),
    fa: (d) => ({
      title: "دستیار هوشمند به نظر شما پاسخ داد",
      body: str(d, "preview", "دستیار هوشمند درباره نظر شما نکاتی گفت."),
    }),
  },
  task_assigned: {
    en: (d) => ({
      title: `${str(d, "actorName", "Someone")} claimed "${str(d, "taskTitle", "a task")}"`,
      body: str(d, "projectTitle", "")
        ? `Project: ${str(d, "projectTitle")}`
        : "A contributor picked up a task on your project.",
    }),
    fa: (d) => ({
      title: `${str(d, "actorName", "کسی")} وظیفه «${str(d, "taskTitle", "یک وظیفه")}» را برداشت`,
      body: str(d, "projectTitle", "")
        ? `پروژه: ${str(d, "projectTitle")}`
        : "یک همکار روی یکی از وظیفه‌های پروژه شما کار می‌کند.",
    }),
  },
  task_submitted: {
    en: (d) => ({
      title: `New submission for "${str(d, "taskTitle", "a task")}"`,
      body: `${str(d, "actorName", "A contributor")} submitted work for review.`,
    }),
    fa: (d) => ({
      title: `ارسال جدید برای «${str(d, "taskTitle", "یک وظیفه")}»`,
      body: `${str(d, "actorName", "یک همکار")} کاری را برای بازبینی ارسال کرد.`,
    }),
  },
  task_reviewed: {
    en: (d) => ({
      title: `Your submission was reviewed`,
      body: str(d, "decision", "")
        ? `Decision: ${str(d, "decision")} — "${str(d, "taskTitle", "task")}"`
        : `Review posted on "${str(d, "taskTitle", "task")}"`,
    }),
    fa: (d) => ({
      title: "ارسال شما بازبینی شد",
      body: str(d, "decision", "")
        ? `تصمیم: ${str(d, "decision")} — «${str(d, "taskTitle", "وظیفه")}»`
        : `بازبینی برای «${str(d, "taskTitle", "وظیفه")}» ثبت شد.`,
    }),
  },
  mentioned: {
    en: (d) => ({
      title: `${str(d, "actorName", "Someone")} mentioned you`,
      body: str(d, "preview", "Open the thread to see the mention."),
    }),
    fa: (d) => ({
      title: `${str(d, "actorName", "کسی")} شما را نام برد`,
      body: str(d, "preview", "برای دیدن پیام، گفت‌وگو را باز کنید."),
    }),
  },
  weekly_digest: {
    en: (d) => ({
      title: "Your weekly IranENovin digest",
      body: str(d, "summary", "Fresh ideas, projects, and community highlights."),
    }),
    fa: (d) => ({
      title: "گزیده هفتگی IranENovin",
      body: str(d, "summary", "ایده‌ها، پروژه‌ها و رویدادهای تازه جامعه."),
    }),
  },
  idea_graduated: {
    en: (d) => ({
      title: `"${str(d, "ideaTitle", "Your idea")}" became a project!`,
      body: "It has enough traction to move forward — come help shape the roadmap.",
    }),
    fa: (d) => ({
      title: `«${str(d, "ideaTitle", "ایده شما")}» به پروژه تبدیل شد!`,
      body: "این ایده آماده حرکت است — برای شکل‌دادن مسیر، همراه شوید.",
    }),
  },
  submission_reviewed: {
    en: (d) => ({
      title: `Your submission was ${str(d, "decision", "reviewed")}`,
      body: `Task: "${str(d, "taskTitle", "")}". ${str(d, "note", "")}`.trim(),
    }),
    fa: (d) => ({
      title: `ارسال شما ${str(d, "decision", "بازبینی شد")}`,
      body: `وظیفه: «${str(d, "taskTitle", "")}». ${str(d, "note", "")}`.trim(),
    }),
  },
  project_update: {
    en: (d) => ({
      title: `Update on "${str(d, "projectTitle", "a project")}"`,
      body: str(d, "detail", "Something changed on a project you follow."),
    }),
    fa: (d) => ({
      title: `به‌روزرسانی در «${str(d, "projectTitle", "یک پروژه")}»`,
      body: str(d, "detail", "در پروژه‌ای که دنبال می‌کنید، تغییری رخ داد."),
    }),
  },
  new_comment: {
    en: (d) => ({
      title: `New comment on "${str(d, "projectTitle", "a project")}"`,
      body: `${str(d, "actorName", "Someone")}: ${str(d, "preview", "")}`.trim(),
    }),
    fa: (d) => ({
      title: `نظر تازه در «${str(d, "projectTitle", "یک پروژه")}»`,
      body: `${str(d, "actorName", "کسی")}: ${str(d, "preview", "")}`.trim(),
    }),
  },
  task_created: {
    en: (d) => ({
      title: `New task in "${str(d, "projectTitle", "a project")}"`,
      body: `"${str(d, "taskTitle", "")}" — ${str(d, "timeEstimate", "")}`.trim(),
    }),
    fa: (d) => ({
      title: `وظیفه تازه در «${str(d, "projectTitle", "یک پروژه")}»`,
      body: `«${str(d, "taskTitle", "")}» — ${str(d, "timeEstimate", "")}`.trim(),
    }),
  },
  admin_promoted: {
    en: () => ({
      title: "You're now an admin",
      body: "You can access the admin panel and manage platform settings.",
    }),
    fa: () => ({
      title: "شما اکنون ادمین هستید",
      body: "به پنل ادمین دسترسی دارید و می‌توانید تنظیمات پلتفرم را مدیریت کنید.",
    }),
  },
  lead_promoted: {
    en: (d) => ({
      title: `You're now a lead on "${str(d, "projectTitle", "a project")}"`,
      body: "You can manage members, tasks, and the document for this project.",
    }),
    fa: (d) => ({
      title: `شما اکنون سرپرست «${str(d, "projectTitle", "یک پروژه")}» هستید`,
      body: "می‌توانید اعضا، وظایف و سند این پروژه را مدیریت کنید.",
    }),
  },
  doc_suggestion: {
    en: (d) => ({
      title: `New document edit suggestion`,
      body: `${str(d, "actorName", "A user")} suggested changes to "${str(d, "projectTitle", "a project")}" — please review.`,
    }),
    fa: (d) => ({
      title: `پیشنهاد ویرایش سند`,
      body: `${str(d, "actorName", "یک کاربر")} برای «${str(d, "projectTitle", "پروژه")}» تغییراتی پیشنهاد داد — لطفاً بازبینی کنید.`,
    }),
  },
  site_announcement: {
    en: (d) => ({
      title: str(d, "title", "IranENovin announcement"),
      body: str(d, "body", ""),
    }),
    fa: (d) => ({
      title: str(d, "title", "اطلاعیه IranENovin"),
      body: str(d, "body", ""),
    }),
  },
};

export function getNotificationTemplate(
  type: string,
  locale: TemplateLocale,
  data: Record<string, unknown>
): RenderedTemplate {
  const tpl = TEMPLATES[type];
  if (tpl && tpl[locale]) {
    try {
      return tpl[locale](data);
    } catch {
      /* fall through */
    }
  }
  // Fallback — generic update
  const title = typeof data.title === "string"
    ? (data.title as string)
    : locale === "fa"
      ? "به‌روزرسانی"
      : "Update";
  const body = typeof data.body === "string" ? (data.body as string) : "";
  return { title, body };
}
