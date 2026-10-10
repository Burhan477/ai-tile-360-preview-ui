import type { NextConfig } from "next";

// Catalog tiles may live in the public `tile-images` bucket of this project
// (see src/lib/server/catalog.ts); no other remote image is allowed.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const tileImagePatterns =
  supabaseUrl && URL.canParse(supabaseUrl)
    ? [new URL(`${new URL(supabaseUrl).origin}/storage/v1/object/public/tile-images/**`)]
    : [];

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: tileImagePatterns,
  },
  experimental: {
    agentFeedback: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
