"use client";

// «خطتي» and «أدخلها في عاداتي»: the plan's pages of «الصحة العلوية», on the shared state (HealthProvider).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMahdi } from "@/components/mahdi/Provider";
import { Barbell, PlanSummary, PlanView, ToHabits } from "./HealthApp";
import { useHealth } from "./HealthProvider";

function NoPlan() {
  return (
    <section className="gym-hero space-y-3">
      <Barbell />
      <h1 className="gym-title">ما عندك <em>خطة</em> للحين</h1>
      <p className="gym-small">جاوب على كم سؤال وأسوي لك جدولك ونظامك الغذائي.</p>
      <Link href="/mahdi/health/setup" className="gym-btn">يلا نبدأ 💪</Link>
    </section>
  );
}

export function PlanPage() {
  const router = useRouter();
  const { plan, save, setStep } = useHealth();
  if (!plan) return <NoPlan />;
  return (
    <div className="space-y-4">
      <PlanSummary
        plan={plan}
        onOpen={() => document.getElementById("plan-view")?.scrollIntoView({ behavior: "smooth" })}
        onHabits={() => router.push("/mahdi/health/habits")}
        onEdit={() => {
          setStep("track");
          router.push("/mahdi/health/setup");
        }}
      />
      <div id="plan-view">
        <PlanView plan={plan} save={save} onHabits={() => router.push("/mahdi/health/habits")} onHome={() => router.push("/mahdi/health")} />
      </div>
    </div>
  );
}

export function HabitsPage() {
  const router = useRouter();
  const { state, store, toast } = useMahdi();
  const { plan, save } = useHealth();
  if (!plan) return <NoPlan />;
  return (
    <ToHabits
      plan={plan}
      projects={state.snap.projects.filter((x) => !x.archivedAt)}
      back={() => router.push("/mahdi/health/plan")}
      apply={async (body) => {
        try {
          const r = await store.mutate<{ made: number; projectId: string; links: Record<string, string> }>("/api/mahdi/health/apply", "POST", { plan, ...body });
          // the habits made are remembered with the plan: what is tracked here fills them
          save({ ...plan, links: { ...(plan.links ?? {}), ...(r.links ?? {}) } });
          toast(`تمت إضافة ${r.made} عادة 💪`);
          return r.projectId;
        } catch (e) {
          toast((e as Error).message);
          return null;
        }
      }}
    />
  );
}
