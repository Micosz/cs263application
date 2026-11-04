/**
 * ออกรหัสเชื่อมบัญชี LINE แบบใช้ครั้งเดียวให้ผู้ใช้ (อายุ 7 วัน)
 *   npm run link-code -- aree.s
 * ผู้ใช้เปิดเว็บ → เข้าสู่ระบบด้วย LINE → กรอกชื่อผู้ใช้ TU + รหัสนี้ที่หน้า "เชื่อม LINE กับบัญชีของคุณ"
 */
import "./_env";
import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "../src/db";
import { users } from "../src/db/schema";
import { sha256 } from "../src/lib/crypto";
import { normalizeLinkCode } from "../src/services/account";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ไม่มี 0/O/1/I ที่อ่านสับสน

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error("ใช้: npm run link-code -- <ชื่อผู้ใช้ TU>");
    process.exit(1);
  }
  const code = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  const rows = await getDb()
    .update(users)
    .set({
      linkCodeHash: sha256(normalizeLinkCode(code)),
      linkCodeExpiresAt: new Date(Date.now() + 7 * 86400_000),
      linkFailedAttempts: 0,
    })
    .where(eq(users.username, username))
    .returning({ fullName: users.fullName });
  if (!rows.length) {
    console.error(`ไม่พบผู้ใช้ ${username}`);
    process.exitCode = 1;
    return;
  }
  console.log(`รหัสเชื่อมบัญชีของ ${rows[0].fullName} (${username}): ${code.slice(0, 4)}-${code.slice(4)}`);
  console.log("ใช้ได้ครั้งเดียว ภายใน 7 วัน");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(closeDb);
