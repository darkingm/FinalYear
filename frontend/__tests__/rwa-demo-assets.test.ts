import { describe, expect, it } from '@jest/globals';
import { getDemoRwaAssetById, getDemoRwaAssets } from '@/lib/rwa/demo-assets';

describe('rwa demo assets', () => {
  it('exposes at least one demo asset for marketplace fallback', () => {
    const assets = getDemoRwaAssets();

    expect(Array.isArray(assets)).toBe(true);
    expect(assets.length).toBeGreaterThan(0);
    expect(assets[0]).toMatchObject({
      asset_id: expect.any(String),
      name: expect.any(String),
      symbol: expect.any(String),
      token_contract_address: expect.any(String),
      distributor_contract_address: expect.any(String),
    });
  });

  it('returns a demo asset by id for detail-page fallback', () => {
    const asset = getDemoRwaAssetById('demo-001');

    expect(asset).not.toBeNull();
    expect(asset?.asset_id).toBe('demo-001');
    expect(asset?.name).toContain('HCM Tower');
  });
});
