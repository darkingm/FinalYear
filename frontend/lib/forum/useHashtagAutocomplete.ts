'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { searchTokenPairs } from '@/lib/whale-api';
import type { TokenPair } from '@/store/whale-tracker-store';

/**
 * Track the user's caret inside a <textarea>/<input> and, whenever the
 * substring ending at the caret looks like an in-progress hashtag
 * (`$BT`, `#et`...), kick off a debounced DexScreener search and expose
 * the top suggestions for the consumer to render.
 *
 * The match window starts at the most recent `$` or `#` that follows a
 * word boundary (start of string OR whitespace). The query stops at the
 * caret — so typing inside an already-finished tag like `$BTC|abc` will
 * NOT trigger again (`abc` is past the word boundary the parser uses).
 *
 * Consumer wiring:
 *   const ac = useHashtagAutocomplete(value, setValue, ref);
 *   <textarea
 *     ref={ref}
 *     value={value}
 *     onChange={e => ac.onChange(e.target.value, e.target.selectionStart)}
 *     onSelect={e => ac.onSelect((e.target as any).selectionStart)}
 *     onKeyDown={ac.onKeyDown}
 *   />
 *   {ac.open && <SuggestionList items={ac.suggestions} onPick={ac.accept} />}
 */

const TAG_PATTERN = /(?:^|\s)([$#])([A-Za-z][A-Za-z0-9]{0,9})$/;
const DEBOUNCE_MS = 250;
const MAX_SUGGESTIONS = 6;

export interface HashtagSuggestion {
  symbol: string;
  name: string;
  /** May be empty string if no logo on DexScreener; consumer falls back to placeholder. */
  logo: string;
  /** e.g. "BSC", "ETH" */
  chain: string;
  liquidity: number;
}

interface AutocompleteState {
  open: boolean;
  query: string;
  loading: boolean;
  suggestions: HashtagSuggestion[];
  /** Currently highlighted index for keyboard nav. -1 = none. */
  highlight: number;
}

const EMPTY: AutocompleteState = { open: false, query: '', loading: false, suggestions: [], highlight: -1 };

export function useHashtagAutocomplete(
  value: string,
  setValue: (next: string) => void,
  inputRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>,
) {
  const [state, setState] = useState<AutocompleteState>(EMPTY);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep the most recent caret position the consumer reported. We need
  // it both to know where to splice on accept() and to recompute the
  // query when value/caret change.
  const caretRef = useRef(value.length);

  // ── Recompute query whenever value / caret changes ───────────────────
  const recompute = useCallback((next: string, caret: number) => {
    caretRef.current = caret;
    const before = next.slice(0, caret);
    const m = before.match(TAG_PATTERN);
    if (!m) {
      setState((s) => (s.open ? EMPTY : s));
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
      return;
    }
    const partial = m[2]; // "BT" in "$BT"
    setState((s) => ({ ...s, open: true, query: partial, loading: partial.length >= 1, highlight: 0 }));

    // Need at least 1 char to bother hitting the API. Cancel any in-flight
    // timer so an old query doesn't overwrite a fresher one.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (partial.length < 1) {
      setState((s) => ({ ...s, suggestions: [], loading: false }));
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchTokenPairs(partial);
        // Dedupe by uppercase symbol — keep the highest-liquidity per symbol.
        // DexScreener returns one row per pair so the same symbol can show up
        // many times across chains; the suggestion list is more useful with
        // 1 entry per symbol.
        const byBest = new Map<string, TokenPair>();
        for (const p of results) {
          if (!p.baseToken?.symbol) continue;
          const sym = p.baseToken.symbol.toUpperCase();
          const cur = byBest.get(sym);
          if (!cur || (p.liquidity ?? 0) > (cur.liquidity ?? 0)) byBest.set(sym, p);
        }
        // Prefer pairs whose symbol STARTS WITH the typed prefix, then by
        // liquidity desc.
        const upPartial = partial.toUpperCase();
        const all = Array.from(byBest.values());
        const ranked = all.sort((a, b) => {
          const aStart = a.baseToken.symbol.toUpperCase().startsWith(upPartial) ? 0 : 1;
          const bStart = b.baseToken.symbol.toUpperCase().startsWith(upPartial) ? 0 : 1;
          if (aStart !== bStart) return aStart - bStart;
          return (b.liquidity ?? 0) - (a.liquidity ?? 0);
        }).slice(0, MAX_SUGGESTIONS);

        const suggestions: HashtagSuggestion[] = ranked.map((p) => ({
          symbol: p.baseToken.symbol.toUpperCase(),
          name: p.baseToken.name || p.baseToken.symbol,
          logo: p.imageUrl || '',
          chain: p.chain,
          liquidity: p.liquidity ?? 0,
        }));
        setState((s) => (s.open ? { ...s, suggestions, loading: false } : s));
      } catch {
        setState((s) => ({ ...s, suggestions: [], loading: false }));
      }
    }, DEBOUNCE_MS);
  }, []);

  // Re-run when external value updates (e.g. user pastes)
  useEffect(() => {
    // We only recompute if the caret reference is past the end (often the
    // case after programmatic setValue). Otherwise wait for the next user
    // input event which calls onChange/onSelect explicitly.
    if (caretRef.current > value.length) caretRef.current = value.length;
  }, [value]);

  // ── Public API ──────────────────────────────────────────────────────
  const onChange = useCallback((next: string, caret: number) => {
    setValue(next);
    recompute(next, caret);
  }, [setValue, recompute]);

  const onSelect = useCallback((caret: number) => {
    recompute(value, caret);
  }, [value, recompute]);

  const close = useCallback(() => {
    setState(EMPTY);
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
  }, []);

  /** Replace the in-progress hashtag with the chosen symbol + a trailing space. */
  const accept = useCallback((symbol: string) => {
    const caret = caretRef.current;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const m = before.match(TAG_PATTERN);
    if (!m) { close(); return; }
    const sigil = m[1]; // $ or #
    // Position where the partial tag (sigil + chars) starts
    const tagStart = caret - (m[1].length + m[2].length);
    const insertion = `${sigil}${symbol.toUpperCase()} `;
    const next = value.slice(0, tagStart) + insertion + after;
    setValue(next);
    close();

    // After React re-renders, push the caret to right after the inserted text.
    const newCaret = tagStart + insertion.length;
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        try { el.setSelectionRange(newCaret, newCaret); } catch { /* input may not support */ }
      }
    });
  }, [value, setValue, close, inputRef]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!state.open || state.suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setState((s) => ({ ...s, highlight: Math.min(s.highlight + 1, s.suggestions.length - 1) }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setState((s) => ({ ...s, highlight: Math.max(s.highlight - 1, 0) }));
    } else if ((e.key === 'Enter' || e.key === 'Tab') && state.highlight >= 0) {
      e.preventDefault();
      const pick = state.suggestions[state.highlight];
      if (pick) accept(pick.symbol);
    } else if (e.key === 'Escape') {
      close();
    }
  }, [state, accept, close]);

  return {
    open: state.open && state.suggestions.length > 0,
    loading: state.loading,
    query: state.query,
    suggestions: state.suggestions,
    highlight: state.highlight,
    setHighlight: (i: number) => setState((s) => ({ ...s, highlight: i })),
    accept,
    close,
    onChange,
    onSelect,
    onKeyDown,
  };
}
