import { promises as fs } from "fs";
import path from "path";

export interface TemplateSlot {
  pose: string;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
}

export interface Template {
  id: string;
  name: string;
  page_size_mm: { width: number; height: number };
  poses: string[];
  pages: { file: string; slots: TemplateSlot[] }[];
}

// Templates are plain folders: /templates/<id>/template.json + pages/*.png
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
