import type { NextConfig } from 'next';

const BACKEND = process.env.INTENTGUARD_API_URL ?? 'http://localhost:3848';

const nextConfig: NextConfig = {
  transpilePackages: ['@intentguard/core'],
  serverExternalPackages: ['simple-git'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
