"use client";
import { useParams } from "next/navigation";
import { redirect } from "next/navigation";
import { useLocale } from "next-intl";

export default function IdeaRedirect() {
  const params = useParams();
  const locale = useLocale();
  redirect(`/${locale}/projects/${params.id}`);
}
