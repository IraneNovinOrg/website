export const GITHUB_ORG = process.env.GITHUB_ORG || "IraneNovinOrg";
export const GITHUB_IDEAS_REPO = process.env.GITHUB_IDEAS_REPO || "ideas";
export const GITHUB_BOT_TOKEN = process.env.GITHUB_BOT_TOKEN || "";
export const GITHUB_IDEAS_CATEGORY_ID = process.env.GITHUB_IDEAS_CATEGORY_ID || "";

export const CATEGORIES = [
  { id: "all", label: "all", emoji: "🌐" },
  { id: "education", label: "education", emoji: "📚" },
  { id: "ai", label: "ai", emoji: "🤖" },
  { id: "infrastructure", label: "infrastructure", emoji: "🏗️" },
  { id: "health", label: "health", emoji: "🏥" },
  { id: "finance", label: "finance", emoji: "💰" },
  { id: "energy", label: "energy", emoji: "⚡" },
  { id: "agriculture", label: "agriculture", emoji: "🌾" },
  { id: "smart-cities", label: "smartCities", emoji: "🏙️" },
  { id: "internet", label: "internet", emoji: "🌐" },
  { id: "startup", label: "startup", emoji: "🚀" },
  { id: "tourism", label: "tourism", emoji: "✈️" },
  { id: "art-culture", label: "artCulture", emoji: "🎨" },
  { id: "media", label: "media", emoji: "📺" },
  { id: "manufacturing", label: "manufacturing", emoji: "🏭" },
] as const;

export const LOOKING_FOR_ROLES = [
  "designer",
  "developer",
  "researcher",
  "domain-expert",
  "translator",
  "writer",
] as const;

export const STATUS_COLORS: Record<string, string> = {
  planning: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  building: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  launched: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  open: "bg-emerald-100 text-emerald-700",
  "in-progress": "bg-blue-100 text-blue-700",
  "project-created": "bg-purple-100 text-purple-700",
  closed: "bg-gray-100 text-gray-700",
};
