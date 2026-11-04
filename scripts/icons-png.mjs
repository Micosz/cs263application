// แปลงไอคอนประเภทครุภัณฑ์ (SVG จากดีไซน์) เป็น PNG สำหรับรูปในข้อความ LINE
// (LINE Flex Message รับเฉพาะ PNG/JPEG) — รันเฉพาะเมื่อเปลี่ยนไอคอน: npm run icons:png
import { readdir } from "node:fs/promises";
import sharp from "sharp";

const dir = new URL("../public/types/", import.meta.url);
for (const f of await readdir(dir)) {
  if (!f.endsWith(".svg")) continue;
  const out = new URL(f.replace(/\.svg$/, ".png"), dir);
  await sharp(new URL(f, dir).pathname.replace(/^\/(\w:)/, "$1"), { density: 480 })
    .resize(360, 360, { fit: "contain", background: { r: 241, g: 241, b: 244, alpha: 1 } })
    .extend({ left: 220, right: 220, background: { r: 241, g: 241, b: 244, alpha: 1 } })
    .png()
    .toFile(out.pathname.replace(/^\/(\w:)/, "$1"));
  console.log("✓", out.pathname.split("/").pop());
}
