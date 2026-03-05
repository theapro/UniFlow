# UniFlow Backend & AI API — Production-Ready Refactoring Guide

Quyidagi yo‘l-yo‘riq backend’ni (Express + Prisma + PostgreSQL) production’ga tayyor holatga olib kelish, DB/Prisma’ni **100% sync** qilish va AI endpoint’larni **secure** qilish uchun.

## 0) Prerequisites

- Node.js (LTS tavsiya)
- PostgreSQL
- `backend/.env` konfiguratsiya qilingan

## 1) Env (.env)

`backend/.env.example` dan nusxa oling:

```bash
cd backend
copy .env.example .env
```

Minimal kerakli qiymatlar:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/uniflow"
JWT_SECRET="change-me"
PORT=3001
```

## 2) Database reset & cleanup

### Variant A (tavsiya, dev): Prisma orqali reset

Bu DB’ni drop qilmaydi, lekin **schema/tables**’ni tozalaydi va migratsiyalarni qayta qo‘llaydi:

```bash
cd backend
npm run db:reset
```

### Variant B (to‘liq reset): DB’ni drop/create (psql)

Siz bergan workflow (PostgreSQL):

```sql
\c postgres

SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'uniflow' AND pid <> pg_backend_pid();

DROP DATABASE "uniflow";
CREATE DATABASE "uniflow";
```

So‘ng migratsiyalarni qo‘llang:

```bash
cd backend
npx prisma migrate deploy
npm run db:seed
```

## 3) Prisma schema ↔ database: source of truth

- **Source of truth:** `backend/prisma/schema.prisma`
- **Migrationlar:** `backend/prisma/migrations/`

Asosiy komandalar:

```bash
# Status
npx prisma migrate status

# Dev’da migratsiya yaratish+apply (interaktiv bo‘lishi mumkin)
npx prisma migrate dev

# Prod’da apply
npx prisma migrate deploy
```

Repo’da baseline migratsiya mavjud: `prisma/migrations/000_init`.

## 4) Seed data + initial admin

Seed fayl: `backend/prisma/seed.ts`

```bash
cd backend
npm run db:seed
```

Default login:

- `admin@uniflow.com` / `admin123`

Xohlasangiz override qiling:

```bash
set SEED_ADMIN_EMAIL=your@email.com
set SEED_ADMIN_PASSWORD=StrongPass123
npm run db:seed
```

## 5) AI API Security

AI endpointlar endi **authsiz** ishlamaydi:

- `GET /api/ai/context` — authenticated (aggregated context)
- `GET /api/ai/search` — **ADMIN-only** (sensitive data bo‘lishi mumkin)
- `POST /api/ai/chat` — authenticated

## 6) Dev workflow (Windows-friendly)

Backend dev runner `tsx` ga o‘tkazilgan:

```bash
cd backend
npm run dev
```

Agar eski runner kerak bo‘lsa:

```bash
npm run dev:legacy
```

Port conflict bo‘lsa (`3001`): Windows’da portni band qilgan process’ni topib o‘chirish:

```powershell
$conn = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) { taskkill /F /PID $conn.OwningProcess }
```

## 7) Backend + AI smoke test (frontend’dan oldin)

1. Health:

```bash
curl http://localhost:3001/health
```

2. Login:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@uniflow.com\",\"password\":\"admin123\"}"
```

3. AI context:

`Authorization: Bearer <token>` bilan:

```bash
curl http://localhost:3001/api/ai/context -H "Authorization: Bearer YOUR_TOKEN"
```
