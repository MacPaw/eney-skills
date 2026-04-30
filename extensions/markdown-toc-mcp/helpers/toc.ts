export interface Heading {
  level: number;
  text: string;
  slug: string;
}

const HEADING_RE = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function extractHeadings(markdown: string, minLevel: number, maxLevel: number): Heading[] {
  const lines = markdown.split(/\r?\n/);
  const headings: Heading[] = [];
  const slugCounts = new Map<string, number>();
  let inFence = false;
  for (const line of lines) {
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = line.match(HEADING_RE);
    if (!match) continue;
    const level = match[1].length;
    if (level < minLevel || level > maxLevel) continue;
    const text = match[2].trim();
    const baseSlug = slugify(text) || "section";
    const used = slugCounts.get(baseSlug) ?? 0;
    const slug = used === 0 ? baseSlug : `${baseSlug}-${used}`;
    slugCounts.set(baseSlug, used + 1);
    headings.push({ level, text, slug });
  }
  return headings;
}

export function renderToc(headings: Heading[], indentSpaces: number): string {
  if (!headings.length) return "";
  const minLevel = Math.min(...headings.map((h) => h.level));
  const indent = " ".repeat(Math.max(0, indentSpaces));
  return headings
    .map((h) => `${indent.repeat(h.level - minLevel)}- [${h.text}](#${h.slug})`)
    .join("\n");
}
