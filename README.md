# ระบบติดตามครุภัณฑ์ (สาขาวิชาวิทยาการคอมพิวเตอร์ มธ.)

เว็บแอปจัดการครุภัณฑ์ที่ใช้ได้ทั้งมือถือ (อุปกรณ์หลัก) และคอมพิวเตอร์ พัฒนาจากดีไซน์ “ระบบติดตามครุภัณฑ์ — ตัวจริง” (Design canvas บน claude.ai)
เข้าสู่ระบบด้วย LINE (LINE Login บนเว็บ / LIFF ในแอป LINE) และแจ้งเตือนคำขอส่งต่อครุภัณฑ์ผ่าน LINE Official Account

- **Stack:** Next.js 16 (App Router) + TypeScript, PostgreSQL + Drizzle ORM (migration เป็นไฟล์ SQL ใน `drizzle/`), Vitest
- **ฐานข้อมูลกลาง:** ทุกบัญชีอ่าน/เขียนข้อมูลชุดเดียวกัน ทุกหน้าอ่านจากฐานข้อมูลสดทุกครั้ง (ไม่ cache)
- **คู่มือ LINE:** [docs/LINE_SETUP.md](docs/LINE_SETUP.md)

---

## 1. รันในเครื่อง

ต้องมี Node.js 20.12 ขึ้นไป (ทดสอบกับ 24) และ Docker Desktop

```bash
npm ci
```

```bash
cp .env.example .env.local
```

แก้ `.env.local` ให้ `SESSION_SECRET` เป็นค่าสุ่มยาว ≥ 32 ตัว (ค่า LINE เว้นว่างได้ระหว่างพัฒนา)

```bash
npm run db:up
```

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run dev
```

เปิด <http://localhost:3000> → หน้าเข้าสู่ระบบจะมีกล่อง **“ผู้ใช้ตัวอย่าง (เฉพาะ development)”** ให้กดเข้าเป็นใครก็ได้

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run db:up` | เปิด PostgreSQL 17 ใน Docker (พอร์ต 5433, มีฐาน `asset_tracker` และ `asset_tracker_test`) |
| `npm run db:migrate` | สร้าง/อัปเดตตารางตาม `drizzle/*.sql` (ใช้ `DATABASE_URL`) |
| `npm run db:seed` | **ล้าง**แล้วใส่ข้อมูลตัวอย่างใหม่ (ปฏิเสธถ้า `DATABASE_URL` ไม่ใช่ localhost เว้นแต่ใส่ `SEED_CONFIRM=yes`) |
| `npm run db:generate` | สร้างไฟล์ migration ใหม่หลังแก้ `src/db/schema.ts` |
| `npm run link-code -- <username>` | ออกรหัสเชื่อมบัญชี LINE แบบใช้ครั้งเดียว (อายุ 7 วัน) |
| `npm run lint` / `npm run typecheck` / `npm test` | ตรวจโค้ด / ตรวจชนิด / รัน automated tests (ใช้ `DATABASE_URL_TEST`) |
| `npm run build` | production build (Vercel เรียกเอง) |

> ข้อมูลตัวอย่างเป็นชื่อสมมติทั้งหมด (ดีไซน์ระบุว่าชื่อบุคลากรและเลขห้องจริงต้องได้รับอนุญาตก่อนเผยแพร่)

## 2. ทดสอบขั้นตอนส่งต่อด้วยผู้ใช้ A / B

| | ชื่อผู้ใช้ | ชื่อ |
|---|---|---|
| **A** | `aree.s` | คุณอารีย์ สุขใจ (รับผิดชอบ 12 ชิ้น) |
| **B** | `boonmee.k` | คุณบุญมี กล้าหาญ |
| อื่น ๆ | `kanda.w` (ผู้ดูแลระบบ), `somsak.m` (ยังไม่เชื่อม LINE), `theerapong.r` (อีกสาขา ใช้ทดสอบสิทธิ์) | |

1. **ย้ายห้อง** — เข้าเป็น A → ของฉัน → เลือกครุภัณฑ์ → “ย้าย / ส่งต่อ” → แท็บ “ย้ายห้อง” → เลือกห้อง + เหตุผล → “ตรวจสอบแล้วย้าย” → “ยืนยันย้ายห้อง” → รีเฟรชหน้ารายละเอียด: ห้องเปลี่ยน ผู้ดูแลยังเป็น A ประวัติมีผู้ทำรายการ ห้องเดิม ห้องใหม่ วันที่ เหตุผล
2. **ส่งต่อแล้ว B รับ** — A เลือกแท็บ “ส่งต่อ” (หรือ “ทั้งสองอย่าง”) → เลือกคุณบุญมี → ส่งคำขอ (สถานะ “รอตอบรับ” A ยังเป็นผู้ดูแล)
   → เปิด <http://localhost:3000/dev/line-outbox> ดูข้อความ LINE ที่ระบบสร้าง + ผลการส่งที่บันทึกจริง แล้วกด “ดูคำขอ” (จำลองการกดปุ่มในแชท)
   → ถ้ายังไม่ล็อกอิน ระบบพาไปหน้าเข้าสู่ระบบแล้วกลับมาที่คำขอเดิม → เข้าเป็น B → “รับเครื่องนี้” → รีเฟรช “ของฉัน” ของ B (มีชิ้นนี้) และของ A (หายไป)
3. **ส่งต่อแล้ว B ปฏิเสธ** — ทำแบบข้อ 2 แต่ B กด “ไม่รับ” เลือกเหตุผล → รีเฟรช: ชิ้นนั้นยังอยู่กับ A ห้องเดิม ประวัติบันทึกการปฏิเสธพร้อมเหตุผล

สลับผู้ใช้: หน้า “บัญชี” → ออกจากระบบ → เลือกผู้ใช้ตัวอย่างใหม่ (ปุ่มนี้และ `/api/dev/login`, `/dev/line-outbox` ใช้ได้เฉพาะ `npm run dev`; production ตอบ 404)

## 3. กฎของระบบ (ตรวจที่ server ทุกครั้ง)

- **เห็นอะไรได้:** ผู้ดูแลระบบ (`role=admin`) เห็นทุกสาขา, บุคลากรเห็นครุภัณฑ์ในห้องของสาขาตัวเอง และชิ้นที่ตนรับผิดชอบ — “ครุภัณฑ์ของฉัน” = เฉพาะชิ้นที่ `custodian_id` เป็นผู้ใช้ปัจจุบัน
- **ย้ายห้อง:** เฉพาะผู้รับผิดชอบ มีผลทันทีหลังยืนยัน ผู้รับผิดชอบคงเดิม บันทึก `asset_events(kind=room_moved)`
- **ส่งต่อ:** เฉพาะผู้รับผิดชอบ ส่งให้คนในสาขาเดียวกัน สร้าง `transfer_requests(status=pending)`; ระหว่างรอ ผู้ดูแลและห้องไม่เปลี่ยน; ต่อชิ้นมีคำขอรอได้ครั้งละหนึ่ง (partial unique index) ต้องยกเลิกก่อนทำรายการใหม่
- **ตอบคำขอ:** เฉพาะผู้รับที่ระบุ — รับ = เปลี่ยนผู้รับผิดชอบ (+ ห้องถ้าขอไว้), ปฏิเสธ = คงเดิม บันทึกเหตุผล; คำขอที่ตอบแล้วตอบซ้ำไม่ได้
- **กดซ้ำไม่ซ้ำ:** ฟอร์มส่ง `idempotencyKey` ทุกครั้ง + ล็อกแถว (`SELECT … FOR UPDATE`) + unique index บน `asset_events(request_id, kind)` และ `notifications(request_id, kind, recipient_id)`
- **LINE ส่งไม่สำเร็จ:** คำขอยังอยู่ ผู้รับเปิดจากเมนู “คำขอ” บนเว็บได้ ผลจริงเก็บใน `notifications` (`sent` / `failed` + HTTP status + ข้อความ error / `skipped` + เหตุผล) ผู้ส่งกด “ส่งแจ้งเตือนอีกครั้ง” ได้ (ใช้ `X-Line-Retry-Key` เดิม)

## 4. โครงสร้างและการจับคู่กับดีไซน์

| ดีไซน์ | Route | ไฟล์ |
|---|---|---|
| 01 เข้าสู่ระบบ | `/login` | `src/app/login/` |
| 02 หน้าหลัก | `/` | `src/app/(main)/(tabs)/page.tsx` |
| 03 ค้นหาครุภัณฑ์ | `/assets` | `src/app/(main)/(tabs)/assets/` |
| 04 ของฉัน | `/mine` | `src/app/(main)/(tabs)/mine/` |
| 05 รายละเอียด + ประวัติ | `/assets/[id]` | `src/app/(main)/assets/[id]/page.tsx` |
| 06 ทบทวนทีละเครื่อง | `/review` | `src/app/(main)/review/` |
| 07–10 ย้าย/ส่งต่อ, เลือกคน, เลือกห้อง, ตรวจสอบก่อนส่ง | `/assets/[id]/manage` | `.../manage/ManageFlow.tsx` |
| 11 คำขอ / 12 ตอบคำขอ | `/requests`, `/requests/[id]` | `src/app/(main)/(tabs)/requests/`, `src/app/(main)/requests/[id]/` |
| 13 บัญชี | `/account` | `src/app/(main)/(tabs)/account/` |
| W1 เชื่อมบัญชี | `/link` | `src/app/link/` |
| จุดเข้า LIFF | `/liff/...` | `src/app/liff/[[...path]]/` |
| L2/L3 ข้อความในแชท | Flex Message | `src/lib/line/flex.ts` |

- ชั้นข้อมูล: `src/db/schema.ts` (ตาราง), `src/services/commands.ts` (เขียน + ตรวจสิทธิ์), `src/services/queries.ts` (อ่าน), `src/services/notify.ts` (ส่ง LINE + บันทึกผล)
- API: `src/app/api/**/route.ts` — `POST /api/assets/[id]/move`, `POST /api/transfers`, `POST /api/transfers/[id]/{accept,reject,cancel,notify}`, `POST /api/reviews`, `/api/auth/*`, `POST /api/line/webhook`
- มือถือ: เลย์เอาต์ตามดีไซน์ 390px, เมนูล่าง, แถบปุ่มยืนยันติดล่างและขยับขึ้นเหนือคีย์บอร์ด (`KeyboardInset` + `interactive-widget=resizes-content`)
- คอม (≥1024px): เมนูด้านข้าง, ตารางหลายคอลัมน์ในหน้าครุภัณฑ์ทั้งหมด, รายละเอียดคู่ประวัติ, คำขอ “ถึงฉัน/ที่ฉันส่ง” คู่กัน, ตัวเลือกคน/ห้องเป็นกล่องกลางจอ

## 5. สิ่งที่เปลี่ยนจากดีไซน์ / ยังไม่ได้ทำ

- **เข้าสู่ระบบ:** ดีไซน์หน้า 01/W1 ใช้ชื่อผู้ใช้+รหัสผ่าน TU แต่ระบบนี้ไม่ได้เชื่อมระบบรหัสผ่านของมหาวิทยาลัย จึงใช้ LINE Login + **รหัสเชื่อมบัญชีแบบใช้ครั้งเดียว** ที่ผู้ดูแลระบบออกด้วย `npm run link-code` แทนรหัสผ่าน (ถ้าภายหลังได้ TU SSO ให้แทนที่ `src/services/account.ts#linkWithCode`)
- หน้าต่าง LINE W2–W4 ใช้หน้าเว็บเดียวกัน (ปรับตามจอ) แทนหน้าแยก, ปุ่มในข้อความแจ้งเตือนใช้คำว่า “ดูคำขอ”
- ยังไม่มีหน้าแอดมินสำหรับเพิ่มผู้ใช้/ห้อง/ครุภัณฑ์/รอบทบทวน (จัดการผ่านฐานข้อมูลหรือสคริปต์), ยังไม่ส่งแจ้งเตือนเปิดรอบทบทวน และยังไม่ได้สร้าง Rich menu (ดูตัวอย่างลิงก์ใน docs/LINE_SETUP.md)

---

## 6. ขั้นตอนที่เจ้าของโปรเจกต์ทำเอง: GitHub → Vercel → LINE

### 6.1 Push ขึ้น GitHub

ไฟล์ `.env*` (ยกเว้น `.env.example`), `node_modules/`, `.next/` ถูก `.gitignore` กันไว้แล้ว

```bash
git init
```

```bash
git add .
```

```bash
git status
```

ตรวจว่าไม่มี `.env.local` ในรายการ แล้ว

```bash
git commit -m "ระบบติดตามครุภัณฑ์: เวอร์ชันแรก"
```

สร้าง repository ว่างบน GitHub (ไม่ต้องติ๊ก README) แล้ว

```bash
git remote add origin https://github.com/<บัญชี>/<ชื่อ-repo>.git
```

```bash
git push -u origin main
```

(ถ้า branch ชื่อ `master` ให้ `git branch -M main` ก่อน push)

### 6.2 ฐานข้อมูลบน Vercel

1. Vercel → **Add New… → Project** → Import repo จาก GitHub → Framework = Next.js (ค่าเริ่มต้น Build Command `npm run build`) → ยังไม่ต้องกด Deploy ถ้ายังไม่มีฐานข้อมูล (หรือ Deploy ไปก่อนแล้วกลับมาตั้งค่า)
2. Project → **Storage → Create Database → Neon (Postgres)** → Connect to Project (ทุก Environment) — Vercel จะเติม `DATABASE_URL` ให้อัตโนมัติ
3. สร้างตารางในฐานข้อมูลจริงจากเครื่องตัวเอง (ใช้ connection string แบบ **unpooled** จากหน้า Neon/Storage):

```bash
DATABASE_URL="postgres://...unpooled..." npm run db:migrate
```

4. (ถ้าต้องการข้อมูลตัวอย่างไว้ลอง — จะ**ล้างข้อมูลเดิม**)

```bash
DATABASE_URL="postgres://...unpooled..." SEED_CONFIRM=yes npm run db:seed
```

> ทุกครั้งที่มีไฟล์ใหม่ใน `drizzle/` ให้รัน `db:migrate` กับฐานข้อมูลจริงก่อน/พร้อม deploy
>
> คำสั่งแบบ `DATABASE_URL="..." npm run ...` ใช้ได้ใน Git Bash / macOS / Linux — ถ้าใช้ PowerShell ให้พิมพ์ `$env:DATABASE_URL="postgres://..."` แล้วกด Enter ก่อน จากนั้นรัน `npm run db:migrate` (และ `$env:SEED_CONFIRM="yes"` สำหรับ seed)

### 6.3 Environment Variables บน Vercel

Project → **Settings → Environment Variables** (เลือก Production และ Preview):

| ชื่อ | ค่า | หมายเหตุ |
|---|---|---|
| `DATABASE_URL` | เติมให้แล้วจากข้อ 6.2 | server, ลับ |
| `SESSION_SECRET` | ค่าสุ่มใหม่ (ไม่ใช้ค่าเดียวกับเครื่อง) | server, ลับ |
| `APP_BASE_URL` | `https://<โปรเจกต์>.vercel.app` | server |
| `LINE_LOGIN_CHANNEL_ID` | จาก LINE Login channel | server |
| `LINE_LOGIN_CHANNEL_SECRET` | จาก LINE Login channel | server, ลับ |
| `NEXT_PUBLIC_LIFF_ID` | LIFF ID | public — ต้อง redeploy หลังแก้ |
| `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` | จาก Messaging API channel | server, ลับ |
| `LINE_MESSAGING_CHANNEL_SECRET` | จาก Messaging API channel | server, ลับ |

สร้างค่าสุ่ม:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### 6.4 Deploy และตั้งค่า LINE

1. Deploy (Deployments → Redeploy หลังใส่ env) → จด URL เช่น `https://asset-tracker.vercel.app`
2. ตั้งค่า LINE ตาม [docs/LINE_SETUP.md](docs/LINE_SETUP.md) โดยใช้ URL นั้น แล้ว Redeploy อีกครั้งหลังได้ `NEXT_PUBLIC_LIFF_ID`
3. ออกรหัสเชื่อมบัญชีให้ผู้ใช้จริง (รันในเครื่องโดยชี้ฐานข้อมูลจริง):

```bash
DATABASE_URL="postgres://...unpooled..." npm run link-code -- aree.s
```
