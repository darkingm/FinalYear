/**
 * AI Service — unified gateway to the Python AI microservice.
 *
 * All methods use the safeCall wrapper so callers get { data, error }
 * and never receive unhandled exceptions.
 *
 * Base URL: EXPO_PUBLIC_AI_URL (e.g. http://103.20.96.79:3005)
 */
import { apiClient } from '../api/client';
import { safeCall } from '../utils/api';
import { cache } from '../utils/cache';
import type {
  AIDescriptionResult,
  DynamicPricingSuggestion,
  FraudScore,
} from '../types';

const AI_URL = process.env.EXPO_PUBLIC_AI_URL || 'http://103.20.96.79:3005';

/** Low-level fetch to AI service (inherits JWT from apiClient interceptors) */
async function aiPost<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${AI_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Forward auth token if needed by AI backend
      ...(global.__jwt_token ? { Authorization: `Bearer ${global.__jwt_token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(err.message || `AI Service error: ${res.status}`);
  }
  return res.json();
}

async function aiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${AI_URL}${path}`);
  if (!res.ok) throw new Error(`AI Service error: ${res.status}`);
  return res.json();
}

// ─── AI Service API ───────────────────────────────────────────────────────────
export const aiService = {
  /**
   * Generate product description from an image URI + optional hint text.
   * Used in the product creation flow.
   */
  async generateDescription(imageUri: string, hints: { category?: string; name?: string } = {}) {
    return safeCall<AIDescriptionResult>(
      async () => {
        // Upload image as base64 or multipart — here we send the URI for the backend to fetch
        const result = await aiPost<AIDescriptionResult>('/api/ai/describe-product', {
          image_uri: imageUri,
          category_hint: hints.category ?? '',
          name_hint: hints.name ?? '',
        });
        return result;
      },
      { tag: 'aiService.generateDescription', fallback: undefined },
    );
  },

  /**
   * AI dynamic pricing suggestion: analyses market + comparable products.
   * Cached 15 minutes to avoid hammering the AI service.
   */
  async suggestPrice(params: {
    category: string;
    name: string;
    condition?: 'new' | 'used' | 'refurbished';
    existing_price_usd?: number;
  }) {
    const cacheKey = `ai:pricing:${params.category}:${params.name.slice(0, 20)}`;
    return safeCall<DynamicPricingSuggestion>(
      () => cache.getOrFetch(
        cacheKey,
        async () => {
          const result = await aiPost<DynamicPricingSuggestion>('/api/ai/suggest-price', params);
          return result;
        },
        15 * 60 * 1000,
      ),
      { tag: 'aiService.suggestPrice', fallback: undefined },
    );
  },

  /**
   * Fraud detection check on a user/order.
   * HIGH and CRITICAL scores should trigger admin alerts.
   */
  async getFraudScore(params: { user_id: number; order_id?: number }) {
    return safeCall<FraudScore>(
      async () => aiPost('/api/ai/fraud-check', params),
      { tag: 'aiService.getFraudScore', fallback: undefined },
    );
  },

  /**
   * Real-time sentiment analysis of a chat conversation.
   * Returns tone: positive | neutral | negative
   */
  async analyzeSentiment(messages: { role: string; content: string }[]) {
    return safeCall<{ tone: 'positive' | 'neutral' | 'negative'; score: number }>(
      async () => aiPost('/api/ai/sentiment', { messages }),
      { tag: 'aiService.analyzeSentiment', fallback: { tone: 'neutral' as const, score: 0.5 } },
    );
  },
};

// Expose JWT globally so aiPost can attach it (set in auth-store login)
declare global {
  var __jwt_token: string | undefined;
}
