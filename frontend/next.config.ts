import type { NextConfig } from "next";

const apiProxyTarget = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const isProdBuild = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // Static export is for production (S3 + nginx/CDN fallbacks for dynamic routes).
  // In dev, leave this off so /invite/:token and /join/:token render without
  // needing every token in generateStaticParams().
  ...(isProdBuild ? { output: "export" as const } : {}),
  async rewrites() {
    return [
      {
        source: "/api-proxy/:path*",
        destination: `${apiProxyTarget}/:path*`,
      },
      // Production static export fallbacks — also wired in nginx.conf. Kept here
      // so `next build && next start` (if used) behaves like the CDN shells.
      ...(isProdBuild
        ? [
            { source: "/invite/:token", destination: "/invite/placeholder" },
            { source: "/join/:token", destination: "/join/placeholder" },
          ]
        : []),
    ];
  },
};

export default nextConfig;
