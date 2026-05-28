import React from "react";

export interface RichSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  large?: boolean;
}

export function stripRichText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/\*(.+?)\*/gs, "$1")
    .replace(/\+\+(.+?)\+\+/gs, "$1");
}

export function parseRichText(text: string): RichSegment[] {
  const segments: RichSegment[] = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|\+\+(.+?)\+\+)/gs;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }
    const full = match[0];
    if (full.startsWith("**")) {
      segments.push({ text: match[2], bold: true });
    } else if (full.startsWith("++")) {
      segments.push({ text: match[4], large: true });
    } else {
      segments.push({ text: match[3], italic: true });
    }
    lastIndex = re.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments;
}

export function RichTextDisplay({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}): React.ReactElement {
  const segments = parseRichText(text);

  return (
    <p className={`whitespace-pre-wrap leading-relaxed ${className}`}>
      {segments.map((seg, i) => {
        if (seg.bold && seg.italic) {
          return <strong key={i}><em>{seg.text}</em></strong>;
        }
        if (seg.bold) return <strong key={i} className="font-semibold">{seg.text}</strong>;
        if (seg.italic) return <em key={i}>{seg.text}</em>;
        if (seg.large) return <span key={i} className="text-base font-medium">{seg.text}</span>;
        return <React.Fragment key={i}>{seg.text}</React.Fragment>;
      })}
    </p>
  );
}
