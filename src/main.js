import './style.css'

// App state
let currentView = 'tasks'; // 'tasks', 'calendar', 'profile'
let tasks = {};
let currentTheme = localStorage.getItem('theme') || 'dark';
let userId = null;

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
    setupGlobalEvents();
    if (currentView === 'tasks') {
        setupTasksEvents();
    } else if (currentView === 'calendar') {
        setupCalendarEvents();
    } else if (currentView === 'profile') {
        setupProfileEvents();
    }
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
    const todayTasks = tasks[today] || [];
    const upcomingTasks = getUpcomingTasks();

    return `
        <header class="app-header">
            <h1>Задачи</h1>
            <button class="add-task-btn" id="addTaskBtn">+</button>
        </header>
        
        <div class="content">
            <section class="today-deadline">
                <h2>Дедлайн сегодня</h2>
                ${todayTasks.length > 0 ? todayTasks.map((task, index) => `
                    <div class="task-card ${task.completed ? 'completed' : ''} ${task.priority ? task.priority + '-priority' : ''}">
                        <input type="checkbox" ${task.completed ? 'checked' : ''} data-date="${today}" data-index="${index}">
                        <div class="task-info">
                            <span class="task-title">${task.text}</span>
                            <span class="task-category">${getCategoryName(task.category || 'other')}</span>
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
                <input type="date" id="taskDate" placeholder="Выберите дату">
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
        const dateKey = `${year}-${month + 1}-${day}`;
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

function getUpcomingTasks() {
    const today = new Date();
    const upcoming = [];
    const dates = Object.keys(tasks).sort();
    
    for (const date of dates) {
        if (new Date(date) > today) {
            tasks[date].forEach((task, index) => {
                if (!task.completed) {
                    upcoming.push({date, task, index});
                }
            });
        }
        if (upcoming.length >= 5) break;
    }
    return upcoming;
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
}

function handleAddTask(e) {
    if (e.target.id === 'addTaskBtn' || e.target.closest('#addTaskBtn')) {
        document.getElementById('taskModal').style.display = 'block';
    }
}

function handleSaveTask(e) {
    if (e.target.id === 'saveTask') {
        const taskInput = document.getElementById('newTask');
        const date = document.getElementById('taskDate').value;
        const category = document.getElementById('taskCategory').value;
        const priority = document.getElementById('taskPriority').value;
        
        if (taskInput.value.trim() && date) {
            if (!tasks[date]) tasks[date] = [];
            tasks[date].push({ 
                text: taskInput.value.trim(), 
                completed: false, 
                category, 
                priority,
                created: new Date().toISOString()
            });
            saveTasks(date);
            taskInput.value = '';
            document.getElementById('taskModal').style.display = 'none';
            renderApp();
        }
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

function setupCalendarEvents() {
    // Calendar day clicks
    document.addEventListener('click', handleCalendarDayClick);
    
    // Calendar modal task checkboxes
    document.addEventListener('change', handleCalendarTaskCheckbox);
}

function handleCalendarDayClick(e) {
    if (e.target.classList.contains('day') && currentView === 'calendar') {
        const date = e.target.dataset.date;
        showCalendarTasks(date);
    }
}

function handleCalendarTaskCheckbox(e) {
    if (e.target.type === 'checkbox' && e.target.closest('#calendarTaskList')) {
        const checkbox = e.target;
        const li = checkbox.closest('li');
        const taskText = li.querySelector('span').textContent;
        const date = document.getElementById('calendarModalDate').textContent;
        
        // Find the task in the tasks object
        const dateKey = Object.keys(tasks).find(key => {
            const taskDate = new Date(key);
            return taskDate.toLocaleDateString('ru-RU') === date;
        });
        
        if (dateKey && tasks[dateKey]) {
            const taskIndex = tasks[dateKey].findIndex(task => task.text === taskText);
            if (taskIndex !== -1) {
                tasks[dateKey][taskIndex].completed = checkbox.checked;
                saveTasks(dateKey);
                showCalendarTasks(dateKey);
                renderApp();
            }
        }
    }
}

function showCalendarTasks(date) {
    const modal = document.getElementById('calendarModal');
    const modalDate = document.getElementById('calendarModalDate');
    const taskList = document.getElementById('calendarTaskList');

    modalDate.textContent = new Date(date).toLocaleDateString('ru-RU');
    taskList.innerHTML = '';

    if (tasks[date]) {
        tasks[date].forEach((task, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <input type="checkbox" ${task.completed ? 'checked' : ''}>
                <span>${task.text}</span>
            `;
            li.querySelector('input').addEventListener('change', () => {
                task.completed = li.querySelector('input').checked;
                saveTasks(date);
                showCalendarTasks(date);
                renderApp();
            });
            taskList.appendChild(li);
        });
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
        const dataStr = JSON.stringify(tasks, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = 'tasks.json';
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
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
