"use client";

import { useState } from "react";
import { postJson } from "@/lib/fetch";

/** "رأيك يهمنا": star rating + comment, sent to the owner's dashboard. */
export default function FeedbackForm({ orderId }: { orderId?: string }) {
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function send() {
    setState("sending");
    setError("");
    try {
      await postJson("/api/feedback", { rating, message, orderId });
      setState("sent");
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  }

  if (state === "sent") {
    return <div className="card p-5 text-center text-lg font-extrabold">شكرًا لك! رأيك يساعدنا نطوّر الكتيب 💛</div>;
  }

  return (
    <div className="card space-y-4 p-5">
      <h2 className="display text-2xl">رأيك يهمنا ✨</h2>
      <p className="font-bold text-muted">الموقع تحت التجربة، وملاحظاتك تفرق معنا كثير.</p>
      <div className="flex justify-center gap-2" role="radiogroup" aria-label="التقييم">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} من ٥`}
            onClick={() => setRating(n)}
            className={`text-4xl transition ${n <= rating ? "scale-110" : "opacity-30 grayscale"}`}
          >
            ⭐
          </button>
        ))}
      </div>
      <textarea
        className="field min-h-28 resize-none"
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
        placeholder="وش عجبك؟ وش تبينا نحسّن أو نضيف؟"
      />
      {error && <p className="error-box">{error}</p>}
      <button className="btn btn-primary w-full" onClick={send} disabled={!rating || state === "sending"}>
        {state === "sending" ? "نرسل…" : "أرسل رأيي"}
      </button>
    </div>
  );
}
