import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The till is a fully client-side app on IndexedDB and deploys to Firebase
  // Hosting as static files, exactly as the Vite build did.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
