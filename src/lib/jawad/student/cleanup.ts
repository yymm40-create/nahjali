// «الطالب الذكي» — projects are deleted 30 days after their last activity, with their files (the daily cron).

import { STUDENT } from "@config/jawad/student";
import { removeFolder, sdb } from "./db";
import { advanceJobs } from "./jobs";

export async function studentSweep() {
  const before = new Date(Date.now() - STUDENT.keepDays * 86400_000).toISOString();
  const { data } = await sdb().from("student_projects").select("id,user_id").lt("last_activity_at", before).limit(200);
  let removed = 0;
  for (const p of (data ?? []) as { id: string; user_id: string }[]) {
    await removeFolder(`${p.user_id}/${p.id}`);
    await sdb().from("student_projects").delete().eq("id", p.id);
    removed++;
  }
  // unfinished work nobody is watching moves on too
  await advanceJobs({}, 20);
  return removed;
}
