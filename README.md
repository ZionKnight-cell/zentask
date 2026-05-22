# ZenTask

A clean, minimal task manager built with React, Vite, and Tailwind CSS. Installable as a PWA and deployable to Vercel.

**Features:**
- Today-focused task board: Now / Next / Later / Done today sections
- Quick-add with Enter key; optional stage, due date, and reminder per task
- Click task title to rename inline; Escape to cancel, Enter to save
- Duplicate any task (copies to Next stage)
- Move tasks between stages with a single tap
- Edit due date and reminder on existing tasks via the pencil button
- Human-friendly due dates (Today, Tomorrow, Overdue, Month Day); overdue tasks float to the top
- Time-based reminder alarms with browser notifications (when permission granted)
- Reminder labels on tasks: "Today 6:30 PM", "Tomorrow 9:00 AM", "Overdue"
- In-app alarm toast as fallback when browser notifications are off
- Notification permission UI: enable, status display, send test notification
- Search / filter tasks across all sections
- Copy today's plan to clipboard as formatted text
- Clear completed tasks with confirmation
- Export / import JSON backup (forward-compatible)
- Progress bar with live stats
- Light and dark theme, persisted in localStorage
- Fully offline-capable via service worker (PWA)
- Data persisted in browser localStorage — no account or backend needed

## Local Development

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build     # type-check + Vite build
npm run preview   # preview the production build locally
```

## Deploy to Vercel

This project includes a `vercel.json` for zero-config Vercel deployment:

```bash
vercel deploy --prod
```

Or connect the GitHub repository at [vercel.com](https://vercel.com) for automatic deployments on every push.

## PWA Install

When served over HTTPS (e.g. on Vercel), browsers will offer an **Install** prompt. The app works fully offline after installation.

## Reminder Notifications

ZenTask uses the browser Notification API. Permission is never requested automatically — click **Enable** in the app UI when prompted.

**How reminders work:**
- Reminders are checked when the app loads and every 60 seconds while open
- Missed reminders (app was closed) are shown shortly after reopening, if still relevant
- Each reminder fires once and is tracked in `localStorage` to avoid duplicates across refreshes
- Browser notifications use `serviceWorkerRegistration.showNotification()` when a service worker is active, falling back to `new Notification()`

**Browser/PWA limitation:** There is no guaranteed background delivery. Reminders only fire when the app is open or when you reopen it. For best results, keep the installed PWA running. Exact background behavior depends on your browser and OS.

**To test locally:** Run `npm run dev`, open the app, click **Enable** in the notification row, then click **Send test** to verify notifications work.

## Tech Stack

- [React 19](https://react.dev)
- [Vite 6](https://vite.dev)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Motion](https://motion.dev) (animations)
- [Lucide React](https://lucide.dev) (icons)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app)

## Repository

[github.com/ZionKnight-cell/zentask](https://github.com/ZionKnight-cell/zentask)
