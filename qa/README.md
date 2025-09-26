# QA Suite

Автоматизированные сценарии и документация для регрессионной проверки Deadline Mini-App.

## Структура
- `checklist.md` — пошаговый сценарий пользовательского тестирования и проверки инфраструктуры.
- `scripts/api-smoke.js` — быстрый прогон REST API.
- `tests/user-flow.spec.ts` — Playwright сценарий симуляции пользователя (mobile viewport).

## Быстрый старт
1. Установите зависимости:
   ```bash
   npm install
   ```
2. (Опционально) Установите браузеры Playwright:
   ```bash
   npx playwright install --with-deps
   ```
3. Укажите URL окружения:
   ```bash
   export QA_API_BASE="https://api.deadline.185-241-195-19.sslip.io/api"
   export QA_FRONTEND_URL="https://deadline-frontend.hb.bizmrg.com"
   ```
4. Запустите проверки:
   ```bash
   npm run qa:all
   ```

## Отдельные команды
- `npm run qa:api` — только REST API smoke.
- `npm run qa:ui` — UI сценарий (требуется запущенный фронтенд; можно настроить через `QA_FRONTEND_URL`).

Логи и артефакты Playwright (скриншоты, trace) сохраняются в `playwright-report/` при падениях.
