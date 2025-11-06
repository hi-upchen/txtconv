/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

module.exports = nextConfig;
