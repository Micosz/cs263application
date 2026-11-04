# ตั้งค่า LINE (ทำหลังได้โดเมน Vercel แล้ว)

ตลอดคู่มือนี้ `https://<โดเมน>` = URL โปรเจกต์บน Vercel เช่น `https://asset-tracker.vercel.app` (ตรงกับ `APP_BASE_URL`)

ระบบใช้ LINE 2 ส่วน **ต้องอยู่ใน Provider เดียวกัน** (ไม่งั้น LINE userId จากการล็อกอินจะใช้ส่งข้อความไม่ได้)

| ส่วน | ใช้ทำอะไร | ค่าที่ได้ → ตัวแปร |
|---|---|---|
| LINE Login channel (+ LIFF) | เข้าสู่ระบบบนเว็บ และเปิดหน้าเว็บในแอป LINE | `LINE_LOGIN_CHANNEL_ID`, `LINE_LOGIN_CHANNEL_SECRET`, `NEXT_PUBLIC_LIFF_ID` |
| Messaging API channel (LINE Official Account) | ส่งข้อความแจ้งคำขอ / รับ webhook | `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`, `LINE_MESSAGING_CHANNEL_SECRET` |

URL ที่ต้องเอาไปกรอกใน LINE:

| ช่องใน LINE | ค่า | route ในโค้ด |
|---|---|---|
| LINE Login → Callback URL | `https://<โดเมน>/api/auth/line/callback` | `src/app/api/auth/line/callback/route.ts` |
| LIFF → Endpoint URL | `https://<โดเมน>/liff` | `src/app/liff/[[...path]]/page.tsx` |
| Messaging API → Webhook URL | `https://<โดเมน>/api/line/webhook` | `src/app/api/line/webhook/route.ts` |

---

## ขั้น 1 · สร้าง LINE Official Account + Messaging API channel

1. **เข้าเมนู:** <https://manager.line.biz> → Create account (สร้าง LINE Official Account เช่น “ครุภัณฑ์ วิทยาการคอมพิวเตอร์ มธ.”)
2. **เข้าเมนู:** OA Manager → ⚙ Settings → **Messaging API** → Enable Messaging API → เลือก/สร้าง **Provider** (จำชื่อไว้ ต้องใช้ซ้ำในขั้น 2)
3. **เข้าเมนู:** OA Manager → Settings → **Response settings** → ปิด *Auto-response messages* (ระบบตอบผ่าน webhook เอง) และเปิด *Webhooks*
4. **เข้าเมนู:** <https://developers.line.biz/console> → Provider → channel ประเภท Messaging API ที่เพิ่งเกิด
   - แท็บ **Basic settings** → *Channel secret* → กรอกเป็น `LINE_MESSAGING_CHANNEL_SECRET`
   - แท็บ **Messaging API** → *Channel access token (long-lived)* → **Issue** → กรอกเป็น `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`
   - แท็บ **Messaging API** → *Webhook URL* → `https://<โดเมน>/api/line/webhook` → Update → เปิด **Use webhook**
5. **ตรวจผล:** กด **Verify** ข้าง Webhook URL ต้องขึ้น *Success* (ถ้าได้ 401 แปลว่า `LINE_MESSAGING_CHANNEL_SECRET` บน Vercel ไม่ตรงหรือยังไม่ redeploy)
   แล้วสแกน QR ในแท็บ Messaging API เพิ่มเพื่อน → พิมพ์ “รับ” ในแชท → บอทตอบว่า “ระบบยังไม่ได้บันทึกคำตอบ กรุณากด “ดูคำขอ” …”

## ขั้น 2 · สร้าง LINE Login channel (Provider เดียวกัน)

1. **เข้าเมนู:** LINE Developers Console → Provider เดียวกับขั้น 1 → **Create a new channel → LINE Login**
   - App types: เลือก **Web app** (LIFF ต้องการ)
2. แท็บ **Basic settings**
   - *Channel ID* → `LINE_LOGIN_CHANNEL_ID`
   - *Channel secret* → `LINE_LOGIN_CHANNEL_SECRET`
   - *Linked LINE Official Account* (บางเวอร์ชันชื่อ “Add friend option”) → เลือก OA จากขั้น 1 — เพื่อให้หน้าล็อกอินชวนเพิ่มเพื่อน (`bot_prompt=aggressive`) ผู้ใช้ต้องเป็นเพื่อนกับ OA จึงจะได้รับข้อความ
3. แท็บ **LINE Login** → *Callback URL* → `https://<โดเมน>/api/auth/line/callback`
4. แท็บ **LIFF → Add**
   - Size: **Full**
   - Endpoint URL: `https://<โดเมน>/liff`
   - Scopes: ติ๊ก **openid** และ **profile**
   - Add friend option: **On (Aggressive)**
   - บันทึกแล้วคัดลอก *LIFF ID* (เช่น `1234567890-AbCdEfGh`) → `NEXT_PUBLIC_LIFF_ID`
5. ระหว่างทดลอง channel อยู่สถานะ **Developing**: เฉพาะคนที่อยู่ในแท็บ **Roles** (Admin/Tester) ล็อกอินได้ → เพิ่มบัญชี LINE ที่จะใช้ทดสอบเป็น Tester หรือกด **Publish** เมื่อพร้อมใช้จริง

## ขั้น 3 · ใส่ค่าใน Vercel แล้ว Redeploy

Vercel → Project → Settings → Environment Variables → ใส่ 5 ค่าด้านบน + `APP_BASE_URL=https://<โดเมน>` → Deployments → **Redeploy**
(`NEXT_PUBLIC_LIFF_ID` ถูกฝังตอน build ต้อง redeploy ทุกครั้งที่เปลี่ยน)

**ตรวจผล:**
- เปิด `https://<โดเมน>/login` บนคอม → ปุ่ม “เข้าสู่ระบบด้วย LINE” เป็นสีเขียว → กดแล้วไปหน้า `access.line.me` → ยอมรับ → กลับมาที่ `/link` (ยังไม่ผูกบัญชี) = ใช้ได้
- ถ้าเจอ “redirect_uri does not match” ที่หน้า LINE → Callback URL ในขั้น 2.3 ไม่ตรงกับ `APP_BASE_URL` + `/api/auth/line/callback`

## ขั้น 4 · ผูกบัญชี LINE กับผู้ใช้ในระบบ

ระบบรู้จักผู้ใช้จากตาราง `users` (ชื่อผู้ใช้ TU) ครั้งแรกต้องผูก LINE ด้วยรหัสใช้ครั้งเดียว:

```bash
DATABASE_URL="postgres://...unpooled..." npm run link-code -- aree.s
```

ได้รหัสเช่น `K7QM-3XPA` (อายุ 7 วัน) ส่งให้เจ้าของบัญชี → เขาเปิด `https://<โดเมน>/login` (หรือ `https://liff.line.me/<LIFF ID>` ในแอป LINE) → เข้าสู่ระบบด้วย LINE → หน้า “เชื่อม LINE กับบัญชีของคุณ” → กรอกชื่อผู้ใช้ TU + รหัส → “เชื่อมบัญชี”

**ตรวจผล:** หน้า “บัญชี” ขึ้น “เชื่อมกับ <ชื่อ LINE> แล้ว” และใน DB `select username, line_user_id from users;` มีค่าขึ้นต้นด้วย `U`
(ข้อมูลตัวอย่างจาก `db:seed` ใช้ LINE userId สมมติ `Udemo-...` การผูกจริงจะเขียนทับให้เอง)

## ขั้น 5 · ทดลองรับข้อความจริงด้วยสองบัญชี

เตรียม LINE 2 บัญชี (เช่น มือถือคุณ = A, มือถือเพื่อน/อีกเครื่อง = B) ทั้งคู่ต้อง (1) เพิ่ม OA เป็นเพื่อน (2) อยู่ใน Roles ถ้า channel ยัง Developing

1. ออกรหัสแล้วผูก: A → `aree.s`, B → `boonmee.k` (ขั้น 4)
2. A เปิดเว็บ → ของฉัน → เลือกครุภัณฑ์ → ย้าย / ส่งต่อ → แท็บ “ส่งต่อ” → เลือกคุณบุญมี → ใส่เหตุผล → ส่งคำขอ
   - หน้า “ส่งคำขอแล้ว” ต้องขึ้น “แจ้งคุณบุญมีทาง LINE แล้ว” (ถ้าขึ้นกล่องสีส้ม ให้อ่าน “สาเหตุ” ในกล่อง)
3. B ได้ข้อความจาก OA “คุณอารีย์ขอส่งต่อครุภัณฑ์ให้คุณ” + ชื่อครุภัณฑ์ + ปุ่ม **ดูคำขอ**
   → กดปุ่ม → เปิดหน้าต่างในแอป LINE (`https://liff.line.me/<LIFF ID>/requests/<id>`) → เข้าสู่ระบบอัตโนมัติ → เปิดคำขอนั้นทันที
4. B กด “รับเครื่องนี้” → ยืนยัน → A ได้ข้อความ “คุณบุญมีรับ … แล้ว”
   (ทดลองอีกครั้งด้วย “ไม่รับ” → A ได้ข้อความ “ปฏิเสธ” พร้อมเหตุผล)
5. ตรวจผลการส่งที่บันทึกจริง:

```sql
select kind, status, http_status, error, attempts, created_at
from notifications order by created_at desc limit 10;
```

`status = sent` คือ LINE รับข้อความแล้ว, `failed` มี `http_status`/`error` จาก LINE, `skipped` มีเหตุผล (เช่น ผู้รับยังไม่เชื่อม LINE)

## แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| ส่งข้อความ `failed` 400 “The property, 'to', in the request body is invalid” | LINE userId มาจาก Provider อื่น → LINE Login กับ Messaging API ต้องอยู่ Provider เดียวกัน แล้วผูกบัญชีใหม่ |
| `failed` 403 หรือ B ไม่ได้รับ | B ยังไม่เพิ่ม OA เป็นเพื่อน / บล็อก OA |
| `failed` 401 | `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` ผิดหรือถูก reissue |
| `skipped` “ยังไม่ได้ตั้งค่า …” | ยังไม่ใส่ env บน Vercel หรือยังไม่ redeploy |
| กด “ดูคำขอ” แล้วขึ้นหน้าเว็บให้ล็อกอิน | ยังไม่ใส่ `NEXT_PUBLIC_LIFF_ID` (ระบบจะเปิดเว็บตรงแทน — ล็อกอินแล้วกลับมาที่คำขอเดิม) |
| LIFF ขึ้น “ไม่มี ID token” | LIFF app ยังไม่ติ๊ก scope **openid** |
| ล็อกอินแล้วขึ้น 400/“invalid client” | Channel ID/secret สลับกับของ Messaging API channel |

## (ไม่บังคับ) Rich menu

ดีไซน์มีเมนูในแชท 6 ช่อง สร้างได้ที่ OA Manager → Chat screen → Rich menus โดยตั้ง Action = Link:

| ช่อง | ลิงก์ |
|---|---|
| คำขอถึงฉัน | `https://liff.line.me/<LIFF ID>/requests` |
| ของฉัน | `https://liff.line.me/<LIFF ID>/mine` |
| ทบทวนรอบนี้ | `https://liff.line.me/<LIFF ID>/review` |
| เปิดเว็บเต็ม | `https://liff.line.me/<LIFF ID>/` |
| ตั้งค่าแจ้งเตือน | `https://liff.line.me/<LIFF ID>/account` |
| ติดต่อผู้ดูแล | Text: `ติดต่อผู้ดูแล` (บอทตอบ “ติดต่อผู้ดูแลระบบ งานไอที ห้อง 213”) |
