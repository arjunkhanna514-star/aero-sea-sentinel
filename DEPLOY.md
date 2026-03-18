# DEPLOYMENT GUIDE — Get Your Live URL in 30 Minutes

## WHAT YOU NEED TO DO (5 steps)

---

## STEP 1 — Create accounts (5 minutes)
Open these 4 websites and sign up (use Google login on all):

1. https://github.com       ← stores your code
2. https://supabase.com     ← free database
3. https://upstash.com      ← free redis
4. https://render.com       ← runs your backend
5. https://vercel.com       ← runs your frontend (your final URL)

---

## STEP 2 — Install Git (2 minutes)
Download: https://git-scm.com/download/win
Install it (just click Next → Next → Finish)

---

## STEP 3 — Push code to GitHub (3 minutes)

1. Go to https://github.com/new
2. Repository name: aero-sea-sentinel
3. Click "Create repository"
4. Copy the URL shown (e.g. https://github.com/yourname/aero-sea-sentinel.git)

Now open Command Prompt in your aero-sea-sentinel folder and run:

git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/YOUR_USERNAME/aero-sea-sentinel.git
git branch -M main
git push -u origin main

---

## STEP 4 — Get Database URL from Supabase (3 minutes)

1. Go to https://supabase.com → New Project
2. Name: sentinel | Password: Sentinel2025! | Region: pick nearest
3. Wait 2 minutes for it to create
4. Go to: Settings → Database → Connection String → URI
5. Copy it — looks like: postgresql://postgres:Sentinel2025!@db.xxxx.supabase.co:5432/postgres
6. SAVE THIS — you need it in Step 5

---

## STEP 5 — Get Redis URL from Upstash (2 minutes)

1. Go to https://upstash.com → Create Database
2. Name: sentinel | Type: Redis | Region: EU-West | Click Create
3. Copy the "REDIS_URL" — looks like: rediss://default:xxxxx@xxxx.upstash.io:6379
4. SAVE THIS — you need it in Step 6

---

## STEP 6 — Deploy Backend on Render (5 minutes)

1. Go to https://render.com → New → Web Service
2. Connect GitHub → select "aero-sea-sentinel"
3. Fill in:
   - Name: sentinel-backend
   - Root Directory: backend
   - Runtime: Node
   - Build Command: npm install
   - Start Command: node src/db/migrate.js && node src/index.js
4. Click "Advanced" → "Add Environment Variable" and add ALL of these:

   NODE_ENV          = production
   PORT              = 4000
   DB_URL            = <paste your Supabase URL from Step 4>
   REDIS_URL         = <paste your Upstash URL from Step 5>
   JWT_SECRET        = sentinel-secret-key-2025
   CORS_ORIGINS      = https://aero-sea-sentinel.vercel.app
   RATE_LIMIT_MAX_REQUESTS = 1000

5. Click "Create Web Service"
6. Wait 3-4 minutes
7. You will see a URL like: https://sentinel-backend.onrender.com
8. Open https://sentinel-backend.onrender.com/health in browser
   → You should see: {"status":"ok"}
9. Click "Shell" tab in Render → type: node src/db/seed.js → press Enter

---

## STEP 7 — Deploy Frontend on Vercel (3 minutes)

1. Go to https://vercel.com → New Project
2. Import from GitHub → select "aero-sea-sentinel"
3. Root Directory: frontend
4. Framework Preset: Vite
5. Click "Environment Variables" and add:

   VITE_API_URL = https://sentinel-backend.onrender.com/api/v1
   VITE_WS_URL  = wss://sentinel-backend.onrender.com/ws/telemetry

   (Replace sentinel-backend with YOUR actual Render URL from Step 6)

6. Click Deploy
7. Wait 1-2 minutes

---

## YOUR LIVE URL IS READY!

https://aero-sea-sentinel.vercel.app

Share this with anyone in the world!

Login with:
- Email: admin@sentinel.io
- Password: Sentinel2025!

---

## IF SOMETHING GOES WRONG

Backend not working?
→ Check https://sentinel-backend.onrender.com/health
→ If it shows error, check Render logs

Frontend shows blank page?
→ Check Vercel logs
→ Make sure VITE_API_URL is correct

Login not working?
→ Make sure you ran: node src/db/seed.js in Render shell

---

## NOTE ABOUT FREE PLAN
Render free tier sleeps after 15 minutes of no traffic.
First visit after sleeping takes ~30 seconds to wake up.
After that it's fast. This is normal on free plan.
