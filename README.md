# VolleyMN — Volleyball Club App

TypeScript + React + Supabase-тай волейболын клубын вэб апп.

## Функцууд

### User (Хэрэглэгч)
- 🏠 **Нүүр** — Клубын танилцуулга, статистик
- ℹ️ **Бидний тухай** — Клубын түүх, амжилт
- 👥 **Баг** — Тоглогчдын жагсаалт
- 📞 **Холбоо барих** — Холбоо барих маягт
- 🔐 **Нэвтрэх / Бүртгүүлэх** — Supabase Auth
- 📅 **Хуваарь** — 7 хоногийн хувийн хуваарь харах

### Admin (Админ)
- 👤 Тоглогч сонгох
- 📅 7 хоногийн хуваарь тохируулах (нэмэх, засах, устгах)
- 💾 Supabase-д хадгалах

## Суулгах заавар

### 1. Supabase тохируулах

1. [supabase.com](https://supabase.com) дээр шинэ project үүсгэнэ
2. SQL Editor-т `supabase-schema.sql` файлын агуулгыг хуулж ажиллуулна
3. Project Settings → API хэсгээс URL болон anon key-г аваарай

### 2. Орчны хувьсагч

```bash
cp .env.example .env
```

`.env` файлд Supabase URL болон key-гаа оруулна:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-key
```

### 3. Апп ажиллуулах

```bash
npm install
npm run dev
```

### 4. Admin эрх олгох

Supabase SQL Editor-т:
```sql
update profiles set role = 'admin' where email = 'admin@example.com';
```

## Технологи

- **React 18** + **TypeScript**
- **Vite** (build tool)
- **React Router v6** (routing)
- **Supabase** (auth + database)
- **Lucide React** (icons)
- **Bebas Neue + Inter** (fonts)

## Дэлгэцийн зураг

| Нүүр | Хуваарь | Admin |
|------|---------|-------|
| Hero + Stats | 7 хоногийн grid | Тоглогч + хуваарь засагч |
