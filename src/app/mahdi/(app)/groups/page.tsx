"use client";

import { t } from "@/lib/mahdi/i18n";
import GroupsHome from "@/components/mahdi/GroupsHome";

/** «إخوة الولاية»: private groups with their own closed ranking. */
export default function GroupsPage() {
  return (
    <div className="space-y-6">
      <h1 className="m-display text-3xl">{t.groups.title}</h1>
      <GroupsHome />
    </div>
  );
}
