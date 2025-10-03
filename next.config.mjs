/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Avoid Windows rename ENOENT issues by disabling persistent file cache in dev
      // and using in-memory cache instead.
      config.cache = {
        type: 'memory',
      }
    }
    return config
  },
}

export default nextConfig
