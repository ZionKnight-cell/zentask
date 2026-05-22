# ZenTask

A clean, minimal task manager built with React, Vite, and Tailwind CSS. Installable as a PWA and deployable to Vercel.

**Features:**
- Add, complete, and delete tasks
- Set time-based reminders with alarm notifications
- Filter tasks by active / all / completed
- Progress bar with live stats
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
