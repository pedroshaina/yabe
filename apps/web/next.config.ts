import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Don't write AGENTS.md / CLAUDE.md into the app on `next dev`.
  agentRules: false,
  reactStrictMode: true,
  // The stack publishes everything on 127.0.0.1; let `next dev` serve hot reload there too.
  allowedDevOrigins: ["127.0.0.1"],
  headers() {
    return Promise.resolve([{ source: "/:path*", headers: securityHeaders }]);
  },
};

export default nextConfig;
