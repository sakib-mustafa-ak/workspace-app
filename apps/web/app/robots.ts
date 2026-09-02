import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Auth and app-shell routes shouldn't appear in search results.
      disallow: ['/auth/'],
    },
  };
}
