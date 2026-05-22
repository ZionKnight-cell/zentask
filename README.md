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
- Time-based reminder alarms
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

## Tech Stack

- [React 19](https://react.dev)
- [Vite 6](https://vite.dev)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Motion](https://motion.dev) (animations)
- [Lucide React](https://lucide.dev) (icons)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app)

## Repository

[github.com/ZionKnight-cell/zentask](https://github.com/ZionKnight-cell/zentask)
