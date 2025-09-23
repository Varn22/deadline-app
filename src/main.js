import './style.css'

// App state
let currentView = 'tasks'; // 'tasks', 'calendar', 'profile'
let tasks = {};
let currentTheme = localStorage.getItem('theme') || 'dark';
let userId = null;

const API_BASE = 'https://deadline-backend.onrender.com/api';

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
                📋 Tasks
            </button>
            <button class="nav-item ${currentView === 'calendar' ? 'active' : ''}" data-view="calendar">
                📅 Calendar
            </button>
            <button class="nav-item ${currentView === 'profile' ? 'active' : ''}" data-view="profile">
                👤 Profile
            </button>
        </nav>
    `;

    app.innerHTML = html;

    // Event listeners
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentView = e.target.dataset.view;
            renderApp();
        });
    });

    // Setup events based on view
    if (currentView === 'tasks') {
        setupTasksEvents();
    } else if (currentView === 'calendar') {
        setupCalendarEvents();
    }
}

function renderTasksView() {
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = tasks[today] || [];
    const upcomingTasks = getUpcomingTasks();

    return `
        <header class="app-header">
            <h1>Tasks</h1>
            <button class="add-task-btn" id="addTaskBtn">+</button>
        </header>
        
        <div class="content">
            <section class="today-deadline">
                <h2>Today's Deadline</h2>
                ${todayTasks.length > 0 ? todayTasks.map((task, index) => `
                    <div class="task-card">
                        <input type="checkbox" ${task.completed ? 'checked' : ''} data-date="${today}" data-index="${index}">
                        <div class="task-info">
                            <span class="task-title">${task.text}</span>
                        </div>
                    </div>
                `).join('') : '<p>No tasks for today</p>'}
            </section>
            
            <section class="upcoming">
                <h2>Upcoming</h2>
                ${upcomingTasks.map(({date, task, index}) => `
                    <div class="task-card">
                        <input type="checkbox" ${task.completed ? 'checked' : ''} data-date="${date}" data-index="${index}">
                        <div class="task-info">
                            <span class="task-title">${task.text}</span>
                            <span class="task-date">${new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                        </div>
                    </div>
                `).join('')}
            </section>
        </div>
        
        <div id="taskModal" class="modal" style="display: none;">
            <div class="modal-content">
                <span class="close">&times;</span>
                <h3>Add New Task</h3>
                <input type="text" id="newTask" placeholder="Task name">
                <input type="date" id="taskDate">
                <select id="taskCategory">
                    <option value="study">Study</option>
                    <option value="work">Work</option>
                    <option value="personal">Personal</option>
                    <option value="other">Other</option>
                </select>
                <select id="taskPriority">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                </select>
                <button id="saveTask">Save Task</button>
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
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
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
            <h1>Calendar</h1>
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
            <h1>Profile</h1>
        </header>
        <div class="content">
            <div class="stats">
                <div>Total Tasks: ${stats.total}</div>
                <div>Completed: ${stats.completed}</div>
                <div>Pending: ${stats.pending}</div>
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
    document.getElementById('addTaskBtn').addEventListener('click', () => {
        document.getElementById('taskModal').style.display = 'block';
    });

    document.querySelector('.close').addEventListener('click', () => {
        document.getElementById('taskModal').style.display = 'none';
    });

    document.getElementById('saveTask').addEventListener('click', async () => {
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
            await saveTasks(date);
            taskInput.value = '';
            document.getElementById('taskModal').style.display = 'none';
            renderApp();
        }
    });

    document.querySelectorAll('.task-card input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', async () => {
            const date = checkbox.dataset.date;
            const index = checkbox.dataset.index;
            tasks[date][index].completed = checkbox.checked;
            await saveTasks(date);
            renderApp();
        });
    });
}

function setupCalendarEvents() {
    // Use event delegation for dynamic elements
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('day') && currentView === 'calendar') {
            const date = e.target.dataset.date;
            showCalendarTasks(date);
        }
        if (e.target.classList.contains('close') && document.getElementById('calendarModal').style.display === 'block') {
            document.getElementById('calendarModal').style.display = 'none';
        }
    });
}

function showCalendarTasks(date) {
    const modal = document.getElementById('calendarModal');
    const modalDate = document.getElementById('calendarModalDate');
    const taskList = document.getElementById('calendarTaskList');

    modalDate.textContent = new Date(date).toLocaleDateString('en-US');
    taskList.innerHTML = '';

    if (tasks[date]) {
        tasks[date].forEach((task, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <input type="checkbox" ${task.completed ? 'checked' : ''}>
                <span>${task.text}</span>
            `;
            li.querySelector('input').addEventListener('change', async () => {
                task.completed = li.querySelector('input').checked;
                await saveTasks(date);
                showCalendarTasks(date);
                renderApp();
            });
            taskList.appendChild(li);
        });
    }

    modal.style.display = 'block';
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
