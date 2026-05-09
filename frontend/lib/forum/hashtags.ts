/**
 * Hashtag parsing for forum posts.
 *
 * Syntax: `$BTC` or `#BTC` — a dollar/hash sign followed by 2–10 chars
 * of uppercase letters or digits. The pattern is intentionally tight so
 * we don't accidentally match things like USD prices ("$100") or hex
 * substrings ("$abc"). Symbols are returned uppercase regardless of how
 * the author typed them.
 *
 * Returns an array of segments — either {type: 'text'} or
 * {type: 'tag', symbol}. Render with that shape so React can keep the
 * markup minimal and stable for keys.
 */

export interface HashtagSegment {
  type: 'text' | 'tag';
  text: string;
  /** Uppercase symbol (only set when type === 'tag') */
  symbol?: string;
}

const HASHTAG_RE = /(?:^|\s)([$#])([A-Za-z][A-Za-z0-9]{1,9})\b/g;

export function parseHashtags(input: string | null | undefined): HashtagSegment[] {
  if (!input) return [];
  const text = String(input);
  const segments: HashtagSegment[] = [];
  let lastIdx = 0;

  // We use exec instead of matchAll so we can track the leading whitespace
  // captured by the lookbehind alternative `(?:^|\s)`.
  HASHTAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = HASHTAG_RE.exec(text)) !== null) {
    const fullStart = match.index;
    const fullEnd = HASHTAG_RE.lastIndex;
    // The capture starts at fullStart + (1 if there's a leading whitespace),
    // but we want to keep that whitespace as plain text so it shows up with
    // its original layout.
    const leadingWhitespace = match[0].startsWith(' ') || match[0].startsWith('\n') || match[0].startsWith('\t') ? 1 : 0;
    const tagStart = fullStart + leadingWhitespace;
    const tagText = text.slice(tagStart, fullEnd);
    const symbol = match[2].toUpperCase();

    if (tagStart > lastIdx) {
      segments.push({ type: 'text', text: text.slice(lastIdx, tagStart) });
    }
    segments.push({ type: 'tag', text: tagText, symbol });
    lastIdx = fullEnd;
  }
  if (lastIdx < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIdx) });
  }
  return segments;
}

/** Extract just the unique uppercase symbols (no positional info). */
export function extractHashtagSymbols(input: string | null | undefined): string[] {
  return Array.from(new Set(parseHashtags(input).filter(s => s.type === 'tag').map(s => s.symbol!)));
}
