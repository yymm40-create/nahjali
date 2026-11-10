/** The living background (three soft colours drifting) and the little chat that plays by itself. */

export function LivingBg() {
  return (
    <div className="cn-bg" aria-hidden>
      <i />
      <i />
      <i />
    </div>
  );
}

export function ChatDemo() {
  return (
    <div className="cn-chat cn-glass" aria-hidden>
      <div className="cn-who">
        <i /> محادثتك في كلاود أو شات جي بي تي
      </div>
      <div className="cn-msg me m1">سو لي كاروسيل عن فضل الصدقة، ٨ شرائح</div>
      <div className="cn-dots">
        <i />
        <i />
        <i />
      </div>
      <div className="cn-msg ai m2">محمد باقر كتب الشرائح، أرسمها؟ السعر يطلع لك قبل</div>
      <div className="cn-msg ai m3">
        ✅ الشرائح جاهزة
        <div className="cn-slides">
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}
