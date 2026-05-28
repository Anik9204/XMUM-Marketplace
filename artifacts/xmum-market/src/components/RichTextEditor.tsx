import React, { useRef, useCallback } from "react";
import { Bold, Italic, Type } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  autoFocus?: boolean;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something...",
  maxLength = 3500,
  className = "",
  autoFocus = false,
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wrapSelection = useCallback(
    (marker: string) => {
      const el = textareaRef.current;
      if (!el) return;

      const start = el.selectionStart;
      const end = el.selectionEnd;
      const selected = value.slice(start, end);

      if (!selected) {
        const before = value.slice(0, start);
        const after = value.slice(end);
        const insert = `${marker}${marker}`;
        const newVal = before + insert + after;
        if (newVal.length > maxLength) return;
        onChange(newVal);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(start + marker.length, start + marker.length);
        });
        return;
      }

      const before = value.slice(0, start);
      const after = value.slice(end);
      const alreadyWrapped = before.endsWith(marker) && after.startsWith(marker);

      if (alreadyWrapped) {
        const newVal =
          before.slice(0, before.length - marker.length) +
          selected +
          after.slice(marker.length);
        onChange(newVal);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(start - marker.length, end - marker.length);
        });
      } else {
        const newVal = before + marker + selected + marker + after;
        if (newVal.length > maxLength) return;
        onChange(newVal);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(start + marker.length, end + marker.length);
        });
      }
    },
    [value, onChange, maxLength]
  );

  const handleBold = () => wrapSelection("**");
  const handleItalic = () => wrapSelection("*");
  const handleLarge = () => wrapSelection("++");

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value.slice(0, maxLength));
  };

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
      <textarea
        ref={textareaRef}
        autoFocus={autoFocus}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="flex-1 w-full resize-none bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 text-sm leading-relaxed placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none px-3 py-3 min-h-[180px] rounded-b-xl"
        spellCheck
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
