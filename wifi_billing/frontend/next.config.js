/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // Skip ESLint during build
  },
  typescript: {
    ignoreBuildErrors: true, // Skip TypeScript errors
  },
  images: {
    unoptimized: true, // Useful for static export
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  webpack(config) {
    config.optimization.splitChunks = {
      chunks: "all",
      maxSize: 25 * 1024 * 1024, // 25 MB
    };
    return config;
  },
  output: "export", // Static export for Cloudflare Pages
  // Optional: set metadataBase if you use Open Graph/Twitter cards
  // metadataBase: new URL("https://yourdomain.com"),
};

module.exports = nextConfig;
