# Student Deadline Manager - Telegram Mini-App

A modern Telegram Mini-App designed to help students manage their tasks and deadlines efficiently. Features a clean UI with Tasks, Calendar, and Profile screens.

## Features

- **Tasks Screen:** Today's Deadline and Upcoming tasks in card format.
- **Calendar Screen:** Monthly calendar view with task indicators.
- **Profile Screen:** Task statistics.
- **Bottom Navigation:** Switch between screens.
- **Add Tasks:** Modal with date, category, priority selection.
- **Checkboxes:** Mark tasks as completed.
- **Themes:** Light/Dark mode.
- **Sync:** Data stored in MongoDB, tied to Telegram user ID.
- **Telegram Web App Integration**

## UI Screenshots
- Main Screen: "Tasks" header, floating + button, task cards with checkboxes.
- Today's Deadline: Cards for today's tasks.
- Upcoming: List of upcoming tasks with dates.
- Navigation: Tasks, Calendar, Profile at bottom.

## Technologies
- Frontend: Vite + Vanilla JS
- Backend: Node.js + Express + MongoDB
- Hosting: Vercel (frontend), Render (backend)

## Setup
1. Clone repos.
2. Frontend: `npm install`, `npm run build`.
3. Backend: `npm install`, set env vars, `npm start`.
4. Deploy to Vercel/Render.
5. Configure Telegram bot.
