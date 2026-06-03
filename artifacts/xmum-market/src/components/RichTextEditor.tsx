import React, { useRef, useCallback, useEffect } from "react";
import { Bold, Italic, Type } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  autoFocus?: boolean;
}

// ── Markdown ↔ HTML conversion ──────────────────────────────────────────────

function markdownToHtml(md: string): string {
  // Process line-by-line so block structure is preserved
  const lines = md.split("\n");
  const htmlLines = lines.map((line) => {
    // Escape HTML special chars first
    let out = line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    // ++large++
    out = out.replace(/\+\+(.+?)\+\+/g, '<span class="rte-large">$1</span>');
    // **bold**
    out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // *italic* (single asterisk, not double)
    out = out.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
    return out;
  });
  return htmlLines.join("<br>");
}

function htmlToMarkdown(el: HTMLElement): string {
  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? "";
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const elem = node as HTMLElement;
    const tag = elem.tagName.toLowerCase();
    const inner = Array.from(elem.childNodes).map(walk).join("");

    if (tag === "strong" || tag === "b") return `**${inner}**`;
    if (tag === "em" || tag === "i") return `*${inner}*`;
    if (tag === "span" && elem.classList.contains("rte-large"))
      return `++${inner}++`;
    if (tag === "br") return "\n";
    if (tag === "div" || tag === "p") {
      const prev = elem.previousSibling;
      const prefix =
        prev && (prev as HTMLElement).tagName !== "BR" ? "\n" : "";
      return prefix + inner;
    }
    return inner;
  }
  return Array.from(el.childNodes).map(walk).join("");
}

// ── Caret utilities ──────────────────────────────────────────────────────────

function getTextLength(el: HTMLElement): number {
  return (el.textContent ?? "").length;
}

function placeCaretAt(el: HTMLElement, offset: number): void {
  const range = document.createRange();
  const sel = window.getSelection();
  if (!sel) return;

  let remaining = offset;
  let found = false;

  function traverse(node: Node): void {
    if (found) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent ?? "").length;
      if (remaining <= len) {
        range.setStart(node, remaining);
        range.collapse(true);
        found = true;
      } else {
        remaining -= len;
      }
    } else {
      for (const child of Array.from(node.childNodes)) {
        traverse(child);
        if (found) return;
      }
    }
  }

  traverse(el);
  if (!found) {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

function readMarkdown(el: HTMLElement): string {
  return htmlToMarkdown(el);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something...",
  maxLength = 3500,
  className = "",
  autoFocus = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastSetValueRef = useRef<string>(value);
  const isComposingRef = useRef(false);

  // Sync external value → DOM (only when value changed from outside)
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value === lastSetValueRef.current) return;
    lastSetValueRef.current = value;
    const sel = window.getSelection();
    let caretOffset = 0;
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      // preserve caret by counting text offset
      const range = sel.getRangeAt(0);
      const pre = range.cloneRange();
      pre.selectNodeContents(el);
      pre.setEnd(range.startContainer, range.startOffset);
      caretOffset = pre.toString().length;
    }
    el.innerHTML = markdownToHtml(value);
    try {
      placeCaretAt(el, caretOffset);
    } catch {
      // non-critical
    }
  }, [value]);

  // Initial render
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = markdownToHtml(value);
    if (autoFocus) {
      el.focus();
      placeCaretAt(el, getTextLength(el));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInput = useCallback(() => {
    if (isComposingRef.current) return;
    const el = editorRef.current;
    if (!el) return;
    const md = readMarkdown(el);
    if (md.length > maxLength) return;
    lastSetValueRef.current = md;
    onChange(md);
  }, [onChange, maxLength]);

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
    handleInput();
  }, [handleInput]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      const el = editorRef.current;
      if (!el) return;
      const current = readMarkdown(el);
      const sel = window.getSelection();
      let insertAt = current.length;
      if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        const pre = range.cloneRange();
        pre.selectNodeContents(el);
        pre.setEnd(range.startContainer, range.startOffset);
        insertAt = pre.toString().length;
      }
      const newMd = (current.slice(0, insertAt) + text + current.slice(insertAt)).slice(0, maxLength);
      lastSetValueRef.current = newMd;
      el.innerHTML = markdownToHtml(newMd);
      onChange(newMd);
      try {
        placeCaretAt(el, insertAt + text.length);
      } catch {
        // non-critical
      }
    },
    [onChange, maxLength]
  );

  // ── Toolbar actions ────────────────────────────────────────────────────────
  const handleBold = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
    el.focus();
    document.execCommand("bold", false);
    // execCommand('bold') can insert <b> tags — htmlToMarkdown handles both <b> and <strong>
    // Trigger handleInput to sync the new DOM state back to markdown
    handleInput();
  }, [handleInput]);

  const handleItalic = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
    el.focus();
    document.execCommand("italic", false);
    handleInput();
  }, [handleInput]);

  const handleLarge = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const selectedText = sel.toString();
    if (!selectedText.trim()) return;

    // Read current markdown to check toggle state
    const currentMd = readMarkdown(el);
    const selIdx = currentMd.indexOf(selectedText);
    if (selIdx === -1) return;

    const before = currentMd.slice(0, selIdx);
    const after = currentMd.slice(selIdx + selectedText.length);
    const alreadyWrapped = before.endsWith("++") && after.startsWith("++");

    let newMd: string;
    if (alreadyWrapped) {
      newMd =
        before.slice(0, before.length - 2) + selectedText + after.slice(2);
    } else {
      newMd = before + "++" + selectedText + "++" + after;
      if (newMd.length > maxLength) return;
    }

    lastSetValueRef.current = newMd;
    el.innerHTML = markdownToHtml(newMd);
    onChange(newMd);

    el.focus();
    const caretPos = alreadyWrapped
      ? selIdx + selectedText.length
      : selIdx + 2 + selectedText.length + 2;
    try {
      placeCaretAt(el, caretPos);
    } catch {
      /* non-critical */
    }
  }, [onChange, maxLength]);

  return (
    <div className={`flex flex-col gap-0 ${className}`}>
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 rounded-t-xl">
        <ToolbarButton
          onClick={handleBold}
          title="Bold (wraps selected text in **)"
          label={<Bold size={14} strokeWidth={2.5} />}
        />
        <ToolbarButton
          onClick={handleItalic}
          title="Italic (wraps selected text in *)"
          label={<Italic size={14} strokeWidth={2} />}
        />
        <div className="w-px h-4 bg-gray-200 dark:bg-slate-600 mx-1" />
        <ToolbarButton
          onClick={handleLarge}
          title="Large text (wraps selected text in ++)"
          label={
            <span className="flex items-center gap-0.5">
              <Type size={11} strokeWidth={2} />
              <span className="text-[9px] font-bold leading-none">A</span>
            </span>
          }
        />
        <div className="flex-1" />
        <span className="text-[10px] text-gray-400 dark:text-slate-500 hidden sm:block pr-1">
          Select text, then tap a button to format
        </span>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className="flex-1 w-full bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 text-sm leading-relaxed focus:outline-none px-3 py-3 min-h-[180px] rounded-b-xl overflow-y-auto whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:dark:text-slate-500 empty:before:pointer-events-none [&_.rte-large]:text-base [&_.rte-large]:font-medium"
      />
    </div>
  );
}

function ToolbarButton({
  onClick,
  title,
  label,
}: {
  onClick: () => void;
  title: string;
  label: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-sm font-bold"
    >
      {label}
    </button>
  );
}
