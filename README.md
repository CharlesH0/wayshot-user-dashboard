# WayShot User Analytics Dashboard

Paid user analytics dashboard for WayShot, powered by PostHog data.

## Live
https://wayshotdata.xiaomingai.net

## Features

### Overview (Dashboard)
- Paid user group stats (Churned / High-Value / Annual / Other)
- Key metrics summary
- User list entry point

### User Detail
- User info card (total revenue, payment count, status, source)
- Unified activity timeline (photos / uploads / saves / payments by date)
- Behavior trend chart (photos / saves / uploads / payments line chart)

## Tech Stack
- React 18 + Vite + Tailwind CSS
- Recharts
- PostHog HogQL API
- Daily auto-sync via cron

## Submit Requests
Please create Issues with:
1. What feature / change you need
2. Expected display format
3. Priority (High / Medium / Low)

## Setup
```bash
cp .env.example .env
# Fill in your PostHog credentials
npm install
npm run dev
```

## Deployment
Data sync + build + deploy is handled automatically.
