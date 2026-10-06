"use client";

import { Component, type ReactNode } from "react";

/**
 * Keeps one part of the editor from taking the whole page down: if it fails while drawing, that part alone shows
 * what went wrong (so it can be reported) and a button to try again. The rest of the editor keeps working.
 */
export default class Guard extends Component<{ name: string; children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`editor ${this.props.name}`, error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="m-3 space-y-2 rounded-xl border border-jw-danger/40 bg-jw-danger/10 p-3 text-sm" role="alert">
        <p className="font-semibold text-jw-danger">تعطّل هذا الجزء ({this.props.name})، والباقي شغال وأعمالك محفوظة.</p>
        <p className="break-words text-[11px] text-jw-muted" dir="ltr">{String(error.message || error).slice(0, 300)}</p>
        <button type="button" className="jw-btn !min-h-8 text-xs" onClick={() => this.setState({ error: null })}>
          حاول مرة ثانية
        </button>
      </div>
    );
  }
}
