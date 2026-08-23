export const RICH_TEXT_VERSION = 1 as const;

export type RichTextMark = "bold" | "italic" | "underline";

export type RichTextInline = {
  text: string;
  marks?: RichTextMark[];
  href?: string;
};

export type RichTextBlock =
  | { type: "paragraph" | "heading2" | "heading3" | "blockquote"; children: RichTextInline[] }
  | { type: "bulletList" | "orderedList"; items: RichTextInline[][] };

export type RichTextDocument = {
  version: typeof RICH_TEXT_VERSION;
  type: "rich-text";
  blocks: RichTextBlock[];
};

const blockTypes = new Set(["paragraph", "heading2", "heading3", "blockquote", "bulletList", "orderedList"]);
const markTypes = new Set<RichTextMark>(["bold", "italic", "underline"]);
const MAX_BLOCKS = 240;
const MAX_INLINES = 500;

export const emptyRichTextDocument = (): RichTextDocument => ({ version: RICH_TEXT_VERSION, type: "rich-text", blocks: [] });

export function isRichTextDocument(value: unknown): value is RichTextDocument {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && (value as { version?: unknown }).version === RICH_TEXT_VERSION && (value as { type?: unknown }).type === "rich-text" && Array.isArray((value as { blocks?: unknown }).blocks));
}

export function normalizeRichText(value: unknown, options: { required?: boolean; maxCharacters?: number; label?: string } = {}): RichTextDocument {
  const label = options.label || "Conținutul";
  let input: unknown = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) input = emptyRichTextDocument();
    else {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        input = isRichTextDocument(parsed) ? parsed : documentFromPlainText(value);
      } catch {
        input = documentFromPlainText(value);
      }
    }
  }
  if (!isRichTextDocument(input)) throw new Error(`${label}: document rich-text invalid.`);
  if (input.blocks.length > MAX_BLOCKS) throw new Error(`${label}: sunt permise maximum ${MAX_BLOCKS} de blocuri.`);
  const blocks = input.blocks.map((block, index) => normalizeBlock(block, `${label}, blocul ${index + 1}`));
  const document: RichTextDocument = { version: RICH_TEXT_VERSION, type: "rich-text", blocks };
  const plain = richTextToPlainText(document);
  if (plain.length > (options.maxCharacters ?? 30_000)) throw new Error(`${label}: textul este prea lung.`);
  if (options.required && !plain) throw new Error(`${label}: adaugă text.`);
  return document;
}

function normalizeBlock(value: unknown, label: string): RichTextBlock {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}: bloc invalid.`);
  const block = value as Record<string, unknown>;
  if (!blockTypes.has(String(block.type))) throw new Error(`${label}: tip de bloc neacceptat.`);
  if (block.type === "bulletList" || block.type === "orderedList") {
    if (!Array.isArray(block.items) || block.items.length > MAX_INLINES) throw new Error(`${label}: listă invalidă.`);
    return { type: block.type, items: block.items.map((item, index) => normalizeInlines(item, `${label}, elementul ${index + 1}`)) };
  }
  if (!["paragraph", "heading2", "heading3", "blockquote"].includes(String(block.type))) throw new Error(`${label}: tip de bloc neacceptat.`);
  return { type: block.type as "paragraph" | "heading2" | "heading3" | "blockquote", children: normalizeInlines(block.children, label) };
}

function normalizeInlines(value: unknown, label: string): RichTextInline[] {
  if (!Array.isArray(value) || value.length > MAX_INLINES) throw new Error(`${label}: text structurat invalid.`);
  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${label}, fragmentul ${index + 1}: invalid.`);
    const inline = raw as Record<string, unknown>;
    const text = typeof inline.text === "string" ? inline.text.replaceAll(String.fromCharCode(0), "") : "";
    if (text.length > 8_000) throw new Error(`${label}, fragmentul ${index + 1}: text prea lung.`);
    const marks = Array.isArray(inline.marks) ? Array.from(new Set(inline.marks.map(String))) : [];
    if (marks.some(mark => !markTypes.has(mark as RichTextMark))) throw new Error(`${label}, fragmentul ${index + 1}: formatare neacceptată.`);
    const href = inline.href == null || inline.href === "" ? undefined : safeRichTextHref(String(inline.href));
    if (inline.href && !href) throw new Error(`${label}, fragmentul ${index + 1}: legătură nesigură.`);
    return { text, ...(marks.length ? { marks: marks as RichTextMark[] } : {}), ...(href ? { href } : {}) };
  });
}

export function serializeRichText(value: unknown, options?: { required?: boolean; maxCharacters?: number; label?: string }): string {
  return JSON.stringify(normalizeRichText(value, options));
}

export function documentFromPlainText(value: string): RichTextDocument {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n");
  const blocks = normalized.split(/\n{2,}/).map(part => part.trim()).filter(Boolean).map<RichTextBlock>(part => ({
    type: "paragraph",
    children: [{ text: part }],
  }));
  return { version: RICH_TEXT_VERSION, type: "rich-text", blocks };
}

export function richTextToPlainText(value: unknown): string {
  const document = isRichTextDocument(value) ? value : normalizeRichText(value);
  return document.blocks.map(block => {
    if ("items" in block) return block.items.map(inlineText).filter(Boolean).join("\n");
    return inlineText(block.children);
  }).filter(Boolean).join("\n\n").replace(/[ \t]+\n/g, "\n").trim();
}

export function richTextExcerpt(value: unknown, maxLength = 155): string {
  const plain = richTextToPlainText(value).replace(/\s+/g, " ").trim();
  if (plain.length <= maxLength) return plain;
  const shortened = plain.slice(0, Math.max(1, maxLength - 1));
  const boundary = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, boundary > maxLength * 0.6 ? boundary : shortened.length).trimEnd()}…`;
}

export function richTextIsMeaningful(value: unknown): boolean {
  return Boolean(richTextToPlainText(value));
}

export function safeRichTextHref(value: string): string | null {
  const input = value.trim();
  if (!input || input.includes("\\")) return null;
  if (input.startsWith("/") && !input.startsWith("//")) {
    try {
      const url = new URL(input, "https://blaj-azi.local");
      return url.origin === "https://blaj-azi.local" ? `${url.pathname}${url.search}${url.hash}` : null;
    } catch { return null; }
  }
  try {
    const url = new URL(input);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:" ? url.toString() : null;
  } catch { return null; }
}

export function richTextToEditorHtml(value: unknown): string {
  const document = normalizeRichText(value);
  return document.blocks.map(block => {
    if ("items" in block) {
      const tag = block.type === "bulletList" ? "ul" : "ol";
      return `<${tag}>${block.items.map(item => `<li>${inlinesHtml(item)}</li>`).join("")}</${tag}>`;
    }
    const tag = block.type === "heading2" ? "h2" : block.type === "heading3" ? "h3" : block.type === "blockquote" ? "blockquote" : "p";
    return `<${tag}>${inlinesHtml(block.children) || "<br>"}</${tag}>`;
  }).join("");
}

function inlineText(inlines: RichTextInline[]) {
  return inlines.map(inline => inline.text).join("").replace(/\s+/g, " ").trim();
}

function inlinesHtml(inlines: RichTextInline[]) {
  return inlines.map(inline => {
    let output = escapeHtml(inline.text).replace(/\n/g, "<br>");
    for (const mark of inline.marks || []) output = mark === "bold" ? `<strong>${output}</strong>` : mark === "italic" ? `<em>${output}</em>` : `<u>${output}</u>`;
    if (inline.href) output = `<a href="${escapeHtml(inline.href)}">${output}</a>`;
    return output;
  }).join("");
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
