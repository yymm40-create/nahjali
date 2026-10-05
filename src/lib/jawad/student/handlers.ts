// «الطالب الذكي» — every kind of job and the code that runs it.

import { extractHandler } from "./extract";
import type { Handler } from "./jobs";
import { finalHandler, planHandler, reviseHandler, styleHandler, trialHandler } from "./outputs";
import { picturesHandler } from "./pictures";
import { researchHandler } from "./research";
import { understandHandler } from "./understand";

export const HANDLERS: Record<string, Handler> = {
  extract: extractHandler,
  understand: understandHandler,
  research: researchHandler,
  plan: planHandler,
  trial: trialHandler,
  final: finalHandler,
  revise: reviseHandler,
  style: styleHandler,
  pictures: picturesHandler,
};
