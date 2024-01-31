/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_CONFIG_OUTPUT || 'standalone',
}

module.exports = nextConfig
