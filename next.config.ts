import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['dev.bondsquad.ai'],
  images: {
    remotePatterns: [
      { hostname: '*.public.blob.vercel-storage.com' },
      { hostname: '*.cdninstagram.com' },
    ],
  },
};

export default nextConfig;
