/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Serverless function configuration
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  // Ensure API routes work properly
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't externalize better-sqlite3 - we need it bundled
      // Add fallbacks for native modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig

