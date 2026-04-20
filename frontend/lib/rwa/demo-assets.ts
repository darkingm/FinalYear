const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const DEMO_RWA_ASSETS = [
  {
    asset_id: 'demo-001',
    name: 'HCM Tower Unit 2101',
    symbol: 'HCMT-2101',
    asset_type: 'REAL_ESTATE',
    description:
      'Luxury apartment in District 1, Ho Chi Minh City. Annual rental yield 8.5%. Demo asset for local RWA marketplace validation.',
    location: 'District 1, Ho Chi Minh City',
    total_valuation_usd: 500000,
    price_per_token_usd: 100,
    total_tokens: 5000,
    tokens_sold: 1850,
    legal_doc_ipfs: '',
    expected_apy: 8.5,
    status: 'ACTIVE',
    holder_count: 23,
    total_distributed_usd: 12450,
    chain_id: 31337,
    token_contract_address: ZERO_ADDRESS,
    distributor_contract_address: ZERO_ADDRESS,
  },
];

export function getDemoRwaAssets() {
  return DEMO_RWA_ASSETS.map((asset) => ({ ...asset }));
}

export function getDemoRwaAssetById(assetId: string) {
  const asset = DEMO_RWA_ASSETS.find((entry) => entry.asset_id === assetId);
  return asset ? { ...asset } : null;
}
