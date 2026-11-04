import type { NextConfig } from "next";

// ไม่เปิด cacheComponents: ทุกหน้าเป็นข้อมูลเฉพาะผู้ใช้และต้องสดทุกครั้งที่เปิด/รีเฟรช
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
