# Sistem Rekod FS, EMT, AOH - Jabatan Farmasi Hospital Keningau

Sistem Pengurusan Bekalan Ubat (In-Patient Pharmacy) - Hospital Keningau

Built with **Next.js 16**, **Mantine UI** (MantineHub pink preset), **MongoDB Atlas**, and **Vercel**.

## Features

- **Dashboard** - Quota warnings, stats, monthly status
- **Senarai Inden** - View, edit, and manage all inden records with detail modal
- **Rekod Inden** - Create new pharmacy supply orders (FS, EMT, AOH) with office hours auto-detection
- **Laporan** - Daily/weekly/monthly/yearly usage reports with quota recommendations and timing stats
- **Senarai Wad/Jabatan** - Manage wards and departments
- **Senarai Item/Ubat** - Manage items and medications
- **Katalog Wad/Jabatan** - Ward-item catalog with quotas
- **Hakcipta** - Developer information

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | Mantine UI (MantineHub pink preset) |
| Database | MongoDB Atlas (M0 Free Tier) |
| Hosting | Vercel (Free Tier) |
| Language | TypeScript |
| Date/Holiday | date-holidays (Sabah public holidays) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string |

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## MongoDB Schema

| Collection | Description |
|-----------|-------------|
| `wards` | Ward/department records with category (ward/not_ward) |
| `items` | Medicine/supply items |
| `ward_catalog` | Ward-item catalog with max_per_order and monthly_quota |
| `orders` | Supply orders with type (FS/EMT/AOH), status, timing |
| `order_items` | Order line items with quantities |
| `counters` | Auto-increment ID counters |

## Database Optimization

Indexes are **not** created automatically — nothing in the app calls them on load. They are created by either:

- Running `npx tsx scripts/migrate.ts` (SQLite → MongoDB migration), or
- Manually `POST`-ing to `/api/admin/indexes`.

Both paths share the same definition in `src/lib/ensure-indexes.ts`:

- `orders`: id (unique), order_date, order_number (unique), ward_id
- `order_items`: order_id + item_id (unique compound), item_id
- `wards`: id (unique), name (unique)
- `items`: id (unique), name (unique)
- `ward_catalog`: ward_id + item_id (unique compound)

The unique compound index on `order_items` is safe because every order write
merges duplicate lines via `groupItems()` (`src/lib/order-utils.ts`), so an
order can never contain the same item twice.

## Deployment

1. Create MongoDB Atlas M0 cluster
2. Create Vercel project and import from GitHub
3. Set `MONGODB_URI` in Vercel dashboard
4. Deploy

## Author

Ahmad Fetre Bin Mohammad Zime - 2026
