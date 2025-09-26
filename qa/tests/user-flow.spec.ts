/// <reference types="node" />
import { test, expect } from '@playwright/test';

const todayKey = new Date().toISOString().split('T')[0];
const taskNames = {
  starred: 'Автотест — избранная задача',
  completed: 'Автотест — завершенная задача',
};

test.describe('Deadline Mini-App пользовательский сценарий', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.addInitScript(() => window.localStorage.clear());
  });

  test('полный happy-path сценарий', async ({ page, baseURL }) => {
    const target = process.env.QA_FRONTEND_URL || baseURL;
    if (!target) {
      test.skip(true, 'Не указан base URL для фронтенда');
      return;
    }

    await page.goto(target, { waitUntil: 'networkidle' });
    await page.waitForSelector('#addTaskBtn', { timeout: 30_000 });

    // Добавляем и отмечаем избранную задачу
    await page.locator('#addTaskBtn').click();
    await page.locator('#newTask').fill(taskNames.starred);
    await page.locator('#taskDate').fill(todayKey);
    await page.locator('#taskCategory').selectOption('work');
    await page.locator('#taskPriority').selectOption('high');
    await page.locator('#saveTask').click();

    const starredCard = page.locator('.task-card').filter({ hasText: taskNames.starred });
    await expect(starredCard).toBeVisible();

    const starButton = starredCard.locator('button[data-action="star"]');
    await starButton.click();
    await expect(starButton).toHaveAttribute('aria-pressed', 'true');

    await page.locator('#filterStarred').selectOption('starred');
    await expect(starredCard).toBeVisible();

    await page.locator('#resetFilters').click();
    await expect(page.locator('#filterStarred')).toHaveValue('');

    await starredCard.locator('button[data-action="delete"]').click();
    await expect(page.locator('.task-card').filter({ hasText: taskNames.starred })).toHaveCount(0);
    await expect(page.locator('.today-deadline')).toContainText('Нет задач на сегодня');

    // Добавляем вторую задачу и завершаем её
  await page.locator('#addTaskBtn').click();
    await page.locator('#newTask').fill(taskNames.completed);
    await page.locator('#taskDate').fill(todayKey);
    await page.locator('#taskCategory').selectOption('personal');
    await page.locator('#taskPriority').selectOption('medium');
    await page.locator('#saveTask').click();

    const completedCard = page.locator('.task-card').filter({ hasText: taskNames.completed });
    await expect(completedCard).toBeVisible();

    await completedCard.locator('input[type="checkbox"]').check();
    await expect(page.locator('.task-card').filter({ hasText: taskNames.completed })).toHaveCount(0);
    await expect(page.locator('.today-deadline')).toContainText('Нет задач на сегодня');
    await expect(page.locator('text=Прогресс: 100%')).toBeVisible();

    // Навигация по вкладкам
    await page.locator('button[data-view="calendar"]').click();
    await expect(page.locator('.calendar')).toBeVisible();

    await page.locator('button[data-view="profile"]').click();
    await expect(page.locator('.settings')).toBeVisible();
    await expect(page.locator('#themeToggle')).toBeVisible();
  });
});
