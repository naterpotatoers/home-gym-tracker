import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server is used from the iPad over the LAN. Without these, Next 16
  // blocks cross-origin requests for dev assets — the page HTML renders but
  // no client JS loads, so every React onClick is silently dead on the iPad.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*", "*.local"],
};

export default nextConfig;
