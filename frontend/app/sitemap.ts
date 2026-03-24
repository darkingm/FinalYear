import { MetadataRoute } from 'next';

const BASE_URL = 'https://kienai.id.vn';

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date().toISOString();

    // Static pages
    const staticPages: MetadataRoute.Sitemap = [
        {
            url: BASE_URL,
            lastModified: now,
            changeFrequency: 'daily',
            priority: 1.0,
        },
        {
            url: `${BASE_URL}/products`,
            lastModified: now,
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: `${BASE_URL}/login`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        {
            url: `${BASE_URL}/register`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        {
            url: `${BASE_URL}/whale-tracker`,
            lastModified: now,
            changeFrequency: 'hourly',
            priority: 0.8,
        },
    ];

    // Trading pages — top coins
    const coins = [
        'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
        'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'MATICUSDT', 'DOTUSDT',
        'LINKUSDT', 'ATOMUSDT', 'LTCUSDT', 'TRXUSDT', 'TONUSDT',
        'NEARUSDT', 'APTUSDT', 'OPUSDT', 'ARBUSDT', 'SUIUSDT',
    ];

    const tradingPages: MetadataRoute.Sitemap = coins.map(symbol => ({
        url: `${BASE_URL}/trading/${symbol}`,
        lastModified: now,
        changeFrequency: 'hourly' as const,
        priority: 0.7,
    }));

    return [...staticPages, ...tradingPages];
}
