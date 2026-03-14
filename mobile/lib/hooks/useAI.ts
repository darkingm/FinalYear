/**
 * Reusable hooks for Tier 4 AI features.
 *
 * useAIDescription  — product image → AI-generated name/description/tags
 * useDynamicPricing — category/name → AI price suggestion
 * useFraudScore     — user/order → risk score (admin use)
 */
import { useState, useCallback } from 'react';
import { aiService } from '../services/ai.service';
import type { AIDescriptionResult, DynamicPricingSuggestion, FraudScore } from '../types';

// ─── AI Description Hook ──────────────────────────────────────────────────────
interface UseAIDescriptionResult {
  result: AIDescriptionResult | undefined;
  generating: boolean;
  error: string | null;
  generate: (imageUri: string, hints?: { category?: string; name?: string }) => Promise<void>;
  reset: () => void;
}

export function useAIDescription(): UseAIDescriptionResult {
  const [result, setResult] = useState<AIDescriptionResult | undefined>();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (imageUri: string, hints = {}) => {
    setGenerating(true);
    setError(null);
    const { data, error: err } = await aiService.generateDescription(imageUri, hints);
    setResult(data);
    if (err) setError(err);
    setGenerating(false);
  }, []);

  const reset = useCallback(() => {
    setResult(undefined);
    setError(null);
  }, []);

  return { result, generating, error, generate, reset };
}

// ─── Dynamic Pricing Hook ─────────────────────────────────────────────────────
interface UseDynamicPricingResult {
  suggestion: DynamicPricingSuggestion | undefined;
  loading: boolean;
  error: string | null;
  suggest: (params: {
    category: string;
    name: string;
    condition?: 'new' | 'used' | 'refurbished';
    existing_price_usd?: number;
  }) => Promise<void>;
}

export function useDynamicPricing(): UseDynamicPricingResult {
  const [suggestion, setSuggestion] = useState<DynamicPricingSuggestion | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggest = useCallback(async (params: Parameters<typeof aiService.suggestPrice>[0]) => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await aiService.suggestPrice(params);
    setSuggestion(data);
    if (err) setError(err);
    setLoading(false);
  }, []);

  return { suggestion, loading, error, suggest };
}

// ─── Fraud Score Hook ─────────────────────────────────────────────────────────
interface UseFraudScoreResult {
  score: FraudScore | undefined;
  loading: boolean;
  error: string | null;
  check: (user_id: number, order_id?: number) => Promise<void>;
}

export function useFraudScore(): UseFraudScoreResult {
  const [score, setScore] = useState<FraudScore | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async (user_id: number, order_id?: number) => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await aiService.getFraudScore({ user_id, order_id });
    setScore(data);
    if (err) setError(err);
    setLoading(false);
  }, []);

  return { score, loading, error, check };
}
