export {
  buildDocumentOutline,
  countOutlineItems,
  findNodeTrail,
} from "@ainx/hylo-core";
export type { OutlineItem, NodeTrailItem } from "@ainx/hylo-core";

export function isUsableHtmlClipboard(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return /<[a-z][a-z0-9-]*(?:\s[^<>]*?)?\s*\/?\s*>/i.test(trimmed);
}

export function normalizeHtmlClipboard(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:html?)?\s*\n?([\s\S]*?)\n?```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}
