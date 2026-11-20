# GrowthDesk 📈

A customer management and growth platform built for local businesses (salons, gyms, restaurants, coaching centres, and clinics). Every business has an isolated account powered by Supabase Row Level Security (RLS).

---

## Tech Stack
- **Frontend**: React 18, Vite, plain JavaScript (JSX)
- **Routing**: react-router-dom v6
- **Database & Auth**: Supabase (@supabase/supabase-js v2, Postgres, RLS)
- **Styling**: Clean, responsive plain CSS (desktop sidebar + mobile bottom nav)
- **Deployment**: Vercel (with `vercel.json` SPA rewrite)

---

## 1. Creating a Supabase Project & Running `schema.sql`

1. Go to **[database.new](https://database.new)** (or log in to [supabase.com](https://supabase.com)).
2. Click **New project**:
   - Choose your Organization.
   - Enter **Project Name** (e.g. `growth-desk`).
   - Set a secure database password (save it safely).
   - Select a Region closest to you or your users.
   - Choose the **Free** pricing tier.
3. Once the database is ready (takes ~1-2 minutes):
   - In the left sidebar, click the **SQL Editor** icon (`>_`).
   - Click **New query**.
   - Copy the entire contents of `supabase/schema.sql` from this repository and paste it into the query window.
   - Click **Run** (or press `Cmd/Ctrl + Enter`).
   - You should see `Success. No rows returned`. All 4 tables (`businesses`, `customers`, `follow_ups`, `campaigns`), RLS policies, performance indexes, and the auto-profile signup trigger are now initialized.

---

## 2. Where to Find the Project URL and Anon Key

1. In your Supabase project dashboard, open the left sidebar and click **Project Settings** (gear icon at the bottom).
2. Click **API** (or **API Keys**):
   - **Project URL**: Found under *Project URL* (e.g., `https://abcdefghijkl.supabase.co`).
   - **Publishable / anon key**: Copy the client-safe public key (`sb_publishable_...` or the legacy JWT `anon` `eyJhbGciOi...`).
   - ⚠️ **Important Security Rule**: *Never* copy or use the `service_role` key in frontend code. GrowthDesk strictly uses the public anon key with Row Level Security.

---

## 3. How Email Confirmation Works & Turning It Off for Testing

By default, Supabase sends a verification email before allowing new users to sign in. To sign in immediately during local development and testing:

1. In the Supabase dashboard, click the **Authentication** icon (person icon) in the left sidebar.
2. Select **Providers** under Configuration, then click **Email**.
3. Scroll down and toggle off **"Confirm email"**.
4. Click **Save**.
   *(Note: For production, you can re-enable this anytime and configure custom SMTP in Supabase).*

---

## 4. Running Locally

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Steps
1. Clone or open the repository folder:
   ```bash
   cd "GROWTH DESK"
   ```
2. Create your `.env` file from the template:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and fill in your credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
4. Install exact pinned dependencies:
   ```bash
   npm install
   ```
5. Start the local development server:
   ```bash
   npm run dev
   ```
6. Open your browser at `http://localhost:5173`.
   - Click **Create an account** to sign up your first business.
   - Add clients, schedule follow-ups, and trigger WhatsApp messages!

---

## 5. Pushing to GitHub

1. Initialize git and commit:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Complete GrowthDesk application"
   ```
2. Create a new repository on GitHub (e.g., `growth-desk`).
3. Link your remote repository and push:
   ```bash
   git remote add origin https://github.com/<your-username>/growth-desk.git
   git branch -M main
   git push -u origin main
   ```

---

## 6. Deploying to Vercel

1. Log in to [vercel.com](https://vercel.com).
2. Click **Add New...** → **Project**.
3. Import your `growth-desk` GitHub repository.
4. In the **Configure Project** screen:
   - Framework Preset: **Vite**
   - Root Directory: `./`
5. Expand **Environment Variables** and add:
   - `VITE_SUPABASE_URL` = `https://your-project-id.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your-supabase-anon-key`
6. Click **Deploy**.
7. The included `vercel.json` ensures client-side routing works cleanly without 404s on page refresh:
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```

---

## 7. Adding the Vercel URL to Supabase Auth URLs

After your Vercel deployment completes:
1. Copy your live Vercel production URL (e.g., `https://growth-desk.vercel.app`).
2. Go to your **Supabase Dashboard** → **Authentication** → **URL Configuration**.
3. Set **Site URL** to your Vercel URL: `https://growth-desk.vercel.app`.
4. In **Redirect URLs**, add:
   - `https://growth-desk.vercel.app/**`
   - `http://localhost:5173/**` (for local development)
5. Click **Save**.

---

## 8. Troubleshooting & Common Issues

| Issue | Cause | Fix |
|---|---|---|
| **"Supabase Configuration Missing"** alert on screen | `.env` file is missing or has placeholder values | Check `.env` in the project root. Ensure variables are named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then restart `npm run dev`. |
| **"Email not confirmed"** on login | Supabase Auth email confirmation is enabled | Either check your inbox for the confirmation link, or disable "Confirm email" in Supabase Auth -> Providers -> Email. |
| **404 error when refreshing on Vercel** | Missing SPA rewrite configuration | Ensure `vercel.json` exists in your repository root with the SPA rewrite rule. |
| **"new row violates row-level security policy"** | RLS policy blocked insert or user is unauthenticated | Ensure `supabase/schema.sql` was executed completely. All writes require an authenticated session where `business_id = auth.uid()`. |
| **WhatsApp link doesn't open message** | Invalid phone format or missing country code | Enter phone number with country code, or set the Default Country Code in **Settings**. The phone must be 8-15 digits. |
| **Formula Injection Warning in CSV** | Formula protection prefix | GrowthDesk automatically prepends `'` (single quote) to any cell starting with `=`, `+`, `-`, or `@` to protect your spreadsheets against CSV formula injection attacks. |

---

## Project Structure
```text
GROWTH DESK/
├── index.html
├── package.json
├── vercel.json
├── vite.config.js
├── .env.example
├── .gitignore
├── PROGRESS.md
├── README.md
├── supabase/
│   └── schema.sql              # Tables, RLS, auth triggers, test queries
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── lib/
    │   ├── supabaseClient.js   # Supabase client with graceful fallback
    │   ├── AuthContext.jsx      # Auth state & business profile provider
    │   ├── phoneUtils.js       # Phone normalization & WhatsApp links
    │   └── dataTools.js        # CSV export, JSON backup & relational restore
    ├── components/
    │   ├── Layout.jsx          # Desktop sidebar + mobile bottom nav
    │   ├── ProtectedRoute.jsx  # Auth guard
    │   ├── CustomerModal.jsx   # Add/Edit customer modal
    │   ├── FollowUpModal.jsx   # Schedule follow-up modal
    │   └── CampaignModal.jsx   # Create/Edit broadcast campaign modal
    ├── pages/
    │   ├── Dashboard.jsx       # Business KPIs, overdue alerts, recent clients
    │   ├── Customers.jsx       # Client list, search, filter, detail view
    │   ├── FollowUps.jsx       # Follow-up reminders, overdue highlights
    │   ├── Messages.jsx        # 1-click WhatsApp message generator
    │   ├── Campaigns.jsx       # Broadcast campaigns & safe send queue
    │   ├── Settings.jsx        # Business profile & data backup / restore
    │   ├── Login.jsx           # Sign in
    │   ├── SignUp.jsx          # Sign up with business profile
    │   └── NotFound.jsx        # 404 page
    └── styles/
        └── global.css          # Plain responsive CSS
```

