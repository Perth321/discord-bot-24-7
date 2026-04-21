# Discord Bot - ระบบแปลภาษา + แจ้งเตือน Voice Channel

บอทรัน **24/7 บน GitHub Actions** อัตโนมัติ

---

## โครงสร้างโปรเจกต์

```
discord-bot-project/
├── bot/           → Discord Bot (รันบน GitHub Actions)
├── server/        → Backend API (Express + SQLite)
├── web/           → Web Dashboard (React + Tailwind)
└── .github/
    └── workflows/
        └── bot.yml → GitHub Actions workflow
```

---

## ขั้นตอนที่ 1: Upload ขึ้น GitHub

1. ไปที่ https://github.com/new
2. สร้าง repo ใหม่ (ตั้งชื่ออะไรก็ได้ เช่น `discord-bot`)
3. เลือก **Private** (เพื่อความปลอดภัย)
4. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้น repo

---

## ขั้นตอนที่ 2: ตั้งค่า GitHub Secrets

1. ไปที่ repo ของคุณบน GitHub
2. คลิก **Settings** (แถบบนสุด)
3. คลิก **Secrets and variables** → **Actions** (เมนูซ้าย)
4. คลิก **New repository secret** แล้วเพิ่ม:

| Secret Name | Value |
|-------------|-------|
| `DISCORD_TOKEN` | Discord Bot Token ของคุณ |
| `CONFIG_API_URL` | URL ของ Backend server (ถ้ามี) |

---

## ขั้นตอนที่ 3: เปิด GitHub Actions

1. ไปที่ repo → คลิก **Actions** tab
2. ถ้ามีปุ่ม "I understand my workflows, go ahead and enable them" → คลิก
3. Actions จะรันอัตโนมัติทุก 10 นาที
4. สามารถรันด้วยมือได้: คลิก workflow "Discord Bot 24/7" → **Run workflow**

---

## ขั้นตอนที่ 4: เชิญบอทเข้า Server

คลิกลิงก์นี้เพื่อเชิญบอท:

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=274877991936&scope=bot
```

แทนที่ `YOUR_CLIENT_ID` ด้วย Client ID จาก [Discord Developer Portal](https://discord.com/developers/applications)

**Permissions ที่ต้องการ:**
- Send Messages
- Embed Links
- View Channels
- Read Message History

---

## ฟีเจอร์ของบอท

### ระบบแปลภาษา
- **ภาษาเวียดนาม** → ตรวจจับอัตโนมัติ แปลเป็นไทย
- **คำสั่ง `!th <ข้อความ>`** → แปลไทย → เวียดนาม

### แจ้งเตือน Voice Channel
- 🟢 ใครเข้า Voice Channel
- 🔴 ใครออก Voice Channel
- 🟡 ใครย้าย Voice Channel

---

## การรัน Backend (ถ้าต้องการ)

```bash
cd server
npm install
node index.js
```

Dashboard เข้าถึงได้ที่ `http://localhost:3001`

---

## การรัน Web Dashboard (local)

```bash
cd web
npm install
npm run dev
```

เปิด `http://localhost:5173`

---

## วิธีดู Bot Logs

1. ไปที่ GitHub repo → **Actions** tab
2. คลิก workflow run ล่าสุด
3. คลิก job "Run Discord Bot"
4. ดู logs ได้ทันที

---

## หมายเหตุ

- Bot รันทุก 10 นาทีผ่าน cron job บน GitHub Actions
- แต่ละ session รันนาน ~8 นาที ก่อน restart
- ทำให้ bot ออนไลน์ต่อเนื่องตลอด 24 ชั่วโมง
- ไม่ต้องมี server หรือเปิดเครื่องไว้
