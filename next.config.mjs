/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["googleapis", "xlsx", "@modelcontextprotocol/sdk"],
  },
};
export default nextConfig;
