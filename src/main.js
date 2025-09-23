import './style.css'

// Calendar functionality
let currentDate = new Date();
let tasks = {};
let currentTheme = localStorage.getItem('theme') || 'dark';
let userId = null;

const API_BASE = 'https://your-backend-url.com/api'; // Замените на ваш URL

async function loadTasks() {
  if (!userId) return;
  try {
    const response = await fetch(`${API_BASE}/tasks/${userId}`);
    if (response.ok) {
      tasks = await response.json();
    }
  } catch (error) {
    console.error('Error loading tasks:', error);
    // Fallback to localStorage
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
    // Fallback to localStorage
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }
}

function applyTheme() {
    document.body.className = currentTheme;
}

function renderCalendar() {
    const app = document.querySelector('#app');
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    let html = `
        <header>
            <h1>Менеджер дедлайнов студента</h1>
            <div class="header-controls">
                <button id="themeToggle">${currentTheme === 'dark' ? '☀️ Светлая' : '🌙 Темная'}</button>
                <button id="exportData">📤 Экспорт</button>
                <input type="file" id="importData" accept=".json" style="display: none;">
                <label for="importData" class="button">📥 Импорт</label>
                <input type="text" id="search" placeholder="Поиск задач...">
            </div>
        </header>
        <div class="stats">
            <div>Всего задач: <span id="totalTasks">0</span></div>
            <div>Выполнено: <span id="completedTasks">0</span></div>
            <div>Просрочено: <span id="overdueTasks">0</span></div>
        </div>
        <div class="calendar-header">
            <button id="prevMonth">&lt;</button>
            <h2>${currentDate.toLocaleString('ru-RU', { month: 'long' })} ${year}</h2>
            <button id="nextMonth">&gt;</button>
        </div>
        <div class="calendar">
            <div class="weekdays">
                <div>Вс</div><div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div>
            </div>
            <div class="days">
    `;

    // Empty cells for days before first day
    for (let i = 0; i < firstDay; i++) {
        html += '<div></div>';
    }

    // Days of the month
    for (let day = 1; day <= lastDate; day++) {
        const dateKey = `${year}-${month + 1}-${day}`;
        const dayTasks = tasks[dateKey] || [];
        const hasTasks = dayTasks.length > 0;
        const isToday = new Date().toDateString() === new Date(dateKey).toDateString();
        const hasOverdue = dayTasks.some(task => !task.completed && new Date(dateKey) < new Date());
        html += `<div class="day ${hasTasks ? 'has-tasks' : ''} ${isToday ? 'today' : ''} ${hasOverdue ? 'overdue' : ''}" data-date="${dateKey}">${day}</div>`;
    }

    html += `
            </div>
        </div>
        <div class="filters">
            <label>Фильтр по категории:</label>
            <select id="categoryFilter">
                <option value="all">Все</option>
                <option value="учеба">Учеба</option>
                <option value="работа">Работа</option>
                <option value="личное">Личное</option>
                <option value="другое">Другое</option>
            </select>
            <label>Показать только невыполненные:</label>
            <input type="checkbox" id="showPendingOnly">
        </div>
        <div id="taskModal" class="modal" style="display: none;">
            <div class="modal-content">
                <span class="close">&times;</span>
                <h3 id="modalDate"></h3>
                <ul id="taskList"></ul>
                <div class="add-task-form">
                    <input type="text" id="newTask" placeholder="Добавить новую задачу">
                    <select id="taskCategory">
                        <option value="учеба">Учеба</option>
                        <option value="работа">Работа</option>
                        <option value="личное">Личное</option>
                        <option value="другое">Другое</option>
                    </select>
                    <select id="taskPriority">
                        <option value="низкий">Низкий</option>
                        <option value="средний">Средний</option>
                        <option value="высокий">Высокий</option>
                    </select>
                    <button id="addTask">Добавить задачу</button>
                </div>
                <button id="setReminder" style="margin-top: 1rem;">Установить напоминание</button>
                <button id="closeApp" style="margin-top: 1rem;">Закрыть приложение</button>
            </div>
        </div>
        <div id="searchResults" class="search-results" style="display: none;">
            <h3>Результаты поиска</h3>
            <div id="searchList"></div>
        </div>
    `;

    app.innerHTML = html;

    updateStats();

    // Event listeners
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    document.querySelectorAll('.day').forEach(day => {
        day.addEventListener('click', (e) => {
            const date = e.target.dataset.date;
            showTasks(date);
        });
        day.addEventListener('dragover', (e) => {
            e.preventDefault();
            day.classList.add('drag-over');
        });
        day.addEventListener('dragleave', () => {
            day.classList.remove('drag-over');
        });
        day.addEventListener('drop', (e) => {
            e.preventDefault();
            day.classList.remove('drag-over');
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            const toDate = day.dataset.date;
            if (data.fromDate !== toDate) {
                const task = tasks[data.fromDate][data.taskIndex];
                tasks[data.fromDate].splice(data.taskIndex, 1);
                if (!tasks[toDate]) tasks[toDate] = [];
                tasks[toDate].push(task);
                if (tasks[data.fromDate].length === 0) delete tasks[data.fromDate];
                saveTasks();
                renderCalendar();
                if (document.getElementById('taskModal').style.display === 'block') {
                    showTasks(document.getElementById('modalDate').dataset.date);
                }
            }
        });
    });

    document.querySelectorAll('.day').forEach(day => {
        day.addEventListener('click', (e) => {
            const date = e.target.dataset.date;
            showTasks(date);
        });
    });

    document.querySelector('.close').addEventListener('click', () => {
        document.getElementById('taskModal').style.display = 'none';
    });

    document.getElementById('addTask').addEventListener('click', async () => {
        const taskInput = document.getElementById('newTask');
        const category = document.getElementById('taskCategory').value;
        const priority = document.getElementById('taskPriority').value;
        const date = document.getElementById('modalDate').dataset.date;
        if (taskInput.value.trim()) {
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
            showTasks(date);
            renderCalendar();
        }
    });

    document.getElementById('themeToggle').addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', currentTheme);
        applyTheme();
        renderCalendar();
    });

    document.getElementById('exportData').addEventListener('click', () => {
        const dataStr = JSON.stringify(tasks, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = 'tasks_backup.json';
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    });

    document.getElementById('importData').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedTasks = JSON.parse(e.target.result);
                    tasks = { ...tasks, ...importedTasks };
                    localStorage.setItem('tasks', JSON.stringify(tasks));
                    renderCalendar();
                    alert('Данные импортированы успешно!');
                } catch (error) {
                    alert('Ошибка при импорте данных');
                }
            };
            reader.readAsText(file);
        }
    });

    document.getElementById('search').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (query) {
            // Global search
            const results = {};
            Object.keys(tasks).forEach(date => {
                const dayTasks = tasks[date].filter(task => 
                    task.text.toLowerCase().includes(query) || 
                    task.category.toLowerCase().includes(query)
                );
                if (dayTasks.length > 0) {
                    results[date] = dayTasks;
                }
            });
            showSearchResults(results, query);
        } else {
            // Hide search results if query is empty
            const searchResults = document.getElementById('searchResults');
            if (searchResults) searchResults.style.display = 'none';
        }
    });

    document.getElementById('closeApp').addEventListener('click', () => {
        if (window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.close();
        } else {
            alert('Это не Telegram Mini-App');
        }
    });

    document.getElementById('categoryFilter').addEventListener('change', () => {
        showTasks(document.getElementById('modalDate').dataset.date);
    });

    document.getElementById('showPendingOnly').addEventListener('change', () => {
        showTasks(document.getElementById('modalDate').dataset.date);
    });
}

function showTasks(date) {
    const modal = document.getElementById('taskModal');
    const modalDate = document.getElementById('modalDate');
    const taskList = document.getElementById('taskList');

    modalDate.textContent = new Date(date).toLocaleDateString('ru-RU');
    modalDate.dataset.date = date;

    const categoryFilter = document.getElementById('categoryFilter').value;
    const showPendingOnly = document.getElementById('showPendingOnly').checked;

    taskList.innerHTML = '';
    if (tasks[date]) {
        let filteredTasks = tasks[date];
        if (categoryFilter !== 'all') {
            filteredTasks = filteredTasks.filter(task => task.category === categoryFilter);
        }
        if (showPendingOnly) {
            filteredTasks = filteredTasks.filter(task => !task.completed);
        }
        filteredTasks.sort((a, b) => {
            const priorityOrder = { 'высокий': 3, 'средний': 2, 'низкий': 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
        filteredTasks.forEach((task, index) => {
            const li = document.createElement('li');
            li.className = `priority-${task.priority}`;
            li.draggable = true;
            li.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ fromDate: date, taskIndex: index }));
            });

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = task.completed;
            checkbox.addEventListener('change', async () => {
                task.completed = checkbox.checked;
                await saveTasks(date);
                showTasks(date);
                renderCalendar();
            });
            li.appendChild(checkbox);

            const taskInfo = document.createElement('div');
            taskInfo.className = 'task-info';

            const span = document.createElement('span');
            span.textContent = task.text;
            span.style.textDecoration = task.completed ? 'line-through' : 'none';
            taskInfo.appendChild(span);

            const category = document.createElement('small');
            category.textContent = ` (${task.category})`;
            taskInfo.appendChild(category);

            li.appendChild(taskInfo);

            const editBtn = document.createElement('button');
            editBtn.textContent = 'Ред.';
            editBtn.addEventListener('click', async () => {
                const newText = prompt('Редактировать задачу:', task.text);
                if (newText !== null && newText.trim()) {
                    task.text = newText.trim();
                    await saveTasks(date);
                    showTasks(date);
                }
            });
            li.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Удалить';
            deleteBtn.addEventListener('click', async () => {
                tasks[date].splice(index, 1);
                if (tasks[date].length === 0) delete tasks[date];
                await saveTasks(date);
                showTasks(date);
                renderCalendar();
            });
            li.appendChild(deleteBtn);

            taskList.appendChild(li);
        });
    }

    modal.style.display = 'block';
}

function showSearchResults(results, query) {
    const searchResults = document.getElementById('searchResults');
    const searchList = document.getElementById('searchList');
    
    searchList.innerHTML = '';
    if (Object.keys(results).length === 0) {
        searchList.innerHTML = '<p>Ничего не найдено</p>';
    } else {
        Object.keys(results).forEach(date => {
            const dateHeader = document.createElement('h4');
            dateHeader.textContent = new Date(date).toLocaleDateString('ru-RU');
            searchList.appendChild(dateHeader);
            
            const ul = document.createElement('ul');
            results[date].forEach(task => {
                const li = document.createElement('li');
                li.className = `priority-${task.priority}`;
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = task.completed;
                checkbox.addEventListener('change', () => {
                    task.completed = checkbox.checked;
                    localStorage.setItem('tasks', JSON.stringify(tasks));
                    showSearchResults(results, query);
                    renderCalendar();
                });
                li.appendChild(checkbox);
                
                const span = document.createElement('span');
                span.textContent = task.text;
                span.style.textDecoration = task.completed ? 'line-through' : 'none';
                li.appendChild(span);
                
                const category = document.createElement('small');
                category.textContent = ` (${task.category})`;
                li.appendChild(category);
                
                ul.appendChild(li);
            });
            searchList.appendChild(ul);
        });
    }
    
    searchResults.style.display = 'block';
}

function updateStats() {
    let total = 0;
    let completed = 0;
    let overdue = 0;
    const now = new Date();

    Object.keys(tasks).forEach(date => {
        const dayTasks = tasks[date];
        dayTasks.forEach(task => {
            total++;
            if (task.completed) completed++;
            if (!task.completed && new Date(date) < now) overdue++;
        });
    });

    document.getElementById('totalTasks').textContent = total;
    document.getElementById('completedTasks').textContent = completed;
    document.getElementById('overdueTasks').textContent = overdue;
}

// Initialize
applyTheme();
if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
    userId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    if (userId) {
        loadTasks().then(() => renderCalendar());
    } else {
        // Fallback for non-Telegram usage
        tasks = JSON.parse(localStorage.getItem('tasks') || '{}');
        renderCalendar();
    }
} else {
    // For development outside Telegram
    tasks = JSON.parse(localStorage.getItem('tasks') || '{}');
    renderCalendar();
}
