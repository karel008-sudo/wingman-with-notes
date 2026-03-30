# Wingman with notes

> A production-ready, offline-first gym training diary built as a Progressive Web App — installable on iPhone with zero backend infrastructure.

**[Live Demo →](https://gym-diary-kp.netlify.app)**

---

## Overview

Wingman is a mobile-first PWA that lets athletes track workouts, monitor progress over time, and celebrate personal records — all stored locally in the browser with no account or server required.

The project was built to explore and demonstrate **local-first application architecture**, **PWA capabilities on iOS**, and **production-quality mobile UX** with React.

---

## Features

### Core
- **Workout logging** — add exercises from a curated library, log sets with weight and reps, auto-fill from last session
- **Personal Record detection** — automatically detects new PRs on save, triggers haptic feedback and a celebration modal
- **History & filtering** — searchable workout history filterable by date range, muscle group, and exercise name
- **Progress charts** — per-exercise trend charts (max weight, volume, max reps) + weekly volume overview
- **Dashboard** — motivational greeting, workout streak, weekly progress vs. previous week, 8-week volume chart, recent achievements
- **Absolute PRs tracker** — curated all-time bests with duplicate protection (won't silently overwrite a higher record with a lower value)
- **Exercise library** — 28 pre-seeded exercises across 7 muscle groups, fully editable with unilateral exercise support (reps × 2 for volume calculations)

### UX & Mobile
- **Installable PWA** — works as a standalone app on iPhone via Safari → Add to Home Screen
- **Offline-first** — all data lives in IndexedDB, no network required after initial load
- **Haptic feedback** — light, medium, success, and PR-specific vibration patterns via Web Vibration API
- **iOS safe areas** — correct handling of Dynamic Island, status bar, and home indicator on all screens
- **Undo delete** — 5-second undo toast after workout deletion, restores complete workout + sets
- **Sticky save button** — save CTA stays visible while scrolling through a long workout form
- **Auto-update** — service worker handles background updates; users always run the latest version

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | React 19 + Vite 8 | Fast dev experience, modern React features |
| Styling | Tailwind CSS v4 | Utility-first with consistent design tokens |
| Local DB | [Dexie.js](https://dexie.org/) | Clean IndexedDB wrapper with reactive `useLiveQuery` |
| Charts | Recharts | Composable chart primitives, works well on mobile |
| PWA | vite-plugin-pwa + Workbox | Service worker, manifest, offline caching |
| Deployment | Netlify | Zero-config CI/CD, free HTTPS, global CDN |

---

## Architecture

### Local-first data layer

All data is persisted in **IndexedDB** via Dexie.js. There is no backend, no authentication, and no network dependency after the app loads.

```
IndexedDB (GymDiary)
├── exercises    — exercise library (seeded, user-editable)
├── workouts     — workout sessions with date and optional note
├── sets         — individual sets linked to workouts and exercises
└── absolutePRs  — curated all-time personal records
```

Dexie's `useLiveQuery` hook provides reactive data binding — any component that reads from the DB automatically re-renders when that data changes.

### PWA setup

- **Service worker** registered with `registerType: 'autoUpdate'` — new deployments are picked up in the background
- **Web App Manifest** configures standalone display, theme color, and custom icons
- **`viewport-fit=cover`** combined with `env(safe-area-inset-*)` CSS variables for correct rendering on notched iPhones

### Design system

A consistent set of design tokens is defined in `src/index.css` and applied inline throughout the components:

```
Background:  #0b0b11     Surface:  rgba(255,255,255,0.04)
Primary:     #8b5cf6     Danger:   #f43f5e
Text-1:      #f8f8ff     Text-3:   #71717a
```

---

## Project Structure

```
src/
├── pages/
│   ├── Dashboard.jsx     — streak, volume trends, achievements
│   ├── Log.jsx           — workout creation flow
│   ├── History.jsx       — workout list + stats view with filters
│   ├── Reports.jsx       — per-exercise charts + daily overview
│   ├── Exercises.jsx     — exercise library management
│   └── AbsolutePRs.jsx   — all-time best lifts tracker
├── db.js                 — Dexie schema + seed data + reconciliation logic
├── haptic.js             — Web Vibration API wrapper
├── importHistory.js      — historical data import utility
└── App.jsx               — tab navigation shell
```

---

## Getting Started

```bash
# Install dependencies
npm install --legacy-peer-deps

# Start dev server (accessible on local network)
npm run dev -- --host

# Production build
npm run build

# Deploy to Netlify (requires valid token in deploy.sh)
bash deploy.sh
```

---

## Notable Implementation Details

**Unilateral exercise support** — exercises like "Leg Extension One Leg" are flagged as `unilateral: true`. Volume calculations automatically apply a ×2 multiplier so totals correctly reflect both sides.

**PR protection** — when adding a new Absolute PR for an exercise that already has a record, the app compares weights. A lower value shows a warning modal with options to keep the current best or override explicitly — it never silently overwrites.

**Schema migrations** — Dexie's versioned schema system handles IndexedDB migrations. A `db.on('ready')` handler reconciles the exercise library on every load, removing stale entries and adding missing ones without touching user workout data.

**Sparkline charts in history** — each exercise in the workout history detail renders a lightweight inline SVG sparkline showing max weight trend across all sessions, with the current session highlighted.

---

## Deployment

The app is deployed via a single API call to Netlify using a zip deploy:

```bash
# deploy.sh
zip -r /tmp/dist.zip dist/
curl -X POST "https://api.netlify.com/api/v1/sites/$SITE_ID/deploys" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/zip" \
  --data-binary @/tmp/dist.zip
```

No CI/CD pipeline required — build and ship in ~30 seconds.

---

## License

MIT
