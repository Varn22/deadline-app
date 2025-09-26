import './style.css'

// App state
let currentView = 'tasks'; // 'tasks', 'calendar', 'profile'
let tasks = {};
let currentTheme = localStorage.getItem('theme') || 'dark';
let userId = null;
// UI state
let searchQuery = '';
let notifications = [];
let calendarDate = new Date(); // Current calendar view date
const isTelegramWebApp = typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp;
const isMobileDevice = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
let filterState = {
    priority: '',
    category: '',
    starred: '',
    sortBy: 'date'
};

const TASKS_STORAGE_KEY = 'tasks';
const CATEGORY_ICONS = {
    study: '📚',
    work: '💼',
    personal: '🏠',
    other: '📌'
};
const PRIORITY_LABELS = {
    high: '🔴 Высокий',
    medium: '🟡 Средний',
    low: '🟢 Низкий'
};

let renderQueued = false;
let tasksRevision = 0;
const upcomingTasksCache = {
    signature: '',
    data: []
};

function readTasksFromStorage() {
    if (typeof localStorage === 'undefined') return {};
    try {
        const raw = localStorage.getItem(TASKS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        console.warn('Cannot read tasks from storage:', error);
        return {};
    }
}

function persistTasksToStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
        console.warn('Cannot persist tasks to storage:', error);
    }
}

function cleanEmptyDates() {
    Object.keys(tasks).forEach(dateKey => {
        if (!Array.isArray(tasks[dateKey]) || tasks[dateKey].length === 0) {
            delete tasks[dateKey];
        }
    });
}

function mergeTaskCollections(primary = {}, secondary = {}) {
    const merged = {};
    const allDates = new Set([...Object.keys(primary), ...Object.keys(secondary)]);

    allDates.forEach(dateKey => {
        const primaryTasks = Array.isArray(primary[dateKey]) ? primary[dateKey] : [];
        const secondaryTasks = Array.isArray(secondary[dateKey]) ? secondary[dateKey] : [];
        const seen = new Set();
        const combined = [];

        primaryTasks.forEach(task => {
            const identifier = task?.created || `${task?.text || ''}-${task?.category || ''}-${task?.priority || ''}`;
            seen.add(identifier);
            combined.push(task);
        });

        secondaryTasks.forEach(task => {
            const identifier = task?.created || `${task?.text || ''}-${task?.category || ''}-${task?.priority || ''}`;
            if (!seen.has(identifier)) {
                seen.add(identifier);
                combined.push(task);
            }
        });

        if (combined.length > 0) {
            merged[dateKey] = combined;
        }
    });

    return merged;
}

function bumpTasksRevision() {
    tasksRevision += 1;
    upcomingTasksCache.signature = '';
    upcomingTasksCache.data = [];
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api'
    : '/api';

async function loadTasks() {
    const localSnapshot = readTasksFromStorage();

    if (!userId) {
        tasks = localSnapshot;
        cleanEmptyDates();
        persistTasksToStorage();
        bumpTasksRevision();
        return tasks;
    }

    try {
        const response = await fetch(`${API_BASE}/tasks/${userId}`);
        if (!response.ok) {
            throw new Error(`Failed to load tasks: ${response.status}`);
        }
        const serverTasks = await response.json();
        tasks = mergeTaskCollections(serverTasks, localSnapshot);
    } catch (error) {
        console.error('Error loading tasks:', error);
        tasks = localSnapshot;
    }

    cleanEmptyDates();
    persistTasksToStorage();
    bumpTasksRevision();
    return tasks;
}

async function saveTasks(date) {
    cleanEmptyDates();
    persistTasksToStorage();

    if (!userId || !date) {
        return;
    }

    try {
        await fetch(`${API_BASE}/tasks/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, tasks: tasks[date] || [] })
        });
    } catch (error) {
        console.error('Error saving tasks:', error);
    }
}

function applyTheme() {
    document.body.className = currentTheme;
}

function requestRender(immediate = false) {
    if (immediate) {
        renderQueued = false;
        renderApp();
        return;
    }

    if (renderQueued) return;
    renderQueued = true;
    const schedule = (typeof window !== 'undefined' && window.requestAnimationFrame) || (cb => setTimeout(cb, 16));
    schedule(() => {
        renderQueued = false;
        renderApp();
    });
}

function renderApp() {
    const app = document.querySelector('#app');
    let html = '';

    if (currentView === 'tasks') {
        html = renderTasksView();
    } else if (currentView === 'calendar') {
        html = renderCalendarView();
    } else if (currentView === 'profile') {
        html = renderProfileView();
    }

    // Bottom navigation
    html += `
        <nav class="bottom-nav">
            <button class="nav-item ${currentView === 'tasks' ? 'active' : ''}" data-view="tasks">
                <span class="nav-icon">📋</span>
                <span class="nav-label">Задачи</span>
            </button>
            <button class="nav-item ${currentView === 'calendar' ? 'active' : ''}" data-view="calendar">
                <span class="nav-icon">📅</span>
                <span class="nav-label">Календарь</span>
            </button>
            <button class="nav-item ${currentView === 'profile' ? 'active' : ''}" data-view="profile">
                <span class="nav-icon">👤</span>
                <span class="nav-label">Профиль</span>
            </button>
        </nav>
    `;

    app.innerHTML = html;

    // Setup events based on view
    setupGlobalEvents();
    if (currentView === 'tasks') setupTasksEvents();
    if (currentView === 'calendar') setupCalendarEvents();
    if (currentView === 'profile') setupProfileEvents();
}

function setupGlobalEvents() {
    if (globalEventsBound) return;
    globalEventsBound = true;
    
    // Navigation
    document.addEventListener('click', handleNavClick);
    
    // Modal close
    document.addEventListener('click', handleModalClose);

    // Immediate button feedback
    document.addEventListener('pointerdown', handleButtonPointerDown, { passive: true });
    document.addEventListener('pointerup', handleButtonPointerReset);
    document.addEventListener('pointercancel', handleButtonPointerReset);
}

function handleButtonPointerDown(e) {
    const button = e.target.closest('button');
    if (!button) return;
    button.classList.add('is-pressed');
}

function handleButtonPointerReset(e) {
    const targetButton = e && e.target && e.target.closest ? e.target.closest('button') : null;
    if (targetButton) {
        targetButton.classList.remove('is-pressed');
    }
    document.querySelectorAll('button.is-pressed').forEach(btn => btn.classList.remove('is-pressed'));
}

function handleNavClick(e) {
    if (e.target.closest('.nav-item')) {
        e.preventDefault();
        const navItem = e.target.closest('.nav-item');
        const view = navItem.dataset.view;
        if (view && view !== currentView) {
            currentView = view;
            requestRender(true);
        }
    }
}

function handleModalClose(e) {
    const closeTrigger = e.target.closest('[data-modal-close]');
    if (closeTrigger) {
        closeModal(closeTrigger.closest('.modal'));
        return;
    }

    if (e.target.classList && e.target.classList.contains('modal')) {
        closeModal(e.target);
    }
}

function closeModal(modal) {
    if (!modal) return;
    modal.style.display = 'none';
    if (modal.id === 'taskModal') {
        const saveBtn = modal.querySelector('#saveTask');
        if (saveBtn) {
            saveBtn.textContent = 'Сохранить задачу';
            saveBtn.dataset.edit = '';
            saveBtn.dataset.date = '';
            saveBtn.dataset.index = '';
        }
        const taskInput = modal.querySelector('#newTask');
        if (taskInput) taskInput.value = '';
        const dateInput = modal.querySelector('#taskDate');
        if (dateInput) dateInput.value = '';
        const title = modal.querySelector('#taskModalTitle');
        if (title) title.textContent = 'Новая задача';
    }

    if (!modal.id) {
        modal.remove();
    }
}

function renderTasksView() {
    const today = new Date().toISOString().split('T')[0];
    const { priority: prFilter, category: catFilter, starred: starFilter, sortBy } = filterState;
    const query = searchQuery.toLowerCase();

    const todayTasks = (tasks[today] || []).filter(task => {
        if (task.completed) return false;
        if (prFilter && task.priority !== prFilter) return false;
        if (catFilter && task.category !== catFilter) return false;
        if (starFilter === 'starred' && !task.starred) return false;
        if (query && !task.text.toLowerCase().includes(query)) return false;
        return true;
    });

    const upcomingTasks = getUpcomingTasks();
    const safeSearchValue = escapeHtml(searchQuery);

    const todayMarkup = todayTasks.length > 0
        ? todayTasks.map((task, index) => renderTaskCard({ date: today, task, index, isToday: true })).join('')
        : '<p class="empty-state">Нет задач на сегодня</p>';

    const upcomingMarkup = upcomingTasks.length > 0
        ? upcomingTasks.map(({ date, task, index }) => renderTaskCard({ date, task, index, isToday: date === today })).join('')
        : '<p class="empty-state">Нет предстоящих задач</p>';

    return `
        <header class="app-header">
            <h1>Задачи</h1>
            <button class="add-task-btn" id="addTaskBtn" type="button" aria-label="Добавить задачу">+</button>
        </header>

        <div class="content">
            <div class="filters">
                <div class="filter-search">
                    <label for="searchInput">🔍 Поиск</label>
                    <div class="search-input">
                        <input id="searchInput" type="text" placeholder="Введите текст задачи..." value="${safeSearchValue}" autocomplete="off" aria-label="Поиск по задачам" />
                        ${searchQuery ? '<button type="button" id="clearSearch" class="btn-icon search-clear" aria-label="Очистить поиск">✕</button>' : ''}
                    </div>
                </div>
                <div>
                    <label for="filterPriority">⚡ Приоритет</label>
                    <select id="filterPriority">
                        <option value="" ${prFilter === '' ? 'selected' : ''}>Все приоритеты</option>
                        <option value="high" ${prFilter === 'high' ? 'selected' : ''}>🔴 Высокий</option>
                        <option value="medium" ${prFilter === 'medium' ? 'selected' : ''}>🟡 Средний</option>
                        <option value="low" ${prFilter === 'low' ? 'selected' : ''}>🟢 Низкий</option>
                    </select>
                </div>
                <div>
                    <label for="filterCategory">📂 Категория</label>
                    <select id="filterCategory">
                        <option value="" ${catFilter === '' ? 'selected' : ''}>Все категории</option>
                        <option value="study" ${catFilter === 'study' ? 'selected' : ''}>📚 Учеба</option>
                        <option value="work" ${catFilter === 'work' ? 'selected' : ''}>💼 Работа</option>
                        <option value="personal" ${catFilter === 'personal' ? 'selected' : ''}>🏠 Личное</option>
                        <option value="other" ${catFilter === 'other' ? 'selected' : ''}>📌 Другое</option>
                    </select>
                </div>
                <div>
                    <label for="sortBy">📊 Сортировка</label>
                    <select id="sortBy">
                        <option value="date" ${sortBy === 'date' ? 'selected' : ''}>По дате</option>
                        <option value="priority" ${sortBy === 'priority' ? 'selected' : ''}>По приоритету</option>
                        <option value="category" ${sortBy === 'category' ? 'selected' : ''}>По категории</option>
                        <option value="text" ${sortBy === 'text' ? 'selected' : ''}>По алфавиту</option>
                    </select>
                </div>
                <div>
                    <label for="filterStarred">⭐ Избранные</label>
                    <select id="filterStarred">
                        <option value="" ${starFilter === '' ? 'selected' : ''}>Все задачи</option>
                        <option value="starred" ${starFilter === 'starred' ? 'selected' : ''}>Только избранные</option>
                    </select>
                </div>
                <div class="filters-actions">
                    <button type="button" id="resetFilters" class="btn-secondary">Сбросить фильтры</button>
                </div>
            </div>
            ${renderProgress()}
            <section class="today-deadline">
                <h2>Дедлайн сегодня</h2>
                ${todayMarkup}
            </section>

            <section class="upcoming">
                <h2>Предстоящие</h2>
                ${upcomingMarkup}
            </section>
        </div>

        <div id="taskModal" class="modal" style="display: none;">
            <div class="modal-content">
                <button type="button" class="close" aria-label="Закрыть" data-modal-close>&times;</button>
                <h3 id="taskModalTitle">Новая задача</h3>
                <input type="text" id="newTask" placeholder="Название задачи" autocomplete="off">
                <input type="date" id="taskDate" required>
                <select id="taskCategory">
                    <option value="study">Учеба</option>
                    <option value="work">Работа</option>
                    <option value="personal">Личное</option>
                    <option value="other">Другое</option>
                </select>
                <select id="taskPriority">
                    <option value="low">Низкий</option>
                    <option value="medium" selected>Средний</option>
                    <option value="high">Высокий</option>
                </select>
                <div class="modal-actions">
                    <button type="button" id="cancelTask" class="btn-secondary" data-modal-close>Отмена</button>
                    <button type="button" id="saveTask" class="btn-primary">Сохранить задачу</button>
                </div>
            </div>
        </div>
    `;
}

function renderCalendarView() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const currentDate = new Date();

    let calendarHtml = `
        <div class="calendar">
            <div class="calendar-header">
                <button class="nav-btn" id="prevMonth">‹</button>
                <h2>${calendarDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}</h2>
                <button class="nav-btn" id="nextMonth">›</button>
            </div>
            <div class="weekdays">
                <div>Вс</div><div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div>
            </div>
            <div class="days">
    `;

    // Empty cells
    for (let i = 0; i < firstDay; i++) {
        calendarHtml += '<div></div>';
    }

    // Days
    for (let day = 1; day <= lastDate; day++) {
        const dateKey = formatDateKey(year, month + 1, day);
        const hasTasks = tasks[dateKey] && tasks[dateKey].length > 0;
        const isToday = new Date().toDateString() === new Date(dateKey).toDateString();
        calendarHtml += `<div class="day ${hasTasks ? 'has-tasks' : ''} ${isToday ? 'today' : ''}" data-date="${dateKey}">${day}</div>`;
    }

    calendarHtml += `
            </div>
        </div>
        <div id="calendarModal" class="modal" style="display: none;">
            <div class="modal-content">
                <button type="button" class="close" aria-label="Закрыть" data-modal-close>&times;</button>
                <h3 id="calendarModalDate"></h3>
                <ul id="calendarTaskList"></ul>
            </div>
        </div>
    `;

    return `
        <header class="app-header">
            <h1>Календарь</h1>
        </header>
        <div class="content">
            ${calendarHtml}
        </div>
    `;
}

function renderProfileView() {
    const stats = getStats();
    return `
        <header class="app-header">
            <h1>Профиль</h1>
        </header>
        <div class="content">
            <div class="stats">
                <div>Всего задач: ${stats.total}</div>
                <div>Выполнено: ${stats.completed}</div>
                <div>Осталось: ${stats.pending}</div>
            </div>
            
            <div class="settings">
                <h3>Настройки</h3>
                <div class="setting-item">
                    <label for="themeToggle">Тема:</label>
                    <select id="themeToggle">
                        <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Светлая</option>
                        <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Тёмная</option>
                    </select>
                </div>
                
                <div class="setting-item">
                    <button id="exportBtn" class="btn-secondary">Экспорт задач</button>
                    <input type="file" id="importFile" accept=".json" style="display: none;">
                    <button id="importBtn" class="btn-secondary">Импорт задач</button>
                </div>
            </div>
        </div>
    `;
}

function renderProgress() {
    const stats = getStats();
    const percent = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;
    return `
      <div class="progress"><span style="width:${percent}%;"></span></div>
      <div style="font-size: 12px; color: var(--muted-text);">Прогресс: ${percent}%</div>
    `;
}

function renderTaskCard({ date, task, index, isToday }) {
    const priorityKey = task?.priority || 'medium';
    const categoryKey = task?.category || 'other';
    const safeText = escapeHtml(task?.text || '');
    const priorityLabel = escapeHtml(getPriorityLabel(priorityKey));
    const categoryLabel = escapeHtml(getCategoryLabel(categoryKey));
    const dueDateChip = !isToday ? `<span class="task-chip task-chip-date">${escapeHtml(formatTaskDate(date))}</span>` : '';
    const chips = `
        ${dueDateChip}
        <span class="task-chip task-chip-category">${categoryLabel}</span>
        <span class="task-chip task-chip-priority task-chip-priority-${priorityKey}">${priorityLabel}</span>
    `;
    const cardClasses = [task?.completed ? 'completed' : '', priorityKey ? `${priorityKey}-priority` : '']
        .filter(Boolean)
        .join(' ');
    const starred = Boolean(task?.starred);

    return `
        <div class="task-card ${cardClasses}">
            <input type="checkbox" ${task?.completed ? 'checked' : ''} data-date="${date}" data-index="${index}" aria-label="Отметить задачу выполненной">
            <div class="task-info">
                <div class="task-header">
                    <span class="task-title">${safeText}</span>
                    <div class="task-actions">
                        <button class="btn-icon" data-action="star" data-date="${date}" data-index="${index}" aria-pressed="${starred ? 'true' : 'false'}" aria-label="${starred ? 'Убрать задачу из избранного' : 'Добавить задачу в избранное'}">${starred ? '⭐' : '☆'}</button>
                        <button class="btn-icon" data-action="edit" data-date="${date}" data-index="${index}" aria-label="Редактировать задачу">✏️</button>
                        <button class="btn-icon" data-action="delete" data-date="${date}" data-index="${index}" aria-label="Удалить задачу">🗑️</button>
                    </div>
                </div>
                <div class="task-meta">
                    ${chips}
                </div>
            </div>
        </div>
    `;
}

function formatTaskDate(date) {
    if (!date) return '';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('ru-RU', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    });
}

function getPriorityLabel(priority) {
    return PRIORITY_LABELS[priority] || PRIORITY_LABELS.medium;
}

function getCategoryLabel(key) {
    const name = getCategoryName(key);
    const icon = CATEGORY_ICONS[key] || CATEGORY_ICONS.other;
    return `${icon} ${name}`.trim();
}

function getUpcomingTasks() {
    const today = new Date();
    const { priority: prFilter, category: catFilter, starred: starFilter, sortBy } = filterState;
    const query = searchQuery.toLowerCase();
    const todaySignature = today.toISOString().split('T')[0];
    const signature = [tasksRevision, prFilter, catFilter, starFilter, sortBy, query, todaySignature].join('|');

    if (upcomingTasksCache.signature === signature) {
        return upcomingTasksCache.data;
    }
    
    // Collect all tasks
    const allTasks = [];
    for (const date in tasks) {
        if (new Date(date) >= today) {
            tasks[date].forEach((task, index) => {
                if (task.completed) return;
                if (prFilter && task.priority !== prFilter) return;
                if (catFilter && task.category !== catFilter) return;
                if (starFilter === 'starred' && !task.starred) return;
                if (query && !task.text.toLowerCase().includes(query)) return;
                allTasks.push({ date, task, index });
            });
        }
    }
    
    // Sort tasks
    allTasks.sort((a, b) => {
        switch (sortBy) {
            case 'priority':
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                return priorityOrder[b.task.priority] - priorityOrder[a.task.priority];
            case 'category':
                return a.task.category.localeCompare(b.task.category);
            case 'text':
                return a.task.text.localeCompare(b.task.text);
            case 'date':
            default:
                return new Date(a.date) - new Date(b.date);
        }
    });
    
    const result = allTasks.slice(0, 10);
    upcomingTasksCache.signature = signature;
    upcomingTasksCache.data = result;
    return result;
}

function getStats() {
    let total = 0, completed = 0, pending = 0;
    Object.values(tasks).forEach(dayTasks => {
        dayTasks.forEach(task => {
            total++;
            if (task.completed) completed++;
            else pending++;
        });
    });
    return {total, completed, pending};
}

let globalEventsBound = false;
let tasksEventsBound = false;
let calendarEventsBound = false;
let profileEventsBound = false;

function setupTasksEvents() {
    if (tasksEventsBound) return;
    tasksEventsBound = true;

    // Add task button
    document.addEventListener('click', handleAddTask);
    // Save task
    document.addEventListener('click', handleSaveTask);
    // Task checkbox changes
    document.addEventListener('change', handleTaskCheckbox);
    // Filters
    document.addEventListener('input', handleSearchInput);
    document.addEventListener('change', handleFiltersChange);
    document.addEventListener('click', handleResetFilters);
    document.addEventListener('click', handleClearSearch);
    // Edit/Delete actions
    document.addEventListener('click', handleTaskActionButtons);
}

function handleTaskActionButtons(e) {
    const btn = e.target.closest('.btn-icon');
    if (!btn) return;

    const action = btn.dataset.action;
    if (!action) return;

    e.preventDefault();
    e.stopPropagation();
    btn.blur();
    handleButtonPointerReset();

    const date = btn.dataset.date;
    const index = Number(btn.dataset.index);
    if (!tasks[date]) return;

    if (action === 'delete') {
        tasks[date].splice(index, 1);
        bumpTasksRevision();
        saveTasks(date);
        requestRender();
    }

    if (action === 'edit') {
        const task = tasks[date][index];
        const modal = document.getElementById('taskModal');
        modal.style.display = 'flex';
        document.getElementById('newTask').value = task.text;
        document.getElementById('taskDate').value = date;
        document.getElementById('taskCategory').value = task.category;
        document.getElementById('taskPriority').value = task.priority;
        const title = document.getElementById('taskModalTitle');
        if (title) title.textContent = 'Редактирование задачи';
        // Override save for edit
        const saveBtn = document.getElementById('saveTask');
        saveBtn.textContent = 'Сохранить изменения';
        saveBtn.dataset.edit = 'true';
        saveBtn.dataset.date = date;
        saveBtn.dataset.index = index;
    }

    if (action === 'star') {
        tasks[date][index].starred = !tasks[date][index].starred;
        bumpTasksRevision();
        saveTasks(date);
        requestRender();
    }
}

function handleSearchInput(e) {
    if (e.target.id === 'searchInput') {
        searchQuery = e.target.value;
        requestRender();
    }
}

function handleClearSearch(e) {
    if (e.target && e.target.id === 'clearSearch') {
        e.preventDefault();
        e.stopPropagation();
        searchQuery = '';
        handleButtonPointerReset(e);
        requestRender();
    }
}

function handleFiltersChange(e) {
    if (e.target.id === 'filterPriority') {
        filterState.priority = e.target.value;
        requestRender();
    } else if (e.target.id === 'filterCategory') {
        filterState.category = e.target.value;
        requestRender();
    } else if (e.target.id === 'sortBy') {
        filterState.sortBy = e.target.value || 'date';
        requestRender();
    } else if (e.target.id === 'filterStarred') {
        filterState.starred = e.target.value;
        requestRender();
    }
}

function handleResetFilters(e) {
    if (e.target && e.target.id === 'resetFilters') {
        filterState = { priority: '', category: '', starred: '', sortBy: 'date' };
        searchQuery = '';
        requestRender();
        showNotification('⚙️ Фильтры сброшены', 'info');
    }
}

function handleAddTask(e) {
    if (e.target.id === 'addTaskBtn' || e.target.closest('#addTaskBtn')) {
        const dateInput = document.getElementById('taskDate');
        if (dateInput && !dateInput.value) {
            const now = new Date();
            const y = now.getFullYear();
            const m = pad(now.getMonth() + 1);
            const d = pad(now.getDate());
            dateInput.value = `${y}-${m}-${d}`;
        }
        const saveBtn = document.getElementById('saveTask');
        if (saveBtn) {
            saveBtn.textContent = 'Сохранить задачу';
            saveBtn.dataset.edit = '';
            saveBtn.dataset.date = '';
            saveBtn.dataset.index = '';
        }
        const title = document.getElementById('taskModalTitle');
        if (title) title.textContent = 'Новая задача';
        document.getElementById('taskModal').style.display = 'flex';
    }
}

function handleSaveTask(e) {
    if (e.target.id === 'saveTask') {
        const taskInput = document.getElementById('newTask');
        let date = document.getElementById('taskDate').value;
        const category = document.getElementById('taskCategory').value;
        const priority = document.getElementById('taskPriority').value;
        let taskText = taskInput.value.trim();
        let dataChanged = false;

        // Parse date from text (always try, even if date field is filled)
        const parsedDate = parseDateFromText(taskText);
        if (parsedDate) {
            date = parsedDate;
            // Remove date from task text
            taskText = taskText.replace(/\s*\d{1,2}\.\d{1,2}\.\d{4}\s*/, '').trim();
            // Show notification that date was parsed
            showNotification(`📅 Дата распознана: ${new Date(parsedDate).toLocaleDateString('ru-RU')}`, 'info');
        }

        if (!taskText || !date) return;

        if (e.target.dataset.edit === 'true') {
            const oldDate = e.target.dataset.date;
            const index = Number(e.target.dataset.index);
            const task = tasks[oldDate][index];
            // If date changed, move task
            if (oldDate !== date) {
                tasks[oldDate].splice(index, 1);
                if (!tasks[date]) tasks[date] = [];
                tasks[date].push({ text: taskText, completed: task.completed, category, priority, starred: task.starred, created: task.created });
                saveTasks(oldDate);
                saveTasks(date);
                dataChanged = true;
            } else {
                task.text = taskText;
                task.category = category;
                task.priority = priority;
                saveTasks(date);
                dataChanged = true;
            }
        } else {
            if (!tasks[date]) tasks[date] = [];
            tasks[date].push({ text: taskText, completed: false, category, priority, starred: false, created: new Date().toISOString() });
            saveTasks(date);
            dataChanged = true;
        }

        if (dataChanged) {
            bumpTasksRevision();
        }

        // Reset and close
        e.target.textContent = 'Сохранить задачу';
        e.target.dataset.edit = '';
        document.getElementById('newTask').value = '';
        closeModal(document.getElementById('taskModal'));
        requestRender(true);
    }
}

function handleTaskCheckbox(e) {
    if (e.target.type === 'checkbox' && e.target.closest('.task-card')) {
        const checkbox = e.target;
        const date = checkbox.dataset.date;
        const index = checkbox.dataset.index;
        tasks[date][index].completed = checkbox.checked;
        bumpTasksRevision();
        saveTasks(date);
        requestRender();
    }
}

function handleSearch(e) {
    searchQuery = e.target.value.toLowerCase();
    requestRender();
}

function handleFilterChange(e) {
    requestRender();
}

function setupCalendarEvents() {
    if (calendarEventsBound) return;
    calendarEventsBound = true;
    
    // Calendar day clicks
    document.addEventListener('click', handleCalendarDayClick);
    document.addEventListener('touchend', handleCalendarDayClick, { passive: false });
    
    // Calendar navigation
    document.addEventListener('click', handleCalendarNavigation);
}

function handleCalendarDayClick(e) {
    // Prevent double firing on touch devices
    if (e.type === 'touchend') {
        e.preventDefault();
    }
    
    if (e.target.classList.contains('day')) {
        const date = e.target.dataset.date;
        showCalendarTasks(date);
    }
}

function handleCalendarNavigation(e) {
    if (e.target.id === 'prevMonth') {
        calendarDate.setMonth(calendarDate.getMonth() - 1);
        requestRender(true);
    } else if (e.target.id === 'nextMonth') {
        calendarDate.setMonth(calendarDate.getMonth() + 1);
        requestRender(true);
    }
}

function showCalendarTasks(date) {
    const modal = document.getElementById('calendarModal');
    const modalDate = document.getElementById('calendarModalDate');
    const taskList = document.getElementById('calendarTaskList');

    modalDate.textContent = new Date(date).toLocaleDateString('ru-RU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    taskList.innerHTML = '';

    if (tasks[date] && tasks[date].length > 0) {
        tasks[date].forEach((task, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <input type="checkbox" ${task.completed ? 'checked' : ''} data-index="${index}">
                <span>${escapeHtml(task.text)}</span>
                <small>${escapeHtml(getCategoryLabel(task.category || 'other'))} • ${escapeHtml(getPriorityLabel(task.priority || 'medium'))}</small>
            `;
            li.querySelector('input').addEventListener('change', () => {
                task.completed = li.querySelector('input').checked;
                bumpTasksRevision();
                saveTasks(date);
                showCalendarTasks(date);
                requestRender();
            });
            taskList.appendChild(li);
        });
    } else {
        taskList.innerHTML = '<li style="text-align: center; color: var(--text-muted); padding: 12px 0;">Нет задач на эту дату</li>';
    }

    modal.style.display = 'flex';
}

function setupProfileEvents() {
    if (profileEventsBound) return;
    profileEventsBound = true;

    // Theme toggle
    document.addEventListener('change', handleThemeToggle);
    
    // Export button
    document.addEventListener('click', handleExport);
    
    // Import button
    document.addEventListener('click', handleImportClick);
    
    // Import file change
    document.addEventListener('change', handleImportFile);

    // Export modal copy
    document.addEventListener('click', handleExportModalCopy);
}

function handleThemeToggle(e) {
    if (e.target.id === 'themeToggle') {
        currentTheme = e.target.value;
        localStorage.setItem('theme', currentTheme);
        applyTheme();
    }
}

async function handleExport(e) {
    if (e.target.id === 'exportBtn') {
        try {
            const dataStr = JSON.stringify(tasks, null, 2);
            if ((isMobileDevice || isTelegramWebApp) && navigator.share) {
                try {
                    await navigator.share({
                        title: 'Резервная копия задач',
                        text: dataStr
                    });
                    showNotification('✅ Поделились резервной копией!', 'success');
                    return;
                } catch (shareError) {
                    // если пользователь отменил шаринг, просто переходим к следующим вариантам
                }
            }

            if (isTelegramWebApp || isMobileDevice) {
                if (navigator.clipboard && window.isSecureContext) {
                    try {
                        await navigator.clipboard.writeText(dataStr);
                        showNotification('✅ Данные скопированы в буфер обмена!', 'success');
                        return;
                    } catch (clipboardError) {
                        console.warn('Clipboard export failed:', clipboardError);
                    }
                }
                showExportModal(dataStr);
                showNotification('⚠️ Скопируйте данные вручную из окна экспорта.', 'warning');
                return;
            }

            try {
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);

                const link = document.createElement('a');
                link.href = url;
                link.download = `tasks_backup_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                URL.revokeObjectURL(url);
                showNotification('✅ Задачи экспортированы в файл!', 'success');
            } catch (downloadError) {
                console.warn('File export failed:', downloadError);
                if (navigator.clipboard && window.isSecureContext) {
                    try {
                        await navigator.clipboard.writeText(dataStr);
                        showNotification('✅ Данные скопированы в буфер обмена!', 'success');
                        return;
                    } catch (clipboardError) {
                        console.warn('Clipboard export failed:', clipboardError);
                    }
                }
                showExportModal(dataStr);
            }
        } catch (error) {
            console.error('Export error:', error);
            showNotification('❌ Ошибка при экспорте задач', 'error');
        }
    }
}

async function handleExportModalCopy(e) {
    if (e.target && e.target.matches('[data-copy-export]')) {
        const textArea = e.target.closest('.modal-content')?.querySelector('[data-export-text]');
        if (!textArea) return;
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(textArea.value);
                showNotification('✅ Скопировано!', 'success');
            } else {
                throw new Error('Clipboard API недоступен');
            }
        } catch (err) {
            console.error('Copy failed:', err);
            showNotification('❌ Не удалось скопировать автоматически. Выделите текст вручную.', 'error');
        }
    }
}

function handleImportClick(e) {
    if (e.target.id === 'importBtn') {
        document.getElementById('importFile').click();
    }
}

function handleImportFile(e) {
    if (e.target.id === 'importFile') {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importedTasks = JSON.parse(e.target.result);
                    tasks = mergeTaskCollections(importedTasks, tasks);
                    cleanEmptyDates();
                    persistTasksToStorage();
                    bumpTasksRevision();
                    // Save to backend if user is logged in
                    if (userId) {
                        for (const date of Object.keys(tasks)) {
                            await saveTasks(date);
                        }
                    }
                    requestRender(true);
                    showNotification('✅ Задачи успешно импортированы!', 'success');
                } catch (error) {
                    console.error('Import error:', error);
                    showNotification('❌ Ошибка при импорте задач. Проверьте формат файла.', 'error');
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        }
    }
}

function showExportModal(dataStr) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content">
            <button type="button" class="close" aria-label="Закрыть" data-modal-close>&times;</button>
            <h3>Экспорт данных</h3>
            <p>Скопируйте данные ниже и сохраните их в файл:</p>
            <textarea readonly data-export-text style="width: 100%; height: 200px; margin: 10px 0; padding: 10px; border: 1px solid var(--border-light); border-radius: var(--radius-md); background: var(--bg-primary); color: var(--text-primary); font-family: monospace; font-size: 12px;">${dataStr}</textarea>
            <button type="button" class="btn-secondary" data-copy-export>Скопировать в буфер</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getCategoryName(key) {
    const categories = {
        study: 'Учеба',
        work: 'Работа',
        personal: 'Личное',
        other: 'Другое'
    };
    return categories[key] || key;
}

// Helpers
function pad(n) { return n.toString().padStart(2, '0'); }
function formatDateKey(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

// Parse date from task text
function parseDateFromText(text) {
    // Support multiple date formats: DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
    const dateRegex = /(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/;
    const match = text.match(dateRegex);
    if (match) {
        let [, day, month, year] = match;
        day = day.padStart(2, '0');
        month = month.padStart(2, '0');
        
        // Validate date
        const dateObj = new Date(`${year}-${month}-${day}`);
        if (dateObj.getFullYear() == year && dateObj.getMonth() + 1 == parseInt(month) && dateObj.getDate() == parseInt(day)) {
            return `${year}-${month}-${day}`;
        }
    }
    return null;
}

// Initialize
applyTheme();
const storedTasks = readTasksFromStorage();
if (Object.keys(storedTasks).length > 0) {
    tasks = storedTasks;
    cleanEmptyDates();
    bumpTasksRevision();
}

if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
    userId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    console.log('Telegram WebApp detected, userId:', userId);

    renderApp();

    if (userId) {
        loadTasks().then(() => {
            console.log('Tasks loaded from server');
            requestRender(true);
        });
    } else {
        console.log('No userId, using local tasks only');
    }
} else {
    console.log('Standalone mode detected, using local tasks');
    renderApp();
}
