// チーム管理TODOアプリ用スクリプト 

const AVATAR_COLORS = [
    '#FFB6B9', '#FFDAC1', '#B5EAD7', '#C7CEEA', '#E2F0CB', '#FFB347', '#B39EB5', '#77DD77', '#AEC6CF', '#FFD1DC', '#FDFD96', '#CFCFC4', '#836953', '#779ECB', '#966FD6', '#F49AC2'
];
const DEFAULT_CATEGORIES = ['開発', 'デザイン', '企画', 'その他'];

// --- クラウド同期対応データ構造 ---
const TEAM_ID = 'team_default'; // 仮のチームID
const CURRENT_USER_ID = 'user_local'; // 仮のユーザーID

function generateId(prefix) {
    return prefix + '_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
}

function nowISO() {
    return new Date().toISOString();
}

function addSyncLog(type, detail) {
    const logs = loadSyncLog();
    logs.unshift({
        time: nowISO(),
        type,
        detail
    });
    localStorage.setItem('sync-log', JSON.stringify(logs.slice(0, 100)));
    renderSyncLog();
}

function loadSyncLog() {
    return JSON.parse(localStorage.getItem('sync-log') || '[]');
}

function renderSyncLog() {
    const area = document.getElementById('sync-log-area');
    if (!area) return;
    const logs = loadSyncLog();
    if (logs.length === 0) {
        area.innerHTML = '<div>同期ログはありません。</div>';
        return;
    }
    area.innerHTML = logs.map(log => `<div>[${log.time}] <b>${log.type}</b>: ${log.detail}</div>`).join('');
}

// --- データ整合性チェック ---
function checkIntegrity() {
    let ok = true;
    let msg = '';
    // タスク
    for (const t of tasks) {
        if (!t.id || !t.teamId || !t.userId || !t.updatedAt || !t.syncState) {
            ok = false;
            msg += `タスクID:${t.id || '?'} フィールド欠落\n`;
        }
        if (!['local','synced','conflict'].includes(t.syncState)) {
            ok = false;
            msg += `タスクID:${t.id} syncState不正\n`;
        }
    }
    // メンバー
    for (const m of members) {
        if (!m.id || !m.teamId || !m.userId || !m.updatedAt || !m.syncState) {
            ok = false;
            msg += `メンバーID:${m.id || '?'} フィールド欠落\n`;
        }
        if (!['local','synced','conflict'].includes(m.syncState)) {
            ok = false;
            msg += `メンバーID:${m.id} syncState不正\n`;
        }
    }
    // カテゴリ
    for (const c of categories) {
        if (typeof c === 'object') {
            if (!c.id || !c.teamId || !c.userId || !c.updatedAt || !c.syncState || !c.name) {
                ok = false;
                msg += `カテゴリID:${c.id || '?'} フィールド欠落\n`;
            }
            if (!['local','synced','conflict'].includes(c.syncState)) {
                ok = false;
                msg += `カテゴリID:${c.id} syncState不正\n`;
            }
        }
    }
    const result = document.getElementById('integrity-result');
    if (ok) {
        result.textContent = 'データは整合性があります';
        result.className = 'success';
    } else {
        result.textContent = msg;
        result.className = 'error';
    }
}

document.getElementById('integrity-check-btn')?.addEventListener('click', checkIntegrity);

// --- データ追加・編集時のフィールド付与 ---
function enrichTask(task) {
    return {
        ...task,
        id: task.id || generateId('task'),
        teamId: task.teamId || TEAM_ID,
        userId: task.userId || CURRENT_USER_ID,
        updatedAt: nowISO(),
        syncState: task.syncState || 'local'
    };
}
function enrichMember(member) {
    return {
        ...member,
        id: member.id || generateId('member'),
        teamId: member.teamId || TEAM_ID,
        userId: member.userId || CURRENT_USER_ID,
        updatedAt: nowISO(),
        syncState: member.syncState || 'local'
    };
}
function enrichCategory(cat) {
    if (typeof cat === 'object') {
        return {
            ...cat,
            id: cat.id || generateId('cat'),
            teamId: cat.teamId || TEAM_ID,
            userId: cat.userId || CURRENT_USER_ID,
            updatedAt: nowISO(),
            syncState: cat.syncState || 'local',
            name: cat.name
        };
    } else {
        // 旧形式の文字列カテゴリをオブジェクト化
        return {
            id: generateId('cat'),
            teamId: TEAM_ID,
            userId: CURRENT_USER_ID,
            updatedAt: nowISO(),
            syncState: 'local',
            name: cat
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // --- タスク管理 ---
    const taskForm = document.getElementById('task-form');
    const taskList = document.getElementById('task-list');
    const assigneeSelect = document.getElementById('task-assignee');
    const assigneeFilter = document.getElementById('assignee-filter');
    const statusFilter = document.getElementById('status-filter');
    const deadlineFilter = document.getElementById('deadline-filter');
    const searchInput = document.getElementById('task-search');
    const prioritySelect = document.getElementById('task-priority');
    const categorySelect = document.getElementById('task-category');
    const newCategoryInput = document.getElementById('new-category');
    const addCategoryBtn = document.getElementById('add-category-btn');
    const sortPriority = document.getElementById('sort-priority');
    const sortCategory = document.getElementById('sort-category');
    const categoryStats = document.getElementById('category-stats');
    let tasks = loadTasks();
    let members = loadMembers();
    let categories = loadCategories();

    // --- メンバー管理 ---
    const memberForm = document.getElementById('member-form');
    const memberList = document.getElementById('member-list');

    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
        addSyncLog('saveTasks', 'タスク保存');
    }

    function loadTasks() {
        const data = localStorage.getItem('tasks');
        let arr = data ? JSON.parse(data) : [];
        // 旧データを新形式に変換
        arr = arr.map(enrichTask);
        return arr;
    }

    function saveMembers() {
        localStorage.setItem('members', JSON.stringify(members));
        addSyncLog('saveMembers', 'メンバー保存');
    }

    function loadMembers() {
        const data = localStorage.getItem('members');
        let arr = data ? JSON.parse(data) : [];
        arr = arr.map(enrichMember);
        return arr;
    }

    function saveCategories() {
        localStorage.setItem('categories', JSON.stringify(categories));
        addSyncLog('saveCategories', 'カテゴリ保存');
    }

    function loadCategories() {
        const data = localStorage.getItem('categories');
        let arr = data ? JSON.parse(data) : DEFAULT_CATEGORIES.slice();
        arr = arr.map(enrichCategory);
        return arr;
    }

    function getAvatarColor(idx) {
        return AVATAR_COLORS[idx % AVATAR_COLORS.length];
    }

    function renderAssigneeSelect() {
        assigneeSelect.innerHTML = '<option value="">担当者を選択</option>';
        members.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.name;
            assigneeSelect.appendChild(opt);
        });
    }

    function renderAssigneeFilter() {
        assigneeFilter.innerHTML = '<option value="all">すべての担当者</option>';
        members.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.name;
            assigneeFilter.appendChild(opt);
        });
    }

    function renderCategorySelect() {
        categorySelect.innerHTML = '';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            categorySelect.appendChild(opt);
        });
    }

    function renderSortCategory() {
        sortCategory.innerHTML = '<option value="none">カテゴリで並び替え</option>';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            sortCategory.appendChild(opt);
        });
    }

    function renderCategoryStats() {
        categoryStats.innerHTML = '';
        categories.forEach(cat => {
            const count = tasks.filter(task => task.category === cat.name).length;
            const card = document.createElement('div');
            card.className = 'category-stat-card';
            card.innerHTML = `<span class="category-badge">${cat.name}</span><div>${count}件</div>`;
            categoryStats.appendChild(card);
        });
    }

    function renderTasks() {
        taskList.innerHTML = '';
        let filtered = tasks;
        // 担当者フィルター
        const assigneeVal = assigneeFilter.value;
        if (assigneeVal && assigneeVal !== 'all') {
            filtered = filtered.filter(t => String(t.assignee) === String(assigneeVal));
        }
        // ステータスフィルター
        const statusVal = statusFilter.value;
        if (statusVal === 'completed') {
            filtered = filtered.filter(t => t.completed);
        } else if (statusVal === 'incomplete') {
            filtered = filtered.filter(t => !t.completed);
        }
        // 期限フィルター
        const deadlineVal = deadlineFilter.value;
        if (deadlineVal && deadlineVal !== 'all') {
            const today = new Date();
            filtered = filtered.filter(task => {
                if (!task.deadline) return false;
                const taskDate = new Date(task.deadline);
                if (deadlineVal === 'today') {
                    return taskDate.toDateString() === today.toDateString();
                } else if (deadlineVal === 'week') {
                    const startOfWeek = new Date(today);
                    startOfWeek.setDate(today.getDate() - today.getDay() + 1);
                    const endOfWeek = new Date(startOfWeek);
                    endOfWeek.setDate(startOfWeek.getDate() + 6);
                    return taskDate >= startOfWeek && taskDate <= endOfWeek;
                } else if (deadlineVal === 'overdue') {
                    return taskDate < today;
                }
                return true;
            });
        }
        // タイトル検索
        const searchVal = searchInput.value.trim();
        if (searchVal) {
            filtered = filtered.filter(task => task.title && task.title.includes(searchVal));
        }
        // 並び替え（優先度）
        const sortPriorityVal = sortPriority.value;
        if (sortPriorityVal && sortPriorityVal !== 'none') {
            filtered = filtered.slice().sort((a, b) => {
                const order = { high: 3, medium: 2, low: 1 };
                return sortPriorityVal === 'high' ? order[b.priority] - order[a.priority] : order[a.priority] - order[b.priority];
            });
        }
        // 並び替え（カテゴリ）
        const sortCategoryVal = sortCategory.value;
        if (sortCategoryVal && sortCategoryVal !== 'none') {
            filtered = filtered.slice().sort((a, b) => {
                if (a.category === b.category) return 0;
                return a.category > b.category ? 1 : -1;
            });
            filtered = filtered.filter(task => task.category === sortCategoryVal);
        }
        if (filtered.length === 0) {
            taskList.innerHTML = '<p>タスクはありません。</p>';
            return;
        }
        filtered.forEach((task, idx) => {
            const card = document.createElement('div');
            card.className = 'task-card' + (task.completed ? ' completed' : '');
            const member = members.find(m => String(m.id) === String(task.assignee));
            const priorityText = { high: '高', medium: '中', low: '低' };
            const priorityClass = { high: 'priority-high', medium: 'priority-medium', low: 'priority-low' };
            card.innerHTML = `
                <div class="task-card-header">
                    <span class="priority-badge ${priorityClass[task.priority]}">${priorityText[task.priority]}</span>
                    <span class="category-badge">${task.category || '未分類'}</span>
                    <span class="task-title">${task.title}</span>
                    <div class="task-actions">
                        <button class="btn-secondary" data-action="toggle" data-idx="${idx}">${task.completed ? '未完了に戻す' : '完了'}</button>
                        <button class="btn-secondary" data-action="delete" data-idx="${idx}">削除</button>
                    </div>
                </div>
                <div class="task-meta">
                    <span>担当: ${member ? `<span class='member-avatar' style='background:${member.color};width:1.5em;height:1.5em;display:inline-flex;align-items:center;justify-content:center;font-size:0.9em;'>${getInitials(member.name)}</span> ${member.name}` : '-'}</span>
                    <span>期限: ${task.deadline || '-'}</span>
                </div>
                <div class="task-desc">${task.description ? task.description.replace(/\n/g, '<br>') : ''}</div>
            `;
            taskList.appendChild(card);
        });
        renderDashboard();
    }

    function getInitials(name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    }

    taskForm.addEventListener('submit', e => {
        e.preventDefault();
        const title = document.getElementById('task-title').value.trim();
        const description = document.getElementById('task-desc').value.trim();
        const deadline = document.getElementById('task-deadline').value;
        const assignee = assigneeSelect.value;
        const priority = prioritySelect.value;
        const category = categorySelect.value;
        if (!title) return;
        tasks.push({ title, description, deadline, assignee, priority, category, completed: false });
        saveTasks();
        renderTasks();
        renderCategoryStats();
        taskForm.reset();
    });

    taskList.addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const idx = btn.getAttribute('data-idx');
        if (btn.getAttribute('data-action') === 'toggle') {
            tasks[idx].completed = !tasks[idx].completed;
            saveTasks();
            renderTasks();
        } else if (btn.getAttribute('data-action') === 'delete') {
            if (confirm('本当に削除しますか？')) {
                tasks.splice(idx, 1);
                saveTasks();
                renderTasks();
            }
        }
    });

    [assigneeFilter, statusFilter, deadlineFilter, searchInput, sortPriority, sortCategory].forEach(el => {
        el.addEventListener('input', () => { renderTasks(); renderCategoryStats(); });
        el.addEventListener('change', () => { renderTasks(); renderCategoryStats(); });
    });

    addCategoryBtn.addEventListener('click', () => {
        const newCat = newCategoryInput.value.trim();
        if (newCat && !categories.some(c => c.name === newCat)) {
            categories.push(enrichCategory({ name: newCat }));
            saveCategories();
            renderCategorySelect();
            renderSortCategory();
            renderCategoryStats();
            newCategoryInput.value = '';
        }
    });

    // --- メンバー管理 ---
    memberForm.addEventListener('submit', e => {
        e.preventDefault();
        const name = document.getElementById('member-name').value.trim();
        const email = document.getElementById('member-email').value.trim();
        const role = document.getElementById('member-role').value.trim();
        if (!name || !email) return;
        const id = Date.now();
        const color = getAvatarColor(members.length);
        members.push({ id, name, email, role, color });
        saveMembers();
        renderMembers();
        renderAssigneeSelect();
        renderAssigneeFilter();
        renderTasks();
        renderCategoryStats();
        memberForm.reset();
    });

    function renderMembers() {
        memberList.innerHTML = '';
        if (members.length === 0) {
            memberList.innerHTML = '<p>メンバーがいません。</p>';
            return;
        }
        members.forEach((m, idx) => {
            const card = document.createElement('div');
            card.className = 'member-card';
            card.innerHTML = `
                <span class="member-avatar" style="background:${m.color}">${getInitials(m.name)}</span>
                <div class="member-info">
                    <div class="member-name">${m.name}</div>
                    <div class="member-email">${m.email}</div>
                    <div class="member-role">${m.role || ''}</div>
                </div>
                <button class="member-delete-btn" data-idx="${idx}">削除</button>
            `;
            card.querySelector('.member-delete-btn').onclick = () => {
                if (confirm('本当に削除しますか？')) {
                    members.splice(idx, 1);
                    saveMembers();
                    renderMembers();
                    renderAssigneeSelect();
                    renderAssigneeFilter();
                    renderTasks();
                    renderCategoryStats();
                }
            };
            memberList.appendChild(card);
        });
        renderDashboard();
    }

    // 初期描画
    renderMembers();
    renderAssigneeSelect();
    renderAssigneeFilter();
    renderCategorySelect();
    renderSortCategory();
    renderCategoryStats();
    renderTasks();

    // データ管理機能
    function setupDataManagement() {
        const exportBtn = document.getElementById('export-json');
        const importBtn = document.getElementById('import-json-btn');
        const importInput = document.getElementById('import-json');
        const backupBtn = document.getElementById('backup-data');
        const restoreBtn = document.getElementById('restore-data');
        const sampleBtn = document.getElementById('load-sample-data');
        const validationResult = document.getElementById('validation-result');

        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const data = {
                    tasks,
                    members,
                    categories
                };
                const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'todo-backup.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showValidationResult('データをエクスポートしました', true);
            });
        }
        if (importBtn && importInput) {
            importBtn.addEventListener('click', () => importInput.click());
            importInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        if (validateData(data)) {
                            tasks = data.tasks || [];
                            members = data.members || [];
                            categories = data.categories || [];
                            saveTasks();
                            saveMembers();
                            saveCategories();
                            renderMembers();
                            renderAssigneeSelect();
                            renderAssigneeFilter();
                            renderCategorySelect();
                            renderSortCategory();
                            renderCategoryStats();
                            renderTasks();
                            showValidationResult('データをインポートしました', true);
                        }
                    } catch (err) {
                        showValidationResult('インポート失敗: 不正なJSONです', false);
                    }
                };
                reader.readAsText(file);
            });
        }
        if (backupBtn) {
            backupBtn.addEventListener('click', () => {
                const data = {
                    tasks,
                    members,
                    categories
                };
                localStorage.setItem('todo-backup', JSON.stringify(data));
                showValidationResult('バックアップを保存しました', true);
            });
        }
        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => {
                const data = localStorage.getItem('todo-backup');
                if (!data) {
                    showValidationResult('バックアップがありません', false);
                    return;
                }
                try {
                    const parsed = JSON.parse(data);
                    if (validateData(parsed)) {
                        tasks = parsed.tasks || [];
                        members = parsed.members || [];
                        categories = parsed.categories || [];
                        saveTasks();
                        saveMembers();
                        saveCategories();
                        renderMembers();
                        renderAssigneeSelect();
                        renderAssigneeFilter();
                        renderCategorySelect();
                        renderSortCategory();
                        renderCategoryStats();
                        renderTasks();
                        showValidationResult('リストアしました', true);
                    }
                } catch (err) {
                    showValidationResult('リストア失敗: 不正なデータ', false);
                }
            });
        }
        if (sampleBtn) {
            sampleBtn.addEventListener('click', async () => {
                try {
                    const response = await fetch('data.json');
                    const data = await response.json();
                    if (validateData(data)) {
                        tasks = data.tasks || [];
                        members = data.members || [];
                        categories = data.categories || [];
                        saveTasks();
                        saveMembers();
                        saveCategories();
                        renderMembers();
                        renderAssigneeSelect();
                        renderAssigneeFilter();
                        renderCategorySelect();
                        renderSortCategory();
                        renderCategoryStats();
                        renderTasks();
                        showValidationResult('サンプルデータを読み込みました', true);
                    }
                } catch (err) {
                    showValidationResult('サンプルデータの読み込みに失敗しました', false);
                }
            });
        }
        function validateData(data) {
            if (!data || typeof data !== 'object') {
                showValidationResult('データが不正です', false);
                return false;
            }
            if (!Array.isArray(data.tasks) || !Array.isArray(data.members)) {
                showValidationResult('tasks/membersが配列ではありません', false);
                return false;
            }
            for (const t of data.tasks) {
                if (!t.title || typeof t.title !== 'string') {
                    showValidationResult('タスクにタイトルがありません', false);
                    return false;
                }
            }
            for (const m of data.members) {
                if (!m.name || typeof m.name !== 'string') {
                    showValidationResult('メンバーに名前がありません', false);
                    return false;
                }
            }
            showValidationResult('データは有効です', true);
            return true;
        }
        function showValidationResult(msg, success) {
            if (!validationResult) return;
            validationResult.textContent = msg;
            validationResult.className = success ? 'success' : 'error';
        }
    }

    setupDataManagement();

    renderDashboard();

    setupAppearanceSettings();

    // --- 初期化時に同期ログ描画 ---
    renderSyncLog();

    // ===== 外観カスタマイズ（テーマ・カラー・フォントサイズ） =====
    const THEME_KEY = 'todo_theme_mode';
    const COLOR_KEY = 'todo_theme_color';
    const FONT_KEY = 'todo_font_size';

    function applyThemeSettings() {
        const mode = localStorage.getItem(THEME_KEY) || 'light';
        const color = localStorage.getItem(COLOR_KEY) || 'blue';
        const font = localStorage.getItem(FONT_KEY) || 'normal';
        document.body.classList.remove('theme-light', 'theme-dark', 'theme-blue', 'theme-green', 'theme-pink', 'font-large', 'font-xlarge');
        document.body.classList.add(`theme-${mode}`);
        document.body.classList.add(`theme-${color}`);
        if (font === 'large') document.body.classList.add('font-large');
        else if (font === 'xlarge') document.body.classList.add('font-xlarge');
    }

    function initSettingsForm() {
        const form = document.getElementById('settings-form');
        if (!form) return;
        // 初期値セット
        form['theme-mode'].value = localStorage.getItem(THEME_KEY) || 'light';
        form['theme-color'].value = localStorage.getItem(COLOR_KEY) || 'blue';
        form['font-size'].value = localStorage.getItem(FONT_KEY) || 'normal';
        // フォントサイズ表示（もしスライダー型なら）
        // 保存ボタン
        form.addEventListener('submit', e => {
            e.preventDefault();
            const mode = form['theme-mode'].value;
            const color = form['theme-color'].value;
            const font = form['font-size'].value;
            localStorage.setItem(THEME_KEY, mode);
            localStorage.setItem(COLOR_KEY, color);
            localStorage.setItem(FONT_KEY, font);
            applyThemeSettings();
            showToast('外観設定を保存しました');
        });
    }

    applyThemeSettings();
    initSettingsForm();
});

function renderDashboard() {
    // 全体進捗
    const progressBar = document.getElementById('overall-progress-bar');
    const progressPercent = document.getElementById('overall-progress-percent');
    const memberProgressList = document.getElementById('member-progress-list');
    const categoryPieChart = document.getElementById('category-pie-chart');
    const overdueWarning = document.getElementById('overdue-warning');
    const todayCount = document.getElementById('today-count');
    const weekCount = document.getElementById('week-count');

    if (!progressBar) return; // ダッシュボードがない場合は何もしない

    // 全体完了率
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const percent = total ? Math.round((completed / total) * 100) : 0;
    progressBar.style.width = percent + '%';
    progressPercent.textContent = percent + '% 完了';

    // 担当者別進捗
    memberProgressList.innerHTML = '';
    members.forEach(m => {
        const userTasks = tasks.filter(t => String(t.assignee) === String(m.id));
        const userTotal = userTasks.length;
        const userCompleted = userTasks.filter(t => t.completed).length;
        const userPercent = userTotal ? Math.round((userCompleted / userTotal) * 100) : 0;
        const div = document.createElement('div');
        div.className = 'member-progress';
        div.innerHTML = `
            <span class="member-avatar" style="background:${m.color};width:1.5em;height:1.5em;display:inline-flex;align-items:center;justify-content:center;font-size:0.9em;">${getInitials(m.name)}</span>
            <span>${m.name}</span>
            <div class="member-progress-bar-bg"><div class="member-progress-bar" style="width:${userPercent}%;"></div></div>
            <span>${userPercent}%</span>
        `;
        memberProgressList.appendChild(div);
    });

    // カテゴリ別タスク数（円グラフ風）
    categoryPieChart.innerHTML = '';
    const catCounts = categories.map(cat => tasks.filter(t => t.category === cat.name).length);
    const catTotal = catCounts.reduce((a, b) => a + b, 0);
    let start = 0;
    let conic = '';
    const colors = ['#667eea', '#f1c40f', '#e74c3c', '#27ae60', '#B39EB5', '#FFB6B9', '#FFDAC1', '#B5EAD7'];
    categories.forEach((cat, i) => {
        const val = catCounts[i];
        const deg = catTotal ? (val / catTotal) * 360 : 0;
        const end = start + deg;
        conic += `${colors[i % colors.length]} ${start}deg ${end}deg,`;
        start = end;
    });
    if (catTotal > 0) {
        categoryPieChart.style.background = `conic-gradient(${conic.slice(0, -1)})`;
    } else {
        categoryPieChart.style.background = '#e9ecef';
    }
    // 凡例
    let legend = '<div class="pie-chart-legend">';
    categories.forEach((cat, i) => {
        legend += `<div class="pie-legend-item"><span class="pie-legend-color" style="background:${colors[i % colors.length]}"></span>${cat.name} (${catCounts[i]})</div>`;
    });
    legend += '</div>';
    categoryPieChart.innerHTML = legend;

    // 期限切れタスク警告
    const now = new Date();
    const overdue = tasks.filter(t => t.deadline && !t.completed && new Date(t.deadline) < now);
    if (overdue.length > 0) {
        overdueWarning.textContent = `⚠️ 期限切れタスク: ${overdue.length}件`;
    } else {
        overdueWarning.textContent = '期限切れタスクはありません';
        overdueWarning.style.color = '#27ae60';
    }

    // 今日・今週の予定タスク数
    const todayStr = now.toISOString().slice(0, 10);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const todayTasks = tasks.filter(t => t.deadline === todayStr);
    const weekTasks = tasks.filter(t => t.deadline && new Date(t.deadline) >= startOfWeek && new Date(t.deadline) <= endOfWeek);
    todayCount.textContent = todayTasks.length;
    weekCount.textContent = weekTasks.length;
}

function setupAppearanceSettings() {
    const modeSel = document.getElementById('theme-mode');
    const colorSel = document.getElementById('color-theme');
    const fontSizeRange = document.getElementById('font-size');
    const fontSizeValue = document.getElementById('font-size-value');
    const cardLayoutSel = document.getElementById('card-layout');
    const taskList = document.getElementById('task-list');

    // 設定の復元
    const saved = JSON.parse(localStorage.getItem('appearance-settings') || '{}');
    if (saved.mode) {
        document.body.classList.toggle('theme-dark', saved.mode === 'dark');
        modeSel.value = saved.mode;
    }
    if (saved.color) {
        document.body.classList.remove('theme-blue', 'theme-green', 'theme-purple');
        document.body.classList.add('theme-' + saved.color);
        colorSel.value = saved.color;
    }
    if (saved.fontSize) {
        document.body.style.setProperty('--font-size', saved.fontSize + 'px');
        fontSizeRange.value = saved.fontSize;
        fontSizeValue.textContent = saved.fontSize + 'px';
    }
    if (saved.layout) {
        taskList.classList.remove('list-layout', 'grid-layout');
        taskList.classList.add(saved.layout + '-layout');
        cardLayoutSel.value = saved.layout;
    }

    // イベント
    modeSel.addEventListener('change', () => {
        document.body.classList.toggle('theme-dark', modeSel.value === 'dark');
        save();
    });
    colorSel.addEventListener('change', () => {
        document.body.classList.remove('theme-blue', 'theme-green', 'theme-purple');
        document.body.classList.add('theme-' + colorSel.value);
        save();
    });
    fontSizeRange.addEventListener('input', () => {
        document.body.style.setProperty('--font-size', fontSizeRange.value + 'px');
        fontSizeValue.textContent = fontSizeRange.value + 'px';
        save();
    });
    cardLayoutSel.addEventListener('change', () => {
        taskList.classList.remove('list-layout', 'grid-layout');
        taskList.classList.add(cardLayoutSel.value + '-layout');
        save();
    });
    function save() {
        localStorage.setItem('appearance-settings', JSON.stringify({
            mode: modeSel.value,
            color: colorSel.value,
            fontSize: fontSizeRange.value,
            layout: cardLayoutSel.value
        }));
    }
}

// --- ローディング・空状態・エラーUI ---
function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (!overlay) return;
    overlay.hidden = !show;
}
function showEmptyState(show, type = 'task') {
    const empty = document.getElementById('empty-state');
    if (!empty) return;
    empty.hidden = !show;
    if (show) {
        empty.querySelector('.empty-message').textContent =
            type === 'task' ? 'まだタスクがありません。\n「追加」ボタンから新しいタスクを作成しましょう！'
            : 'まだデータがありません。\n「追加」ボタンから新しい項目を作成しましょう！';
    }
}

// --- ハンバーガーメニュー ---
document.getElementById('nav-toggle')?.addEventListener('click', () => {
    const navList = document.getElementById('main-nav-list');
    const btn = document.getElementById('nav-toggle');
    const open = navList.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
});

// --- ショートカットガイドモーダル ---
function openShortcutModal() {
    const modal = document.getElementById('shortcut-modal');
    if (!modal) return;
    modal.hidden = false;
    // フォーカスを最初のフォーカス可能要素に
    const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length) focusable[0].focus();
    // フォーカストラップ用フラグ
    modal.setAttribute('data-open', 'true');
}
function closeShortcutModal() {
    const modal = document.getElementById('shortcut-modal');
    if (!modal) return;
    modal.hidden = true;
    modal.removeAttribute('data-open');
}
document.getElementById('close-shortcut-modal')?.addEventListener('click', closeShortcutModal);
// モーダル外クリックで閉じる
const shortcutModal = document.getElementById('shortcut-modal');
if (shortcutModal) {
    shortcutModal.addEventListener('mousedown', function(e) {
        if (e.target === shortcutModal) {
            closeShortcutModal();
        }
    });
    // フォーカストラップ
    shortcutModal.addEventListener('keydown', function(e) {
        if (shortcutModal.hidden) return;
        if (e.key === 'Tab') {
            const focusable = shortcutModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    last.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === last) {
                    first.focus();
                    e.preventDefault();
                }
            }
        }
    });
}

// --- キーボードショートカット ---
document.addEventListener('keydown', e => {
    if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
        document.getElementById('task-title')?.focus();
        e.preventDefault();
    } else if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        document.getElementById('task-search')?.focus();
        e.preventDefault();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        // 保存ショートカット
        try { saveTasks(); showToast('保存しました'); } catch (err) { showToast('保存失敗', true); }
        e.preventDefault();
    } else if (e.key === '?') {
        openShortcutModal();
        e.preventDefault();
    } else if (e.key === 'Escape') {
        closeShortcutModal();
    }
});

// --- アクセシビリティ: フォーカス制御 ---
document.querySelectorAll('a,button,input,select,textarea').forEach(el => {
    el.addEventListener('focus', e => {
        e.target.setAttribute('aria-selected', 'true');
    });
    el.addEventListener('blur', e => {
        e.target.removeAttribute('aria-selected');
    });
});

// --- パフォーマンス: 差分描画例（タスクリスト） ---
function renderTasksDiff(newTasks) {
    const taskList = document.getElementById('task-list');
    if (!taskList) return;
    // 差分描画（例: idで比較して追加/削除/更新のみ）
    // ...ここに仮想DOM的な差分描画ロジックを実装可能...
}

// --- エラーハンドリング例 ---
function safe(fn) {
    try { fn(); } catch (err) { showToast('エラー: ' + err.message, true); }
}
function showToast(msg, error = false) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.background = error ? '#e74c3c' : '#27ae60';
    toast.style.color = '#fff';
    toast.style.position = 'fixed';
    toast.style.bottom = '2rem';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.padding = '1rem 2rem';
    toast.style.borderRadius = '8px';
    toast.style.zIndex = 9999;
    toast.style.opacity = 1;
    setTimeout(() => { toast.style.opacity = 0; }, 2000);
} 