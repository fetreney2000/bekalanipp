# Bekalan Farmasi - Chakra UI Rebuild

Sistem Bekalan Ubat (In-Patient Pharmacy) - Hospital Keningau

Rebuilt with **Next.js 16**, **Chakra UI v3**, **MongoDB Atlas**, and **Vercel**.

## Features

- **Dashboard** - Quota warnings, stats, monthly status
- **Rekod Inden** - Create new pharmacy supply orders (FS, EMT, AOH)
- **Butiran Inden** - View, edit, and manage order history
- **Senarai Inden** - Monthly records with live elapsed time tracking
- **Laporan** - Daily/weekly/monthly/yearly usage reports with quota recommendations
- **Urus Wad/Jabatan** - Manage wards and departments
- **Urus Item/Ubat** - Manage items and medications
- **Katalog Wad/Jabatan** - Ward-item catalog with quotas
- **Pentadbiran** - Admin panel with database maintenance

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | Chakra UI v3 |
| Database | MongoDB Atlas (M0 Free Tier) |
| Hosting | Vercel (Free Tier) |
| Language | TypeScript |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `ADMIN_PASSWORD` | Admin panel password (default: 972233) |

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

## Deployment

1. Create MongoDB Atlas M0 cluster
2. Create Vercel project and import from GitHub
3. Set `MONGODB_URI` and `ADMIN_PASSWORD` in Vercel dashboard
4. Deploy

## Known Limitations

- Backups are managed by MongoDB Atlas, not local file backups
- NTP time sync not available (uses server time on Vercel)
- No SQLite VACUUM/optimize (handled by MongoDB Atlas)
- File-based backup download not available (use Atlas export instead)

## Author

Ahmad Fetre Bin Mohammad Zime - 2026
