import {
  ProductAcceptedTokenInput,
  ProductAcceptedTokenView,
  ProductImageView,
  ProductReadModel,
} from './products.types';
import { buildAcceptedTokenRows } from './products.pricing';

function parseUnknownArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function mapAcceptedTokens(rawAcceptedTokens: unknown): ProductAcceptedTokenView[] {
  const rawTokens = parseUnknownArray<ProductAcceptedTokenInput>(rawAcceptedTokens);
  const normalized = buildAcceptedTokenRows({ acceptedTokens: rawTokens });

  return normalized.map((token) => {
    const source = rawTokens.find((raw) => raw.token_id === token.token_id && normalizeSymbol(raw.symbol) === token.symbol);
    return {
      ...token,
      chain_id: source?.chain_id ?? null,
      chain_name: source?.chain_name ?? null,
      decimals: source?.decimals ?? null,
      token_address: source?.token_address ?? null,
      logo_symbol: token.symbol,
    };
  });
}

function normalizeSymbol(symbol: unknown): string {
  return String(symbol ?? '').trim().toUpperCase();
}

export function mapProductImages(rawImages: unknown, primaryImage?: string | null): ProductImageView[] {
  const images = parseUnknownArray<string | ProductImageView>(rawImages);
  const normalized = images
    .map((image, index) => {
      if (typeof image === 'string') {
        return {
          url: image,
          sort_order: index,
          is_primary: image === primaryImage || index === 0,
        };
      }

      const url = String(image?.url ?? '').trim();
      if (!url) return null;

      return {
        url,
        sort_order: Number.isFinite(image.sort_order) ? image.sort_order : index,
        is_primary: Boolean(image.is_primary) || url === primaryImage,
      };
    })
    .filter((image): image is ProductImageView => Boolean(image));

  if (normalized.length === 0 && primaryImage) {
    return [{ url: primaryImage, sort_order: 0, is_primary: true }];
  }

  if (normalized.length > 0 && !normalized.some((image) => image.is_primary)) {
    normalized[0].is_primary = true;
  }

  return normalized.sort((a, b) => a.sort_order - b.sort_order);
}

export function mapProductListRow<T extends Record<string, unknown>>(row: T): T & ProductReadModel {
  const accepted_tokens = mapAcceptedTokens(row.accepted_tokens);
  const images = mapProductImages(row.images, (row.primary_image as string | null | undefined) ?? null);

  return {
    ...row,
    accepted_tokens,
    images,
    primary_image: ((row.primary_image as string | null | undefined) ?? images[0]?.url ?? null),
    token_symbol: (row.token_symbol as string | null | undefined) ?? accepted_tokens[0]?.symbol ?? null,
  };
}

export function mapProductDetailRow<T extends Record<string, unknown>>(row: T): T & ProductReadModel {
  const accepted_tokens = mapAcceptedTokens(row.accepted_tokens);
  const images = mapProductImages(row.images, (row.primary_image as string | null | undefined) ?? null);

  return {
    ...row,
    accepted_tokens,
    images,
    primary_image: ((row.primary_image as string | null | undefined) ?? images[0]?.url ?? null),
    token_symbol: (row.token_symbol as string | null | undefined) ?? accepted_tokens[0]?.symbol ?? null,
  };
}
