import { query } from '../../config/database';
import { setCache, getCache, deleteCache } from '../../config/redis';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';
import { mapProductDetailRow, mapProductListRow, mapProductImages } from './products.mapper';
import { buildAcceptedTokenRows } from './products.pricing';
import {
  ProductAcceptedTokenInput,
  ProductAcceptedTokenRow,
  ProductImageView,
} from './products.types';

type QueryableClient = {
  query: (text: string, params?: any[]) => Promise<{ rows: any[] }>;
};

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeSymbol(symbol: unknown): string {
  return String(symbol ?? '').trim().toUpperCase();
}

function normalizePrice(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function hasAcceptedTokenPayload(data: any): boolean {
  return Boolean(
    Array.isArray(data?.accepted_tokens) ||
    Array.isArray(data?.metadata?.accepted_tokens) ||
    Array.isArray(data?.metadata?.accepted_tokens?.crypto) ||
    (isRecord(data?.pricing) && Object.keys(data.pricing).length > 0) ||
    (isRecord(data?.metadata?.pricing) && Object.keys(data.metadata.pricing).length > 0) ||
    data?.token_id ||
    data?.price_in_token
  );
}

function hasImagePayload(data: any): boolean {
  return Boolean(Array.isArray(data?.images) || Array.isArray(data?.metadata?.images));
}

function getPricingSnapshot(data: any): Record<string, string> {
  const rawPricing = isRecord(data?.pricing) ? data.pricing : (isRecord(data?.metadata?.pricing) ? data.metadata.pricing : {});
  return Object.entries(rawPricing).reduce((acc, [symbol, amount]) => {
    const normalized = normalizePrice(amount);
    const key = normalizeSymbol(symbol);
    if (normalized && key) {
      acc[key] = normalized;
    }
    return acc;
  }, {} as Record<string, string>);
}

function getRawAcceptedTokenEntries(data: any): Array<string | ProductAcceptedTokenInput> {
  if (Array.isArray(data?.accepted_tokens)) return data.accepted_tokens;
  if (Array.isArray(data?.metadata?.accepted_tokens)) return data.metadata.accepted_tokens;
  if (Array.isArray(data?.metadata?.accepted_tokens?.crypto)) return data.metadata.accepted_tokens.crypto;
  return [];
}

async function loadTokenCatalogBySymbols(client: QueryableClient, symbols: string[]) {
  if (symbols.length === 0) return new Map<string, any>();

  const result = await client.query(
    `SELECT DISTINCT ON (UPPER(symbol))
        token_id,
        UPPER(symbol) AS symbol,
        chain_id,
        decimals,
        token_address,
        metadata->>'name' AS name,
        metadata->>'chain' AS chain_name
     FROM token_whitelist
     WHERE is_active = TRUE
       AND UPPER(symbol) = ANY($1::text[])
     ORDER BY UPPER(symbol), token_id`,
    [symbols]
  );

  return new Map<string, any>(result.rows.map((row) => [normalizeSymbol(row.symbol), row]));
}

async function resolveAcceptedTokenInputs(client: QueryableClient, data: any): Promise<ProductAcceptedTokenInput[]> {
  const pricingSnapshot = getPricingSnapshot(data);
  const rawEntries = getRawAcceptedTokenEntries(data);
  const symbolCandidates = new Set<string>();
  const inputs: ProductAcceptedTokenInput[] = [];

  for (const entry of rawEntries) {
    if (typeof entry === 'string') {
      const symbol = normalizeSymbol(entry);
      if (symbol) symbolCandidates.add(symbol);
      continue;
    }

    if (!isRecord(entry)) continue;
    const symbol = normalizeSymbol(entry.symbol);
    const tokenId = entry.token_id ? Number(entry.token_id) : null;
    const price = normalizePrice(entry.amount ?? entry.price_in_token ?? pricingSnapshot[symbol]);
    if (!tokenId && symbol) {
      symbolCandidates.add(symbol);
    }
    inputs.push({
      token_id: tokenId ?? undefined,
      symbol,
      amount: price,
      is_primary: Boolean(entry.is_primary),
      chain_id: entry.chain_id ? Number(entry.chain_id) : undefined,
      chain_name: entry.chain_name ? String(entry.chain_name) : undefined,
      decimals: entry.decimals ? Number(entry.decimals) : undefined,
      token_address: entry.token_address ? String(entry.token_address) : undefined,
    });
  }

  for (const symbol of Object.keys(pricingSnapshot)) {
    if (!inputs.some((entry) => normalizeSymbol(entry.symbol) === symbol)) {
      symbolCandidates.add(symbol);
      inputs.push({
        symbol,
        amount: pricingSnapshot[symbol],
        is_primary: inputs.length === 0,
      });
    }
  }

  const catalog = await loadTokenCatalogBySymbols(client, [...symbolCandidates]);

  return inputs.map((entry, index) => {
    const symbol = normalizeSymbol(entry.symbol);
    const matched = catalog.get(symbol);
    return {
      ...entry,
      token_id: entry.token_id ?? matched?.token_id,
      symbol: symbol || matched?.symbol,
      amount: normalizePrice(entry.amount ?? entry.price_in_token ?? pricingSnapshot[symbol]),
      is_primary: index === 0 ? true : Boolean(entry.is_primary),
      chain_id: entry.chain_id ?? matched?.chain_id,
      chain_name: entry.chain_name ?? matched?.chain_name,
      decimals: entry.decimals ?? matched?.decimals,
      token_address: entry.token_address ?? matched?.token_address,
    };
  });
}

function getNormalizedImagePayload(data: any): ProductImageView[] {
  return mapProductImages(data?.images ?? data?.metadata?.images ?? [], null);
}

function buildMetadataSnapshot(baseMetadata: Record<string, any>, acceptedTokens?: ProductAcceptedTokenRow[], images?: ProductImageView[]) {
  const metadata = { ...baseMetadata };

  if (acceptedTokens) {
    metadata.pricing = Object.fromEntries(acceptedTokens.map((token) => [token.symbol, token.price_in_token]));
    metadata.accepted_tokens = acceptedTokens.map((token) => token.symbol);
  }

  if (images) {
    metadata.images = images.map((image) => image.url);
  }

  return metadata;
}

function getPrimaryLegacyToken(acceptedTokens: ProductAcceptedTokenRow[]) {
  return acceptedTokens.find((token) => token.is_primary) || acceptedTokens[0] || null;
}

async function replaceAcceptedTokens(client: QueryableClient, productId: number, acceptedTokens: ProductAcceptedTokenRow[]) {
  await client.query(`DELETE FROM product_accepted_tokens WHERE product_id = $1`, [productId]);

  for (const token of acceptedTokens) {
    await client.query(
      `INSERT INTO product_accepted_tokens (product_id, token_id, price_in_token, is_primary)
       VALUES ($1, $2, $3, $4)`,
      [productId, token.token_id, token.price_in_token, token.is_primary]
    );
  }
}

async function replaceProductImages(client: QueryableClient, productId: number, images: ProductImageView[]) {
  await client.query(`DELETE FROM product_images WHERE product_id = $1`, [productId]);

  for (const image of images) {
    await client.query(
      `INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
       VALUES ($1, $2, $3, $4)`,
      [productId, image.url, image.sort_order, image.is_primary]
    );
  }
}

export class ProductService {
  async getProducts(filters: any) {
    const { page, limit, category, minPrice, maxPrice, search, acceptsCrypto, tokenSymbol } = filters;
    const pageNum = Math.max(1, page || 1);
    const limitNum = Math.min(100, Math.max(1, limit || 20));
    const offset = (pageNum - 1) * limitNum;

    const whereConditions: string[] = ["p.status = 'active'"];
    const params: any[] = [];
    let paramIndex = 1;

    if (category) {
      whereConditions.push(`p.category = $${paramIndex++}`);
      params.push(category);
    }
    if (minPrice && !isNaN(minPrice)) {
      whereConditions.push(`p.base_price_usd >= $${paramIndex++}`);
      params.push(minPrice);
    }
    if (maxPrice && !isNaN(maxPrice)) {
      whereConditions.push(`p.base_price_usd <= $${paramIndex++}`);
      params.push(maxPrice);
    }
    if (search) {
      whereConditions.push(`(p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (acceptsCrypto) {
      whereConditions.push(`(p.token_id IS NOT NULL OR EXISTS (
        SELECT 1 FROM product_accepted_tokens _pat WHERE _pat.product_id = p.product_id
      ))`);
    }
    // Filter by accepted token — check BOTH new product_accepted_tokens table AND legacy token_id column
    if (tokenSymbol) {
      whereConditions.push(`(
        EXISTS (
          SELECT 1 FROM product_accepted_tokens _pat2
          JOIN token_whitelist _tw2 ON _tw2.token_id = _pat2.token_id
          WHERE _pat2.product_id = p.product_id AND _tw2.symbol ILIKE $${paramIndex}
        )
        OR (p.token_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM token_whitelist _tw3
          WHERE _tw3.token_id = p.token_id AND _tw3.symbol ILIKE $${paramIndex}
        ))
      )`);
      params.push(tokenSymbol);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    const countResult = await query(
      `SELECT COUNT(*) FROM products p WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const limitIdx = paramIndex++;
    const offsetIdx = paramIndex;
    params.push(limitNum, offset);

    // accepted_tokens: aggregate from product_accepted_tokens JOIN table (primary)
    // Also falls back to legacy p.token_id if no rows in product_accepted_tokens
    const acceptedTokensSubquery = `
      (SELECT CASE
        WHEN COUNT(pat.token_id) > 0 THEN
          json_agg(json_build_object(
            'token_id',      tw_acc.token_id,
            'symbol',        tw_acc.symbol,
            'price_in_token',pat.price_in_token,
            'is_primary',    pat.is_primary,
            'chain_id',      tw_acc.chain_id,
            'decimals',      tw_acc.decimals,
            'token_address', tw_acc.token_address
          ) ORDER BY pat.is_primary DESC)
        WHEN p.token_id IS NOT NULL THEN
          json_build_array(json_build_object(
            'token_id',      tw_leg.token_id,
            'symbol',        tw_leg.symbol,
            'price_in_token',p.price_in_token,
            'is_primary',    true,
            'chain_id',      tw_leg.chain_id,
            'decimals',      tw_leg.decimals,
            'token_address', tw_leg.token_address
          ))
        ELSE NULL END
       FROM product_accepted_tokens pat
       JOIN token_whitelist tw_acc ON tw_acc.token_id = pat.token_id
       WHERE pat.product_id = p.product_id)
    `;

    const result = await query(
      `SELECT
         p.*,
         COALESCE(SUM(i.available), 0)        AS stock,
         sp.display_name                       AS seller_name,
         sp.logo_url                           AS seller_avatar,
         sp.slug                               AS seller_slug,
         sp.rating_avg                         AS seller_rating,
         u.avatar_url                          AS seller_user_avatar,
         u.username                            AS seller_username,
         p.created_at                          AS listed_at,
         (SELECT image_url FROM product_images
          WHERE product_id = p.product_id AND is_primary = TRUE LIMIT 1) AS primary_image,
         (SELECT json_agg(image_url ORDER BY sort_order)
          FROM product_images WHERE product_id = p.product_id)           AS images,
         ${acceptedTokensSubquery}                                        AS accepted_tokens,
         tw_leg.symbol                                                    AS token_symbol
       FROM products p
       LEFT JOIN seller_profiles sp ON p.seller_id = sp.seller_id
       LEFT JOIN users u            ON sp.user_id = u.user_id
       LEFT JOIN token_whitelist tw_leg ON p.token_id = tw_leg.token_id
       LEFT JOIN inventory i        ON p.product_id = i.product_id
       WHERE ${whereClause}
       GROUP BY p.product_id, sp.display_name, sp.logo_url, sp.slug, sp.rating_avg,
                u.avatar_url, u.username, tw_leg.symbol, tw_leg.token_id, tw_leg.chain_id,
                tw_leg.decimals, tw_leg.token_address
       ORDER BY p.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    return {
      products: result.rows.map((row) => mapProductListRow(row)),
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    };
  }

  /**
   * Homepage products: max 5 per coin × coins list, up to 20 total.
   * If a coin has < 5 products, fills the gap with products from other coins.
   */
  async getHomepageProducts(coins: string[] = ['BTC', 'ETH', 'BNB', 'SOL', 'USDT', 'USDC', 'MATIC', 'DOGE']) {
    const PER_COIN = 5;
    const MAX_TOTAL = 20;

    // Fetch all products that have an accepted token, ordered newest first
    const result = await query(
      `SELECT
         p.product_id, p.name, p.description, p.base_price_usd, p.category, p.status,
         p.metadata, p.created_at,
         COALESCE(SUM(i.available), 0) AS stock,
         sp.display_name AS seller_name,
         sp.slug AS seller_slug,
         sp.rating_avg AS seller_rating,
         (SELECT image_url FROM product_images
          WHERE product_id = p.product_id AND is_primary = TRUE LIMIT 1) AS primary_image,
         json_agg(json_build_object(
           'token_id',      tw.token_id,
           'symbol',        tw.symbol,
           'price_in_token',pat.price_in_token,
           'is_primary',    pat.is_primary,
           'chain_id',      tw.chain_id,
           'decimals',      tw.decimals,
           'token_address', tw.token_address
         ) ORDER BY pat.is_primary DESC) AS accepted_tokens
       FROM products p
       JOIN product_accepted_tokens pat ON pat.product_id = p.product_id
       JOIN token_whitelist tw ON tw.token_id = pat.token_id
       LEFT JOIN seller_profiles sp ON p.seller_id = sp.seller_id
       LEFT JOIN inventory i ON p.product_id = i.product_id
       WHERE p.status = 'active'
       GROUP BY p.product_id, sp.display_name, sp.slug, sp.rating_avg
       ORDER BY p.created_at DESC`,
      []
    );

    const allProducts = result.rows.map((row) => mapProductListRow(row));

    // Group by coin (each product may appear in multiple coins — take primary token)
    const bySymbol: Record<string, any[]> = {};
    for (const p of allProducts) {
      const primaryToken = p.accepted_tokens?.find((t: any) => t.is_primary) || p.accepted_tokens?.[0];
      if (!primaryToken) continue;
      const sym = primaryToken.symbol;
      if (!bySymbol[sym]) bySymbol[sym] = [];
      bySymbol[sym].push(p);
    }

    // Build result: max PER_COIN per requested coin, then fill remaining slots
    const selected: any[] = [];
    const usedIds = new Set<number>();

    // First pass — take up to PER_COIN per coin in requested order
    for (const coin of coins) {
      const coinProds = (bySymbol[coin] || []).filter(p => !usedIds.has(p.product_id)).slice(0, PER_COIN);
      for (const p of coinProds) { selected.push(p); usedIds.add(p.product_id); }
      if (selected.length >= MAX_TOTAL) break;
    }

    // Second pass — fill remaining slots from any coin (if total < MAX_TOTAL)
    if (selected.length < MAX_TOTAL) {
      for (const p of allProducts) {
        if (!usedIds.has(p.product_id)) {
          selected.push(p);
          usedIds.add(p.product_id);
          if (selected.length >= MAX_TOTAL) break;
        }
      }
    }

    return selected.slice(0, MAX_TOTAL);
  }


  async getProductById(productId: number) {
    const cacheKey = `product:${productId}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const acceptedTokensSelect = `
      (
        SELECT CASE
          WHEN COUNT(pat.token_id) > 0 THEN
            json_agg(json_build_object(
              'token_id', tw_acc.token_id,
              'symbol', tw_acc.symbol,
              'name', tw_acc.metadata->>'name',
              'price_in_token', pat.price_in_token,
              'is_primary', pat.is_primary,
              'chain_id', tw_acc.chain_id,
              'chain_name', tw_acc.metadata->>'chain',
              'token_address', tw_acc.token_address,
              'decimals', tw_acc.decimals
            ) ORDER BY pat.is_primary DESC, pat.id ASC)
          WHEN p.token_id IS NOT NULL THEN
            json_build_array(json_build_object(
              'token_id', p.token_id,
              'symbol', tw.symbol,
              'name', tw.metadata->>'name',
              'price_in_token', p.price_in_token,
              'is_primary', true,
              'chain_id', tw.chain_id,
              'chain_name', tw.metadata->>'chain',
              'token_address', tw.token_address,
              'decimals', tw.decimals
            ))
          ELSE NULL END
        FROM product_accepted_tokens pat
        JOIN token_whitelist tw_acc ON tw_acc.token_id = pat.token_id
        WHERE pat.product_id = p.product_id
      )
    `;

    const result = await query(
      `SELECT
         p.*,
         COALESCE(SUM(i.available), 0)        AS stock,
         COALESCE(SUM(i.total_stock), 0)      AS total_stock,
         sp.display_name                       AS seller_name,
         sp.logo_url                           AS seller_avatar,
         sp.slug                               AS seller_slug,
         sp.rating_avg                         AS seller_rating,
         sp.description                        AS seller_description,
         sp.payout_wallet                      AS seller_wallet,
         sp.total_sales                        AS seller_total_sales,
         u.avatar_url                          AS seller_user_avatar,
         u.username                            AS seller_username,
         u.created_at                          AS seller_joined_at,
         p.created_at                          AS listed_at,
         (SELECT image_url FROM product_images
          WHERE product_id = p.product_id AND is_primary = TRUE LIMIT 1) AS primary_image,
         (SELECT json_agg(json_build_object(
            'url', image_url, 'sort_order', sort_order, 'is_primary', is_primary
          ) ORDER BY sort_order)
          FROM product_images WHERE product_id = p.product_id)           AS images,
         ${acceptedTokensSelect}                                         AS accepted_tokens
       FROM products p
       LEFT JOIN seller_profiles sp ON p.seller_id = sp.seller_id
       LEFT JOIN users u            ON sp.user_id = u.user_id
       LEFT JOIN token_whitelist tw ON p.token_id = tw.token_id
       LEFT JOIN inventory i        ON p.product_id = i.product_id
       WHERE p.product_id = $1
       GROUP BY p.product_id, sp.display_name, sp.logo_url, sp.slug, sp.rating_avg,
                sp.description, sp.payout_wallet, sp.total_sales,
                u.avatar_url, u.username, u.created_at, tw.symbol, tw.metadata, tw.chain_id, tw.token_address, tw.decimals`,
      [productId]
    );

    if (result.rows.length === 0) throw new AppError('Product not found', 404);
    const product = mapProductDetailRow(result.rows[0]);
    await setCache(cacheKey, product, 300);
    return product;
  }

  async createProduct(sellerId: number, data: any) {
    const { getClient } = await import('../../config/database');
    const client = await getClient();
    await client.query('BEGIN');
    try {
      const normalizedAcceptedTokens = buildAcceptedTokenRows({
        acceptedTokens: await resolveAcceptedTokenInputs(client, data),
        legacyTokenId: data.token_id ? Number(data.token_id) : null,
        legacyTokenSymbol: data.token_symbol,
        legacyPriceInToken: data.price_in_token,
      });
      const normalizedImages = getNormalizedImagePayload(data);
      const primaryLegacyToken = getPrimaryLegacyToken(normalizedAcceptedTokens);
      const finalMetadata = buildMetadataSnapshot(
        isRecord(data?.metadata) ? data.metadata : {},
        normalizedAcceptedTokens.length > 0 ? normalizedAcceptedTokens : undefined,
        normalizedImages.length > 0 ? normalizedImages : undefined
      );

      const productResult = await client.query(
        `INSERT INTO products
           (seller_id, name, description, category, base_price_usd,
            token_id, price_in_token, metadata, status, product_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9)
         RETURNING *`,
        [
          sellerId,
          data.name,
          data.description || data.name,
          data.category || 'other',
          data.price || data.base_price_usd || 0,
          primaryLegacyToken?.token_id || data.token_id || null,
          primaryLegacyToken?.price_in_token || data.price_in_token || null,
          JSON.stringify(finalMetadata),
          data.product_type || 'physical',
        ]
      );
      const product = productResult.rows[0];

      if (normalizedAcceptedTokens.length > 0) {
        await replaceAcceptedTokens(client, product.product_id, normalizedAcceptedTokens);
      }

      if (normalizedImages.length > 0) {
        await replaceProductImages(client, product.product_id, normalizedImages);
      }

      // Create inventory
      const whResult = await client.query(
        `SELECT warehouse_id FROM warehouses WHERE status = 'active' ORDER BY warehouse_id LIMIT 1`
      );
      const warehouseId = whResult.rows[0]?.warehouse_id;
      if (warehouseId) {
        const stockQty = Math.max(0, parseInt(data.stock) || 0);
        await client.query(
          `INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved)
           VALUES ($1,$2,$3,$3,0)
           ON CONFLICT (product_id, warehouse_id) DO UPDATE
           SET total_stock = EXCLUDED.total_stock, available = EXCLUDED.available`,
          [product.product_id, warehouseId, stockQty]
        );
      }

      await client.query('COMMIT');
      await deleteCache('explore_default');
      logger.info('Product created', { product_id: product.product_id, seller_id: sellerId });
      return this.getProductById(product.product_id);
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Create product error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateProduct(productId: number, userId: number, updates: any) {
    const sellerRes = await query('SELECT seller_id FROM seller_profiles WHERE user_id = $1', [userId]);
    if (sellerRes.rows.length === 0) throw new AppError('Seller profile not found', 403);
    const sellerId = sellerRes.rows[0].seller_id;

    const productResult = await query('SELECT * FROM products WHERE product_id = $1', [productId]);
    if (productResult.rows.length === 0) throw new AppError('Product not found', 404);
    const currentProduct = productResult.rows[0];
    if (currentProduct.seller_id !== sellerId) throw new AppError('Not authorized', 403);

    const { getClient } = await import('../../config/database');
    const client = await getClient();
    await client.query('BEGIN');

    try {
      const normalizedAcceptedTokens = buildAcceptedTokenRows({
        acceptedTokens: await resolveAcceptedTokenInputs(client, updates),
        legacyTokenId: updates.token_id ? Number(updates.token_id) : null,
        legacyTokenSymbol: updates.token_symbol,
        legacyPriceInToken: updates.price_in_token,
      });
      const normalizedImages = getNormalizedImagePayload(updates);
      const shouldReplaceTokens = hasAcceptedTokenPayload(updates);
      const shouldReplaceImages = hasImagePayload(updates);
      const primaryLegacyToken = shouldReplaceTokens ? getPrimaryLegacyToken(normalizedAcceptedTokens) : null;

      const metadataBase = buildMetadataSnapshot(
        {
          ...(isRecord(currentProduct.metadata) ? currentProduct.metadata : {}),
          ...(isRecord(updates.metadata) ? updates.metadata : {}),
        },
        shouldReplaceTokens ? normalizedAcceptedTokens : undefined,
        shouldReplaceImages ? normalizedImages : undefined
      );

      await client.query(
        `UPDATE products
         SET name           = COALESCE($1, name),
             description    = COALESCE($2, description),
             base_price_usd = COALESCE($3, base_price_usd),
             category       = COALESCE($4, category),
             metadata       = $5::jsonb,
             token_id       = COALESCE($6, token_id),
             price_in_token = COALESCE($7, price_in_token),
             updated_at     = NOW()
         WHERE product_id = $8`,
        [
          updates.name || null,
          updates.description || null,
          updates.price || updates.base_price_usd || null,
          updates.category || null,
          JSON.stringify(metadataBase),
          shouldReplaceTokens ? (primaryLegacyToken?.token_id ?? null) : (updates.token_id || null),
          shouldReplaceTokens ? (primaryLegacyToken?.price_in_token ?? null) : (updates.price_in_token || null),
          productId,
        ]
      );

      if (shouldReplaceTokens) {
        await replaceAcceptedTokens(client, productId, normalizedAcceptedTokens);
      }

      if (shouldReplaceImages) {
        await replaceProductImages(client, productId, normalizedImages);
      }

      await client.query('COMMIT');
      await deleteCache(`product:${productId}`);
      await deleteCache('explore_default');
      return this.getProductById(productId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteProduct(productId: number, userId: number) {
    const sellerRes = await query('SELECT seller_id FROM seller_profiles WHERE user_id = $1', [userId]);
    if (sellerRes.rows.length === 0) throw new AppError('Seller profile not found', 403);
    const sellerId = sellerRes.rows[0].seller_id;

    const productResult = await query('SELECT * FROM products WHERE product_id = $1', [productId]);
    if (productResult.rows.length === 0) throw new AppError('Product not found', 404);
    if (productResult.rows[0].seller_id !== sellerId) throw new AppError('Not authorized', 403);

    await query(`UPDATE products SET status = 'deleted', updated_at = NOW() WHERE product_id = $1`, [productId]);
    await deleteCache(`product:${productId}`);
    await deleteCache('explore_default');
    logger.info('Product deleted', { product_id: productId });
  }
}
