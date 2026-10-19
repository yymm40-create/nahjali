"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMahdi } from "@/components/mahdi/Provider";
import { groupProjects } from "@/lib/mahdi/client/derive";
import { t } from "@/lib/mahdi/i18n";

/** A group's habit opened from my day («g:<id>»): its group's program. */
export default function GroupHabitPage() {
  const { hid } = useParams<{ hid: string }>();
  const router = useRouter();
  const { state, allHabits } = useMahdi();
  useEffect(() => {
    const habit = allHabits.find((h) => h.id === `g:${hid}`);
    const project = habit && groupProjects(state.snap).find((p) => p.id === habit.projectId);
    router.replace(project ? `/mahdi/groups/${project.groupId}?tab=program` : "/mahdi/groups");
  }, [hid, allHabits, state.snap, router]);
  return <p className="m-muted">{t.common.loading}</p>;
}
