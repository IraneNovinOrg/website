"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { Member } from "@/types";

export default function MembersSection() {
  const t = useTranslations("home");
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    fetch("/api/members")
      .then((r) => r.json())
      .then((data) => setMembers((data.members || []).slice(0, 20)))
      .catch(() => {});
  }, []);

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">{t("peopleBuilding")}</h2>

      <div className="mb-4 flex flex-wrap gap-2">
        {members.map((m) => (
          <Avatar key={m.login} className="h-10 w-10 border-2 border-white">
            <AvatarImage src={m.avatarUrl} alt={m.name || m.login} />
            <AvatarFallback>{m.login[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/members"
          className="text-sm font-medium text-primary hover:underline"
        >
          {t("viewAllMembers")} &rarr;
        </Link>
        <Button asChild size="sm" className="bg-primary text-white hover:bg-primary/90">
          <Link href="/join">{t("joinCommunity")}</Link>
        </Button>
      </div>
    </div>
  );
}
