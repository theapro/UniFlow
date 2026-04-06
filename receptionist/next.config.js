/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    const isWindows = process.platform === "win32";
    if (isWindows) {
      // Work around intermittent Windows filesystem cache rename errors:
      // ENOENT: rename .pack.gz_ -> .pack.gz in .next/cache/webpack
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
