import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: '*.public.blob.vercel-storage.com' },
      { hostname: '*.cdninstagram.com' },
    ],
  },
};

export default nextConfig;
