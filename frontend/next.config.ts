import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@intentguard/core'],
  serverExternalPackages: ['simple-git']
};

export default nextConfig;
