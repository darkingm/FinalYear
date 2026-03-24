import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/api/', '/admin/', '/_next/', '/checkout/'],
            },
            {
                userAgent: 'Googlebot',
                allow: '/',
                disallow: ['/api/', '/admin/'],
            },
        ],
        sitemap: 'https://kienai.id.vn/sitemap.xml',
    };
}
