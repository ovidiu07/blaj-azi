"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, Quote, Redo2, RemoveFormatting, Underline, Undo2 } from "lucide-react";
import {
  emptyRichTextDocument,
  normalizeRichText,
  richTextToPlainText,
  richTextToEditorHtml,
  safeRichTextHref,
  serializeRichText,
  type RichTextDocument,
  type RichTextInline,
  type RichTextMark,
} from "../rich-text";

export function RichTextRenderer({ value, document: inputDocument, className = "rich-text" }: { value?: unknown; document?: unknown; className?: string }) {
  const document = normalizeRichText(inputDocument ?? value ?? "");
  if (!document.blocks.length) return null;
  return <div className={className}>{document.blocks.map((block, index) => {
    if ("items" in block) {
      const children = block.items.map((item, itemIndex) => <li key={itemIndex}><Inlines value={item} /></li>);
      return block.type === "bulletList" ? <ul key={index}>{children}</ul> : <ol key={index}>{children}</ol>;
    }
    const children = <Inlines value={block.children} />;
    if (block.type === "heading2") return <h2 key={index}>{children}</h2>;
    if (block.type === "heading3") return <h3 key={index}>{children}</h3>;
    if (block.type === "blockquote") return <blockquote key={index}>{children}</blockquote>;
    return <p key={index}>{children}</p>;
  })}</div>;
}

function Inlines({ value }: { value: RichTextInline[] }) {
  return <>{value.map((inline, index) => {
    let content: React.ReactNode = inline.text;
    for (const mark of inline.marks || []) content = mark === "bold" ? <strong>{content}</strong> : mark === "italic" ? <em>{content}</em> : <u>{content}</u>;
    if (inline.href) {
      const external = /^https?:/i.test(inline.href);
      content = <a href={inline.href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>{content}</a>;
    }
    return <span key={index}>{content}</span>;
  })}</>;
}

type RichTextEditorProps = {
  name: string;
  label: string;
  description: string;
  defaultValue?: unknown;
  required?: boolean;
  disabled?: boolean;
  maxCharacters?: number;
  error?: string;
};

export function RichTextEditor({ name, label, description, defaultValue = emptyRichTextDocument(), required = false, disabled = false, maxCharacters = 30_000, error }: RichTextEditorProps) {
  const id = useId();
  const editor = useRef<HTMLDivElement>(null);
  const [richDocument, setRichDocument] = useState(() => normalizeRichText(defaultValue));
  const [activeFormats, setActiveFormats] = useState<Set<string>>(() => new Set());
  const initialHtml = useRef(richTextToEditorHtml(richDocument));
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const characterCount = richTextToPlainText(richDocument).length;
  useEffect(() => { if (editor.current) editor.current.innerHTML = initialHtml.current; }, []);
  useEffect(() => {
    function refreshFromSelection() {
      if (editor.current) setActiveFormats(readActiveFormats(editor.current));
    }
    document.addEventListener("selectionchange", refreshFromSelection);
    return () => document.removeEventListener("selectionchange", refreshFromSelection);
  }, []);

  function refreshFormats() {
    if (editor.current) setActiveFormats(readActiveFormats(editor.current));
  }

  function update() {
    if (!editor.current) return;
    setRichDocument(documentFromEditor(editor.current));
    refreshFormats();
  }

  function command(name: string, value?: string) {
    editor.current?.focus();
    window.document.execCommand(name, false, value);
    update();
    window.requestAnimationFrame(refreshFormats);
  }

  function addLink() {
    const selection = window.getSelection()?.toString();
    if (!selection) return;
    const requested = window.prompt("Introdu adresa legăturii (HTTP, HTTPS, e-mail sau cale internă):", "https://");
    if (requested == null) return;
    const href = safeRichTextHref(requested);
    if (!href) { window.alert("Legătura nu este sigură. Folosește HTTP, HTTPS, e-mail sau o cale internă."); return; }
    command("createLink", href);
  }

  return <div className={`rte-field ${error ? "has-error" : ""}`}>
    <label id={`${id}-label`} htmlFor={`${id}-editor`}>{label}{required && <span aria-hidden="true"> *</span>}</label>
    <p id={descriptionId} className="field-help">{description}</p>
    <div className="rte-shell">
      <div className="rte-toolbar" role="toolbar" aria-label={`Formatare pentru ${label}`}>
        <ToolbarButton disabled={disabled} label="Aldin" icon={<Bold />} pressed={activeFormats.has("bold")} onClick={() => command("bold")} />
        <ToolbarButton disabled={disabled} label="Cursiv" icon={<Italic />} pressed={activeFormats.has("italic")} onClick={() => command("italic")} />
        <ToolbarButton disabled={disabled} label="Subliniat" icon={<Underline />} pressed={activeFormats.has("underline")} onClick={() => command("underline")} />
        <ToolbarButton disabled={disabled} label="Titlu nivel 2" text="H2" pressed={activeFormats.has("heading2")} onClick={() => command("formatBlock", "h2")} />
        <ToolbarButton disabled={disabled} label="Titlu nivel 3" text="H3" pressed={activeFormats.has("heading3")} onClick={() => command("formatBlock", "h3")} />
        <ToolbarButton disabled={disabled} label="Listă cu marcatori" icon={<List />} pressed={activeFormats.has("bulletList")} onClick={() => command("insertUnorderedList")} />
        <ToolbarButton disabled={disabled} label="Listă numerotată" icon={<ListOrdered />} pressed={activeFormats.has("orderedList")} onClick={() => command("insertOrderedList")} />
        <ToolbarButton disabled={disabled} label="Citat" icon={<Quote />} pressed={activeFormats.has("blockquote")} onClick={() => command("formatBlock", "blockquote")} />
        <ToolbarButton disabled={disabled} label="Adaugă legătură" icon={<LinkIcon />} pressed={activeFormats.has("link")} onClick={addLink} />
        <ToolbarButton disabled={disabled} label="Elimină legătura" icon={<RemoveFormatting />} onClick={() => command("unlink")} />
        <ToolbarButton disabled={disabled} label="Anulează" icon={<Undo2 />} onClick={() => command("undo")} />
        <ToolbarButton disabled={disabled} label="Refă" icon={<Redo2 />} onClick={() => command("redo")} />
      </div>
      <div
        id={`${id}-editor`}
        ref={editor}
        className="rte-editor"
        contentEditable={!disabled}
        role="textbox"
        tabIndex={disabled ? -1 : 0}
        aria-multiline="true"
        aria-required={required}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ""}`}
        aria-invalid={Boolean(error)}
        data-placeholder="Scrie aici…"
        onInput={update}
        onBlur={update}
        onKeyUp={refreshFormats}
        onMouseUp={refreshFormats}
        onPaste={event => {
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain");
          window.document.execCommand("insertText", false, text);
          update();
        }}
        suppressContentEditableWarning
      />
    </div>
    <input type="hidden" name={name} value={serializeRichText(richDocument)} />
    <span className={`rte-count ${characterCount > maxCharacters ? "error-message" : ""}`} aria-live="polite">{characterCount.toLocaleString("ro-RO")} / {maxCharacters.toLocaleString("ro-RO")} caractere</span>
    {error && <p id={errorId} className="error-message" role="alert">{error}</p>}
  </div>;
}

function ToolbarButton({ label, icon, text, onClick, disabled = false, pressed }: { label: string; icon?: React.ReactNode; text?: string; onClick: () => void; disabled?: boolean; pressed?: boolean }) {
  return <button type="button" disabled={disabled} title={label} aria-label={label} aria-pressed={pressed} onMouseDown={event => event.preventDefault()} onClick={onClick}>{icon}{text && <span>{text}</span>}<span className="rte-button-label">{label}</span></button>;
}

function readActiveFormats(root: HTMLElement) {
  const selection = window.getSelection();
  const anchor = selection?.anchorNode;
  if (!anchor || !root.contains(anchor)) return new Set<string>();
  const active = new Set<string>();
  const commands: Array<[string, string]> = [
    ["bold", "bold"], ["italic", "italic"], ["underline", "underline"],
    ["bulletList", "insertUnorderedList"], ["orderedList", "insertOrderedList"],
  ];
  for (const [format, command] of commands) {
    try { if (document.queryCommandState(command)) active.add(format); } catch { /* unsupported command state */ }
  }
  try {
    const block = String(document.queryCommandValue("formatBlock")).toLowerCase().replace(/[<>]/g, "");
    if (block === "h2") active.add("heading2");
    if (block === "h3") active.add("heading3");
    if (block === "blockquote") active.add("blockquote");
  } catch { /* unsupported block state */ }
  const element = anchor.nodeType === Node.ELEMENT_NODE ? anchor as Element : anchor.parentElement;
  if (element?.closest("a")) active.add("link");
  return active;
}

function documentFromEditor(root: HTMLElement): RichTextDocument {
  const blocks: RichTextDocument["blocks"] = [];
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text.trim()) blocks.push({ type: "paragraph", children: [{ text }] });
      continue;
    }
    if (!(node instanceof HTMLElement)) continue;
    const tag = node.tagName.toLowerCase();
    if (tag === "ul" || tag === "ol") {
      const items = Array.from(node.children).filter(child => child.tagName.toLowerCase() === "li").map(child => collectInlines(child));
      blocks.push({ type: tag === "ul" ? "bulletList" : "orderedList", items });
      continue;
    }
    blocks.push({
      type: tag === "h2" ? "heading2" : tag === "h3" ? "heading3" : tag === "blockquote" ? "blockquote" : "paragraph",
      children: collectInlines(node),
    });
  }
  return normalizeRichText({ version: 1, type: "rich-text", blocks });
}

function collectInlines(root: Node): RichTextInline[] {
  const result: RichTextInline[] = [];
  function visit(node: Node, marks: RichTextMark[] = [], href?: string) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text) result.push({ text, ...(marks.length ? { marks: Array.from(new Set(marks)) } : {}), ...(href ? { href } : {}) });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName.toLowerCase();
    if (tag === "br") { result.push({ text: "\n", ...(marks.length ? { marks } : {}), ...(href ? { href } : {}) }); return; }
    const nextMarks = [...marks];
    if (tag === "strong" || tag === "b") nextMarks.push("bold");
    if (tag === "em" || tag === "i") nextMarks.push("italic");
    if (tag === "u") nextMarks.push("underline");
    const nextHref = tag === "a" ? safeRichTextHref(node.getAttribute("href") || "") || undefined : href;
    for (const child of Array.from(node.childNodes)) visit(child, nextMarks, nextHref);
  }
  visit(root);
  return result;
}
