/** @type {import('next').NextConfig} */
const nextConfig = {
  // External packages that should not be bundled (Next.js 16 moved this out of experimental)
  serverExternalPackages: ['@upstash/redis', 'bull', 'ioredis', 'twilio', 'puppeteer'],
  
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