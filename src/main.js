import './style.css'

// App state
let currentView = 'tasks'; // 'tasks', 'calendar', 'profile'
let tasks = {};
let currentTheme = localStorage.getItem('theme') || 'dark';
let userId = null;
// Prevent duplicate listeners
let bound = { global: false, tasks: false, calendar: false, profile: false };
// UI state
let searchQuery = '';
let notifications = [];

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

const API_BASE = 'https://deadline-backend-d18n.onrender.com/api';

async function loadTasks() {
  if (!userId) return;
  try {
    const response = await fetch(`${API_BASE}/tasks/${userId}`);
    if (response.ok) {
      tasks = await response.json();
    }
  } catch (error) {
    console.error('Error loading tasks:', error);
    tasks = JSON.parse(localStorage.getItem('tasks') || '{}');
  }
}

async function saveTasks(date) {
  if (!userId) {
    localStorage.setItem('tasks', JSON.stringify(tasks));
    return;
  }
  try {
    await fetch(`${API_BASE}/tasks/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, tasks: tasks[date] || [] }),
    });
  } catch (error) {
    console.error('Error saving tasks:', error);
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }
}

function applyTheme() {
    document.body.className = currentTheme;
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
    if (!bound.global) { setupGlobalEvents(); bound.global = true; }
    if (currentView === 'tasks' && !bound.tasks) { setupTasksEvents(); bound.tasks = true; }
    if (currentView === 'calendar' && !bound.calendar) { setupCalendarEvents(); bound.calendar = true; }
    if (currentView === 'profile' && !bound.profile) { setupProfileEvents(); bound.profile = true; }
}

function setupGlobalEvents() {
    // Navigation
    document.addEventListener('click', handleNavClick);
    
    // Modal close
    document.addEventListener('click', handleModalClose);
}

function handleNavClick(e) {
    if (e.target.closest('.nav-item')) {
        e.preventDefault();
        const navItem = e.target.closest('.nav-item');
        const view = navItem.dataset.view;
        if (view && view !== currentView) {
            currentView = view;
            renderApp();
        }
    }
}

function handleModalClose(e) {
    if (e.target.classList.contains('close') || e.target.classList.contains('modal')) {
        e.target.closest('.modal').style.display = 'none';
    }
}

function renderTasksView() {
    const today = new Date().toISOString().split('T')[0];
    const prFilter = document.getElementById('filterPriority')?.value || '';
    const catFilter = document.getElementById('filterCategory')?.value || '';
    const starFilter = document.getElementById('filterStarred')?.value || '';
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

    return `
        <header class="app-header">
            <h1>Задачи</h1>
            <button class="add-task-btn" id="addTaskBtn">+</button>
        </header>
        
        <div class="content">
            <div class="filters">
                <div>
                    <label>🔍 Поиск</label>
                    <input id="searchInput" type="text" placeholder="Введите текст задачи..." value="${searchQuery}" />
                </div>
                <div>
                    <label>⚡ Приоритет</label>
                    <select id="filterPriority">
                        <option value="">Все приоритеты</option>
                        <option value="high">🔴 Высокий</option>
                        <option value="medium">🟡 Средний</option>
                        <option value="low">🟢 Низкий</option>
                    </select>
                </div>
                <div>
                    <label>📂 Категория</label>
                    <select id="filterCategory">
                        <option value="">Все категории</option>
                        <option value="study">📚 Учеба</option>
                        <option value="work">💼 Работа</option>
                        <option value="personal">🏠 Личное</option>
                        <option value="other">📌 Другое</option>
                    </select>
                </div>
                <div>
                    <label>📊 Сортировка</label>
                    <select id="sortBy">
                        <option value="date">По дате</option>
                        <option value="priority">По приоритету</option>
                        <option value="category">По категории</option>
                        <option value="text">По алфавиту</option>
                    </select>
                </div>
                <div>
                    <label>⭐ Избранные</label>
                    <select id="filterStarred">
                        <option value="">Все задачи</option>
                        <option value="starred">Только избранные</option>
                    </select>
                </div>
            </div>
            ${renderProgress()}
            <section class="today-deadline">
                <h2>Дедлайн сегодня</h2>
                ${todayTasks.length > 0 ? todayTasks.map((task, index) => `
                    <div class="task-card ${task.completed ? 'completed' : ''} ${task.priority ? task.priority + '-priority' : ''}">
                        <input type="checkbox" ${task.completed ? 'checked' : ''} data-date="${today}" data-index="${index}">
                        <div class="task-info">
                            <span class="task-title">${task.text}</span>
                            <span class="task-category">${getCategoryName(task.category || 'other')}</span>
                            <div class="task-actions">
                                <button class="btn-icon" data-action="star" data-date="${today}" data-index="${index}">${task.starred ? '⭐' : '☆'}</button>
                                <button class="btn-icon" data-action="edit" data-date="${today}" data-index="${index}">✏️</button>
                                <button class="btn-icon" data-action="delete" data-date="${today}" data-index="${index}">🗑️</button>
                            </div>
                        </div>
                    </div>
                `).join('') : '<p style="text-align: center; color: var(--muted-text); padding: 20px;">Нет задач на сегодня</p>'}
            </section>
            
            <section class="upcoming">
                <h2>Предстоящие</h2>
                ${upcomingTasks.map(({date, task, index}) => `
                    <div class="task-card ${task.completed ? 'completed' : ''} ${task.priority ? task.priority + '-priority' : ''}">
                        <input type="checkbox" ${task.completed ? 'checked' : ''} data-date="${date}" data-index="${index}">
                        <div class="task-info">
                            <span class="task-title">${task.text}</span>
                            <span class="task-date">${new Date(date).toLocaleDateString('ru-RU', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                            <span class="task-category">${getCategoryName(task.category || 'other')}</span>
                            <div class="task-actions">
                                <button class="btn-icon" data-action="star" data-date="${date}" data-index="${index}">${task.starred ? '⭐' : '☆'}</button>
                                <button class="btn-icon" data-action="edit" data-date="${date}" data-index="${index}">✏️</button>
                                <button class="btn-icon" data-action="delete" data-date="${date}" data-index="${index}">🗑️</button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </section>
        </div>
        
        <div id="taskModal" class="modal" style="display: none;">
            <div class="modal-content">
                <span class="close">&times;</span>
                <h3>Новая задача</h3>
                <input type="text" id="newTask" placeholder="Название задачи">
                <input type="date" id="taskDate" required>
                <select id="taskCategory">
                    <option value="study">Учеба</option>
                    <option value="work">Работа</option>
                    <option value="personal">Личное</option>
                    <option value="other">Другое</option>
                </select>
                <select id="taskPriority">
                    <option value="low">Низкий</option>
                    <option value="medium">Средний</option>
                    <option value="high">Высокий</option>
                </select>
                <button id="saveTask">Сохранить задачу</button>
            </div>
        </div>
    `;
}

function renderCalendarView() {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    let calendarHtml = `
        <div class="calendar">
            <div class="calendar-header">
                <h2>${currentDate.toLocaleString('en-US', { month: 'long' })} ${year}</h2>
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
                <span class="close">&times;</span>
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
                        <option value="pixel" ${currentTheme === 'pixel' ? 'selected' : ''}>3D Пиксели</option>
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

function getUpcomingTasks() {
    const today = new Date();
    const upcoming = [];
    const prFilter = document.getElementById('filterPriority')?.value || '';
    const catFilter = document.getElementById('filterCategory')?.value || '';
    const starFilter = document.getElementById('filterStarred')?.value || '';
    const sortBy = document.getElementById('sortBy')?.value || 'date';
    const query = searchQuery.toLowerCase();
    
    // Collect all tasks
    const allTasks = [];
    for (const date in tasks) {
        if (new Date(date) >= today) {
            tasks[date].forEach((task, index) => {
                if (task.completed) return;
                if (prFilter && task.priority !== prFilter) return;
                if (catFilter && task.category !== catFilter) return;
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
    
    return allTasks.slice(0, 10); // Show more tasks
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

function setupTasksEvents() {
    // Add task button
    document.addEventListener('click', handleAddTask);
    // Save task
    document.addEventListener('click', handleSaveTask);
    // Task checkbox changes
    document.addEventListener('change', handleTaskCheckbox);
    // Filters
    document.addEventListener('input', handleSearchInput);
    document.addEventListener('change', handleFiltersChange);
    // Edit/Delete actions
    document.addEventListener('click', handleTaskActionButtons);
}

function handleTaskActionButtons(e) {
    const btn = e.target.closest('.btn-icon');
    if (!btn) return;
    const action = btn.dataset.action;
    const date = btn.dataset.date;
    const index = Number(btn.dataset.index);
    if (!tasks[date]) return;

    if (action === 'delete') {
        tasks[date].splice(index, 1);
        saveTasks(date);
        renderApp();
    }

    if (action === 'edit') {
        const task = tasks[date][index];
        document.getElementById('taskModal').style.display = 'block';
        document.getElementById('newTask').value = task.text;
        document.getElementById('taskDate').value = date;
        document.getElementById('taskCategory').value = task.category;
        document.getElementById('taskPriority').value = task.priority;
        // Override save for edit
        const saveBtn = document.getElementById('saveTask');
        saveBtn.textContent = 'Сохранить';
        saveBtn.dataset.edit = 'true';
        saveBtn.dataset.date = date;
        saveBtn.dataset.index = index;
    }

    if (action === 'star') {
        tasks[date][index].starred = !tasks[date][index].starred;
        saveTasks(date);
        renderApp();
    }
}

function handleSearchInput(e) {
    if (e.target.id === 'searchInput') {
        searchQuery = e.target.value;
        renderApp();
    }
}

function handleFiltersChange(e) {
    if (e.target.id === 'filterPriority' || e.target.id === 'filterCategory' || e.target.id === 'sortBy' || e.target.id === 'filterStarred') {
        renderApp();
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
        document.getElementById('taskModal').style.display = 'block';
    }
}

function handleSaveTask(e) {
    if (e.target.id === 'saveTask') {
        const taskInput = document.getElementById('newTask');
        const date = document.getElementById('taskDate').value;
        const category = document.getElementById('taskCategory').value;
        const priority = document.getElementById('taskPriority').value;

        if (!taskInput.value.trim() || !date) return;

        if (e.target.dataset.edit === 'true') {
            const oldDate = e.target.dataset.date;
            const index = Number(e.target.dataset.index);
            const task = tasks[oldDate][index];
            // If date changed, move task
            if (oldDate !== date) {
                tasks[oldDate].splice(index, 1);
                if (!tasks[date]) tasks[date] = [];
                tasks[date].push({ text: taskInput.value.trim(), completed: task.completed, category, priority, starred: task.starred, created: task.created });
                saveTasks(oldDate);
                saveTasks(date);
            } else {
                task.text = taskInput.value.trim();
                task.category = category;
                task.priority = priority;
                saveTasks(date);
            }
        } else {
            if (!tasks[date]) tasks[date] = [];
            tasks[date].push({ text: taskInput.value.trim(), completed: false, category, priority, starred: false, created: new Date().toISOString() });
            saveTasks(date);
        }

        // Reset and close
        e.target.textContent = 'Сохранить задачу';
        e.target.dataset.edit = '';
        document.getElementById('newTask').value = '';
        document.getElementById('taskModal').style.display = 'none';
        renderApp();
    }
}

function handleTaskCheckbox(e) {
    if (e.target.type === 'checkbox' && e.target.closest('.task-card')) {
        const checkbox = e.target;
        const date = checkbox.dataset.date;
        const index = checkbox.dataset.index;
        tasks[date][index].completed = checkbox.checked;
        saveTasks(date);
        renderApp();
    }
}

function handleSearch(e) {
    searchQuery = e.target.value.toLowerCase();
    renderApp();
}

function handleFilterChange(e) {
    renderApp();
}

function setupCalendarEvents() {
    // Calendar day clicks
    document.addEventListener('click', handleCalendarDayClick);
}

function handleCalendarDayClick(e) {
    if (e.target.classList.contains('day') && currentView === 'calendar') {
        const date = e.target.dataset.date;
        showCalendarTasks(date);
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
                <span>${task.text}</span>
                <small>${getCategoryName(task.category)} • ${task.priority === 'high' ? 'Высокий' : task.priority === 'medium' ? 'Средний' : 'Низкий'}</small>
            `;
            li.querySelector('input').addEventListener('change', () => {
                task.completed = li.querySelector('input').checked;
                saveTasks(date);
                showCalendarTasks(date);
                renderApp();
            });
            taskList.appendChild(li);
        });
    } else {
        taskList.innerHTML = '<li style="text-align: center; color: var(--text-muted);">Нет задач на эту дату</li>';
    }

    modal.style.display = 'block';
}

function setupProfileEvents() {
    // Theme toggle
    document.addEventListener('change', handleThemeToggle);
    
    // Export button
    document.addEventListener('click', handleExport);
    
    // Import button
    document.addEventListener('click', handleImportClick);
    
    // Import file change
    document.addEventListener('change', handleImportFile);
}

function handleThemeToggle(e) {
    if (e.target.id === 'themeToggle') {
        currentTheme = e.target.value;
        localStorage.setItem('theme', currentTheme);
        applyTheme();
    }
}

function handleExport(e) {
    if (e.target.id === 'exportBtn') {
        try {
            const dataStr = JSON.stringify(tasks, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `tasks_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
            
            // Show success message
            showNotification('✅ Задачи успешно экспортированы!', 'success');
        } catch (error) {
            console.error('Export error:', error);
            showNotification('❌ Ошибка при экспорте задач', 'error');
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
                    tasks = importedTasks;
                    localStorage.setItem('tasks', JSON.stringify(tasks));
                    // Save to backend if user is logged in
                    if (userId) {
                        for (const date in tasks) {
                            await saveTasks(date);
                        }
                    }
                    renderApp();
                    alert('Tasks imported successfully!');
                } catch (error) {
                    alert('Error importing tasks. Please check the file format.');
                }
            };
            reader.readAsText(file);
        }
    }
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

// Initialize
applyTheme();
if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
    userId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    if (userId) {
        loadTasks().then(() => renderApp());
    } else {
        tasks = JSON.parse(localStorage.getItem('tasks') || '{}');
        renderApp();
    }
} else {
    tasks = JSON.parse(localStorage.getItem('tasks') || '{}');
    renderApp();
}
