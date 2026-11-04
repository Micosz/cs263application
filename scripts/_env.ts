// โหลด .env.local / .env สำหรับสคริปต์ที่รันด้วย tsx (Next.js โหลดเองเฉพาะตอนรันเว็บ)
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    /* ไม่มีไฟล์ก็ข้าม */
  }
}

/** กันเผลอ seed/ล้างฐานข้อมูลจริง */
export function assertSafeTarget(action: string) {
  const url = process.env.DATABASE_URL ?? "";
  const local = /@(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//.test(url);
  if (!local && process.env.SEED_CONFIRM !== "yes") {
    console.error(
      `ไม่${action}ให้ เพราะ DATABASE_URL ไม่ใช่ฐานข้อมูลในเครื่อง\n` +
        `ถ้าตั้งใจจริง (เช่นฐานข้อมูลทดลองบน Neon) ให้รันซ้ำพร้อม SEED_CONFIRM=yes`,
    );
    process.exit(1);
  }
}
