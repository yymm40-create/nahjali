/** «لأجل المهدي» — a drawn loading screen (the plan of 26 November 2026: never a bare «جارٍ التحميل»). */
export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-label="لحظة، نجهّز الصفحة">
      <div className="m-skel h-9 w-2/5" />
      <div className="m-skel h-40" />
      <div className="grid grid-cols-2 gap-3">
        <div className="m-skel h-24" />
        <div className="m-skel h-24" />
      </div>
      <div className="m-skel h-16" />
      <div className="m-skel h-16" />
    </div>
  );
}
