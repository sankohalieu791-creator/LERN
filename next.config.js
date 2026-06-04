/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.runtimeChunk = 'single'
    }
    return config
  },
  webSocketServer: false,
}

module.exports = nextConfig
