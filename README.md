# Sistem Rekod FS, EMT, AOH - Jabatan Farmasi Hospital Keningau

Sistem Pengurusan Bekalan Ubat (In-Patient Pharmacy) - Hospital Keningau

Built with **Next.js 16**, **Mantine UI** (shadcn violet theme), **MongoDB Atlas**, and **Vercel**.

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
| UI | Mantine UI (shadcn violet theme) |
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

The app automatically creates MongoDB indexes on first dashboard load:

- `orders`: order_date, order_number (unique), ward_id, id (unique)
- `order_items`: order_id, item_id
- `wards`: id (unique)
- `items`: id (unique)
- `ward_catalog`: ward_id + item_id (unique compound)

## Deployment

1. Create MongoDB Atlas M0 cluster
2. Create Vercel project and import from GitHub
3. Set `MONGODB_URI` in Vercel dashboard
4. Deploy

## Author

Ahmad Fetre Bin Mohammad Zime - 2026
