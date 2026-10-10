import { promises as fs } from "fs";
import path from "path";

export interface TemplateSlot {
  pose: string;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  /** Draw on top of the overlay (e.g. inside a picture frame or sticker ring), without a floor shadow */
  front?: boolean;
}

/** Text written per order, e.g. the child's name. `{name}` is replaced at compose time. */
export interface TemplateText {
  value: string;
  font: "display" | "body" | "title" | "hand";
  color: string;
  stroke: string | null;
  /** Optional lettering effect: "epic" (3D gold titles), "3d" (navy) or "gold" */
  effect?: "epic" | "3d" | "gold" | "sticker" | null;
  /** Wrap onto several centered lines that fill the box (speech bubbles, messages) */
  wrap?: boolean;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
}

export interface TemplatePage {
  /** Background scene key: templates/<id>/scenes/<scene>.jpg (same for every art style) */
  scene: string | null;
  /** Finished full-page artwork (replaces scene + overlay), e.g. "pages/cover.jpg" */
  background?: string | null;
  /** Transparent text/frames layer drawn on top of the scene and the child */
  overlay: string;
  slots: TemplateSlot[];
  texts: TemplateText[];
  /** A page drawn by code (a designed booklet of tables): its shapes layer and its background, as SVG */
  overlaySvg?: string;
  sceneSvg?: string;
}

export interface Template {
  id: string;
  name: string;
  page_size_mm: { width: number; height: number };
  poses: string[];
  scenes: string[];
  pages: TemplatePage[];
}

// Templates are plain folders: /templates/<id>/template.json + overlays/ + scenes/
const TEMPLATES_DIR = path.join(process.cwd(), "templates");
const SAFE_ID = /^[a-z0-9-]+$/;

export async function listTemplates(): Promise<Template[]> {
  const entries = await fs.readdir(TEMPLATES_DIR, { withFileTypes: true });
  const ids = entries.filter((e) => e.isDirectory() && SAFE_ID.test(e.name)).map((e) => e.name);
  const templates = await Promise.all(ids.map((id) => getTemplate(id)));
  return templates.filter((t): t is Template => t !== null);
}

export async function getTemplate(id: string): Promise<Template | null> {
  if (!SAFE_ID.test(id)) return null;
  try {
    const raw = await fs.readFile(path.join(TEMPLATES_DIR, id, "template.json"), "utf8");
    return JSON.parse(raw) as Template;
  } catch {
    return null;
  }
}

export function templateFilePath(templateId: string, file: string) {
  const resolved = path.join(TEMPLATES_DIR, templateId, file);
  if (!resolved.startsWith(path.join(TEMPLATES_DIR, templateId) + path.sep)) throw new Error("Invalid template path");
  return resolved;
}
