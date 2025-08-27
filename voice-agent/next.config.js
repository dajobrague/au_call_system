/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure Node.js runtime for API routes (better Redis/crypto compatibility)
  experimental: {
    serverComponentsExternalPackages: ['@upstash/redis'],
  },
  
  // Force Node.js runtime for all API routes
  async rewrites() {
    return [];
  },
  
  // Optimize for production
  compress: true,
  poweredByHeader: false,
  
  // Security headers
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;