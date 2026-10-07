/** A part of JAWAD AI that «السماح» hasn't opened for this account. */
export default function SectionClosed({ icon, name }: { icon: string; name: string }) {
  return (
    <div className="mx-auto max-w-md space-y-3 px-4 py-20 text-center">
      <p className="text-5xl" aria-hidden>{icon}</p>
      <h1 className="text-2xl font-extrabold">«{name}» قيد التطوير</h1>
      <p className="font-bold text-jw-muted">مفتوح حاليًا لحسابات محددة. نبلّغك أول ما يفتح للجميع إن شاء الله.</p>
    </div>
  );
}
