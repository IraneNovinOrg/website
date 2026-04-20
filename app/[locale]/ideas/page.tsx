import { useTranslations } from "next-intl";
import IdeasFeed from "@/components/ideas/IdeasFeed";

export default function IdeasPage() {
  const t = useTranslations("ideas");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">{t("title")}</h1>
      <IdeasFeed />
    </div>
  );
}
