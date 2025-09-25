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
- Hosting: VK Cloud (Object Storage + CDN, Compute/Docker or Managed Kubernetes)

## Setup (Local Development)
1. Clone repo.
2. Frontend: `npm install`, `npm run dev`.
3. Backend: `cd backend && npm install`, copy `.env.example` to `.env`, fill secrets, `npm run dev`.
4. Configure Telegram bot for local testing.

## Deploying to VK Cloud

### Frontend (Object Storage + CDN)
1. **Build:** `npm install && npm run build` (generates `dist/`).
2. **Upload:**
	- Install [`mc`](https://min.io/docs/minio/linux/reference/minio-mc.html) (MinIO client) and configure alias: `mc alias set vkcloud https://hb.bizmrg.com <ACCESS_KEY> <SECRET_KEY> --api S3v4`.
	- Sync build artifacts: `mc mirror --overwrite dist/ vkcloud/deadline-frontend`.
3. **Access:**
	- В панели VK Cloud сделайте бакет публичным **или** создайте CDN-ресурс с источником `deadline-frontend.hb.bizmrg.com`.
	- Включите SPA fallback (404 → `/index.html`).
	- Добавьте CORS правила для доменов фронтенда и API (`GET`, `HEAD`, `OPTIONS`).

### Backend (Docker on Compute Cloud)
1. Создайте `.env` в `backend/` на основе `.env.example` и задайте `MONGODB_URI`, `TELEGRAM_BOT_TOKEN`.
2. Соберите и запустите контейнер на локальной машине: `docker compose up --build`.
3. Разверните на ВМ VK Cloud (Ubuntu 22.04):
	- Установите Docker и Docker Compose.
	- Скопируйте проект на сервер.
	- Запустите `docker compose up -d --build`.
4. Настройте обратный прокси (Nginx) и выдайте публичный домен/SSL.
5. Убедитесь, что `backend/server.js` CORS origin содержит ваш фронтенд домен.

### MongoDB
- Используйте VK Cloud Managed MongoDB или MongoDB Atlas.
- Разрешите IP адреса ВМ/кластера.
- Проверьте подключение `curl https://<api-domain>/api/health`.

### Telegram Bot
- Установите `TELEGRAM_BOT_TOKEN` в переменных окружения backend.
- Обновите WebApp URL в BotFather на домен фронтенда.
