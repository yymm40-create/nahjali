import { ExerciseView } from "@/components/mahdi/health/LearnView";

/** One exercise: how to do it right, the muscles it works, and the person's record in it. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExerciseView id={id} />;
}
