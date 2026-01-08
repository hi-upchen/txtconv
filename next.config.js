/** @type {import('next').NextConfig} */

// Generate build timestamp in UTC+8 timezone
const now = new Date();
const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
const buildVersion = `v${utc8.toISOString().replace(/[-:T]/g, '').slice(0, 14)}`;

const nextConfig = {
  env: {
    BUILD_VERSION: buildVersion,
  },
};

module.exports = nextConfig;
