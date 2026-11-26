"use client";

// «خطتي» and «أدخلها في عاداتي»: the plan's pages of «الصحة العلوية», on the shared state (HealthProvider). Their
// views are in the link: /mahdi/health/plan?edit=1 (the table being edited), /mahdi/health/habits?done=<project>.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMahdi } from "@/components/mahdi/Provider";
import { setupHref } from "@/lib/mahdi/health/route";
import { Barbell, PlanSummary, PlanView, ToHabits } from "./HealthApp";
import { useHealth } from "./HealthProvider";
import { useView } from "./useView";

function NoPlan() {
  return (
    <section className="gym-hero space-y-3">
      <Barbell />
      <h1 className="gym-title">ما عندك <em>خطة</em> للحين</h1>
      <p className="gym-small">جاوب على كم سؤال وأسوي لك جدولك ونظامك الغذائي.</p>
      <Link href={setupHref()} className="gym-btn primary">
        يلا نبدأ
      </Link>
    </section>
  );
}

export function PlanPage() {
  const router = useRouter();
  const view = useView();
  const { plan, save } = useHealth();
  if (!plan) return <NoPlan />;
  return (
    <div className="space-y-4">
      <PlanSummary
        plan={plan}
        onOpen={() => document.getElementById("plan-view")?.scrollIntoView({ behavior: "smooth" })}
        onHabits={() => router.push("/mahdi/health/habits")}
        onEdit={() => router.push(setupHref("track"))}
      />
      <div id="plan-view">
        <PlanView
          plan={plan}
          save={save}
          edit={view.get("edit") === "1"}
          setEdit={(on) => view.set({ edit: on })}
          onHabits={() => router.push("/mahdi/health/habits")}
          onHome={() => router.push("/mahdi/health")}
        />
      </div>
    </div>
  );
}

export function HabitsPage() {
  const router = useRouter();
  const view = useView();
  const { state, store, toast } = useMahdi();
  const { plan, save } = useHealth();
  if (!plan) return <NoPlan />;
  const done = view.get("done");
  return (
    <ToHabits
      plan={plan}
      projects={state.snap.projects.filter((x) => !x.archivedAt)}
      back={() => router.push("/mahdi/health/plan")}
      done={done && /^[0-9a-f-]{36}$/i.test(done) ? done : null}
      setDone={(id) => view.set({ done: id })}
      apply={async (body) => {
        try {
          const r = await store.mutate<{ made: number; projectId: string; links: Record<string, string> }>("/api/mahdi/health/apply", "POST", { plan, ...body });
          // the habits made are remembered with the plan: what is tracked here fills them
          save({ ...plan, links: { ...(plan.links ?? {}), ...(r.links ?? {}) } });
          toast(`تمت إضافة ${r.made} عادة`);
          return r.projectId;
        } catch (e) {
          toast((e as Error).message);
          return null;
        }
      }}
    />
  );
}
