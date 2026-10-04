"use client";

import type { GeneratorDef } from "@config/jawad/types";
import type { Evaluation } from "@/lib/jawad/engine";

/**
 * The prompt, exactly as the user writes it (never rewritten, translated or extended). For speech, the spoken
 * text and the performance description are two separate fields, sent separately.
 */
export default function PromptBox({
  def,
  ev,
  prompt,
  instructions,
  onPrompt,
  onInstructions,
  touched,
  onTouched,
}: {
  def: GeneratorDef;
  ev: Evaluation;
  prompt: string;
  instructions: string;
  onPrompt: (s: string) => void;
  onInstructions: (s: string) => void;
  /** "Write the prompt" is only shown once the field was used (never as an error on a fresh page). */
  touched: boolean;
  onTouched: () => void;
}) {
  const promptIssue = touched || prompt ? ev.issues.find((i) => i.field === "prompt")?.message : undefined;
  const instrIssue = ev.issues.find((i) => i.field === "instructions")?.message;
  const optional = !ev.mode.promptRequired;
  return (
    <section className="space-y-3">
      <div>
        <label htmlFor="jw-prompt" className="jw-label flex items-center justify-between">
          <span>
            {def.prompt.label} {optional && <span className="text-jw-faint">(اختياري مع المراجع)</span>}
          </span>
          <span className={`tabular-nums ${prompt.length > def.prompt.max ? "text-jw-danger" : "text-jw-faint"}`} dir="ltr">{prompt.length}/{def.prompt.max}</span>
        </label>
        <textarea
          id="jw-prompt"
          dir="auto"
          rows={5}
          value={prompt}
          onChange={(e) => onPrompt(e.target.value)}
          onBlur={onTouched}
          placeholder={def.prompt.placeholder}
          className={`jw-textarea min-h-[132px] ${promptIssue ? "jw-invalid" : ""}`}
          aria-invalid={Boolean(promptIssue)}
          aria-describedby={promptIssue ? "jw-prompt-issue" : undefined}
        />
        {!def.prompt.arabic && def.prompt.arabicNote && !promptIssue && <p className="mt-1 text-[11px] text-jw-faint">{def.prompt.arabicNote}</p>}
        {promptIssue && <p id="jw-prompt-issue" className="mt-1.5 text-xs text-jw-danger" role="alert">{promptIssue}</p>}
      </div>
      {def.extraText && (
        <div>
          <label htmlFor="jw-instr" className="jw-label flex items-center justify-between">
            <span>{def.extraText.label}</span>
            <span className="tabular-nums text-jw-faint" dir="ltr">{instructions.length}/{def.extraText.max}</span>
          </label>
          <textarea
            id="jw-instr"
            dir="auto"
            rows={2}
            value={instructions}
            onChange={(e) => onInstructions(e.target.value)}
            placeholder={def.extraText.placeholder}
            className={`jw-textarea ${instrIssue ? "jw-invalid" : ""}`}
          />
          <p className="mt-1 text-[11px] text-jw-faint">يُرسل منفصلًا عن النص المنطوق، ولا يُقرأ بصوت.</p>
          {instrIssue && <p className="mt-1.5 text-xs text-jw-danger" role="alert">{instrIssue}</p>}
        </div>
      )}
    </section>
  );
}
