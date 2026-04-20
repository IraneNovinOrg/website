"use client";

import { useTranslations } from "next-intl";
import { CATEGORIES } from "@/lib/constants";
import { resolveEmoji } from "@/lib/emoji-map";

interface CategoryFilterProps {
  selected: string;
  onChange: (category: string) => void;
}

export default function CategoryFilter({
  selected,
  onChange,
}: CategoryFilterProps) {
  const t = useTranslations("categories");

  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
            selected === cat.id
              ? "bg-iran-green text-white shadow-iran-green"
              : "border border-iran-green/20 bg-iran-green/5 text-iran-deep-green hover:bg-iran-green/10 hover:border-iran-green/40 dark:bg-iran-green/10 dark:text-iran-bright-green dark:hover:bg-iran-green/20"
          }`}
        >
          <span className="text-current">{resolveEmoji(cat.emoji)}</span>
          {t(cat.label)}
        </button>
      ))}
    </div>
  );
}
