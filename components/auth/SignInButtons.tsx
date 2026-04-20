"use client";

import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function SignInButtons() {
  const t = useTranslations("auth");

  return (
    <div className="flex flex-col gap-3">
      <Button
        onClick={() => signIn("github")}
        className="w-full bg-gray-900 text-white hover:bg-gray-800"
        size="lg"
      >
        {t("continueGithub")}
      </Button>
      <Button
        onClick={() => signIn("google")}
        variant="outline"
        size="lg"
        className="w-full"
      >
        {t("continueGoogle")}
      </Button>
    </div>
  );
}
