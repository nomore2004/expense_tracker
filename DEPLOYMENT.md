# Production Deployment Guide: Roommate Expense Tracker

This document provides step-by-step instructions for deploying the Roommate Expense Tracker application to **Vercel** connected to a **Managed Cloud MySQL** database.

---

## 1. Managed Cloud MySQL Database Setup

Choose any cloud MySQL provider (such as **Aiven MySQL**, **PlanetScale**, **AWS RDS MySQL**, or **Railway MySQL**).

### 1.1 Create the Database
1. Provision a MySQL 8.0+ instance.
2. Create a database called `roommate_expense_tracker` with character set `utf8mb4` and collation `utf8mb4_unicode_ci`.
3. Note your connection details:
   - Hostname (e.g. `mysql-instance.example.com`)
   - Port (typically `3306`)
   - Username (e.g. `app_user`)
   - Password (secure password)
   - Database name (`roommate_expense_tracker`)

### 1.2 Format the Production `DATABASE_URL`
Format the connection string with SSL and connection pooling limits suitable for serverless functions:
```
DATABASE_URL="mysql://app_user:YourSecurePassword@mysql-instance.example.com:3306/roommate_expense_tracker?sslaccept=strict&connection_limit=10"
```

---

## 2. Running Production Database Migrations Safely

> **CRITICAL RULE**: Never use `prisma db push` or `prisma migrate reset` in production. These commands can result in accidental schema drift or catastrophic data loss.

### 2.1 Apply Migrations to Production
To apply pending migrations safely:
```bash
# Run non-destructive production migrations
npx prisma migrate deploy
```
This executes the exact SQL scripts stored in `prisma/migrations/20261001000000_init/migration.sql` without modifying or deleting existing records.

### 2.2 Optional Seeding (New Household Setup Only)
If you wish to seed initial accounts, run:
```bash
npm run prisma:seed
```
*Note: Do not run this on an established production database with live roommate data.*

---

## 3. Deploying to Vercel

### 3.1 Push Code to GitHub / GitLab / Bitbucket
Ensure `.env` and `.env.local` are not committed:
```bash
git init
git add .
git commit -m "feat: complete production-ready roommate expense tracker"
git branch -M main
git remote add origin https://github.com/<your-username>/roommate-expense-tracker.git
git push -u origin main
```

### 3.2 Import Project into Vercel
1. Log in to [vercel.com](https://vercel.com) and click **"Add New Project"**.
2. Select your repository.
3. Keep default build settings:
   - **Framework Preset**: Next.js
   - **Build Command**: `prisma generate && next build` (configured in `package.json`)
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

### 3.3 Configure Environment Variables in Vercel
In the Vercel dashboard under **Settings > Environment Variables**, add:

| Key | Value | Environment |
| :--- | :--- | :--- |
| `DATABASE_URL` | `mysql://<user>:<password>@<host>:3306/<database>?sslaccept=strict&connection_limit=10` | Production, Preview |
| `AUTH_SECRET` | 32+ character random secret (e.g. generated via `openssl rand -base64 32`) | Production, Preview |
| `NEXT_PUBLIC_APP_URL` | `https://your-project-name.vercel.app` | Production |

### 3.4 Deploy
Click **"Deploy"**. Vercel will:
1. Run `npm install`
2. Execute `prisma generate` to compile the type-safe client
3. Compile and optimize the Next.js pages and Server Actions
4. Deploy the application globally to the Vercel Edge Network.

---

## 4. Production Smoke Test Verification Checklist

Once the deployment URL is active (e.g. `https://your-roommate-tracker.vercel.app`), perform the following 12 verification tests:

| # | Test Case | Action | Expected Result |
| :---: | :--- | :--- | :--- |
| **1** | **Homepage Loads** | Navigate to `/` | Clean landing page displays with "Log In" and "Create / Join Household" buttons. |
| **2** | **Registration (User 1)** | Register User 1 ("Alex", `alex@test.com`, new household "Flat 4B") | Household created. User 1 logged in and redirected to `/expenses`. |
| **3** | **Household Joining (Users 2 & 3)** | Copy Household ID from DB/Profile. Register User 2 ("Brian") and User 3 ("Charlie") joining that Household ID. | Both users join "Flat 4B". System verifies 3 roommates belong to the same household. |
| **4** | **Shared Expense Creation** | Log in as Alex. Add expense "Groceries" for ₹60.00, select SHARED with A, B, and C. | Expense is created. Splits allocated: ₹20.00 each. |
| **5** | **Splits Verification** | View `/expenses`. Inspect the "Groceries" entry. | Payer is Alex (₹60.00); splits show Alex: ₹20.00, Brian: ₹20.00, Charlie: ₹20.00. |
| **6** | **Balance Calculation** | Navigate to dashboard `/`. | Alex has balance **+₹40.00** (Owed). Brian has **-₹20.00** (Owes). Charlie has **-₹20.00** (Owes). |
| **7** | **Personal Expense** | Add expense "Prescription" for ₹500.00, paid by Alex, assigned to Brian. | Alex: +₹540.00, Brian: -₹520.00, Charlie: -₹20.00. |
| **8** | **Custom Expense** | Add expense "Electricity" for ₹100.00: A = ₹30.00, B = ₹40.00, C = ₹30.00. | Invariant check succeeds. All balances update accurately. |
| **9** | **Settlement Recording** | Log in as Brian. Click "+ Settle Debt". Pay ₹20.00 to Alex. | Settlement recorded atomically with timestamp and optional note. |
| **10** | **Balance Update Verification** | Check dashboard `/`. | Brian's debt reduces by ₹20.00; Alex's credit reduces by ₹20.00. Invariant $\sum \text{balances} \equiv 0$. |
| **11** | **Expense & Settlement History** | Visit `/expenses` and `/settlements`. | History feeds display full historical records with timestamps and payer/receiver details. |
| **12** | **Unauthorized Access Check** | Attempt to view `/expenses` or `/settlements` in an Incognito tab without logging in. | System redirects immediately to `/login`. Direct API calls reject with `UNAUTHENTICATED`. |
