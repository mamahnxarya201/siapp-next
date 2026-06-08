/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  
    allowedDevOrigins: ['192.168.68.192'],
  
}

export default nextConfig
