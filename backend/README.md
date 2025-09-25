# Deadline Backend

Backend API for Deadline Manager Telegram Mini-App.

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```env
MONGODB_URI=mongodb://localhost:27017/deadlineapp
TELEGRAM_BOT_TOKEN=your-bot-token
```

3. Start MongoDB locally or use MongoDB Atlas URI

4. Run development server:
```bash
npm run dev
```

## Production Deployment (Render)

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set environment variables:
   - `NODE_ENV=production`
   - `MONGODB_URI=your-mongodb-atlas-uri`
   - `TELEGRAM_BOT_TOKEN=your-bot-token`

4. Deploy

## API Endpoints

- `GET /api` - Health check
- `GET /api/health` - Detailed health status
- `GET /api/test` - Test endpoint
- `GET /api/tasks/:userId` - Get user tasks
- `POST /api/tasks/:userId` - Save user tasks
- `DELETE /api/tasks/:userId/:date` - Delete tasks for date
- `POST /api/remind/:userId` - Send reminder (placeholder)

## Development Mode

If MongoDB is not available, the server runs in development mode and simulates database operations.
