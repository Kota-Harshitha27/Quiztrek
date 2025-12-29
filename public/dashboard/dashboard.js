/* // dashboard.js
// Place this in public/dashboard (or adjust path in dashboard HTML)
(() => {
  const API_BASE = window.API_BASE || 'http://localhost:5000';
  const token = localStorage.getItem('token');

  // DOM refs
  const profilePic = document.getElementById('profile-pic');
  const welcomeText = document.getElementById('welcome-text');
  const userMeta = document.getElementById('user-meta');
  const quizzesAttemptedEl = document.getElementById('Quizzes_attempted');
  const currentStreakEl = document.getElementById('current-streak');
  const maxStreakEl = document.getElementById('max-streak');
  const accuracyEl = document.getElementById('accuracy');
  const leaderboardTableBody = document.querySelector('#leaderboard-table tbody');
  const recentQuizzesList = document.getElementById('recent-quizzes');
  const todoTableBody = document.querySelector('#todo-table tbody');

  if (!token) {
    console.warn('No auth token found. Dashboard requests will fail.');
  }

  // Utility: fetch wrapper with Authorization header
  async function apiFetch(path, opts = {}) {
    opts.headers = opts.headers || {};
    if (token) opts.headers.Authorization = `Bearer ${token}`;
    try {
      const res = await fetch(API_BASE + path, opts);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API ${path} failed ${res.status}: ${text}`);
      }
      return await res.json();
    } catch (err) {
      console.error('apiFetch error', path, err);
      throw err;
    }
  }

  // ---------------- Profile & stats loader ----------------
  async function loadProfileAndStats() {
    try {
      const student = await apiFetch('/profile');

      // Profile UI
      profilePic.src = student.profileImage || '/images/file.jpeg';
      welcomeText.innerText = student.fullName || 'Welcome';
      userMeta.innerText = `Class: ${student.grade ?? '-'} | Username: ${student.fullName ?? '-'}`;

      // load recent quizzes
      // Expecting endpoint: GET /profile/recent-quizzes -> [{ quizId, title, score, submittedAt }]
      const recentQuizzes = await apiFetch('/profile/recent-quizzes');

      renderRecentQuizzes(recentQuizzes);

      // quizzes attempted
      quizzesAttemptedEl.innerText = recentQuizzes.length;

      // accuracy: compute average percentage across quizzes if scores present (score/total)
      // Assume each quiz object has {score, total} or {score, maxScore}
      const accuracy = computeAccuracy(recentQuizzes);
      accuracyEl.innerText = accuracy !== null ? `${accuracy.toFixed(1)}%` : '-';

      // compute streaks and possibly update server-side (PUT /profile/streaks)
      const { currentStreak, maxStreak } = computeStreaks(recentQuizzes);

      // Update DOM
      currentStreakEl.innerText = `Current Streak 🔥 : ${currentStreak}`;
      maxStreakEl.innerText = `Max streak : ${maxStreak}`;

      // Optionally push streak update to server (if you want server to store)
      // call apiFetch('/profile/streaks', { method: 'PUT', body: JSON.stringify({ currentStreak, maxStreak }), headers: {'Content-Type':'application/json'} })
      // uncomment to persist
      // await apiFetch('/profile/streaks', { method: 'PUT', body: JSON.stringify({ currentStreak, maxStreak }), headers: {'Content-Type':'application/json'} });

    } catch (err) {
      console.error('loadProfileAndStats failed', err);
    }
  }

  // Compute accuracy average
  function computeAccuracy(recentQuizzes) {
    if (!Array.isArray(recentQuizzes) || recentQuizzes.length === 0) return null;
    let totalPercent = 0;
    let count = 0;
    for (const q of recentQuizzes) {
      if (typeof q.score === 'number' && typeof q.total === 'number' && q.total > 0) {
        totalPercent += (q.score / q.total) * 100;
        count++;
      } else if (typeof q.score === 'number' && typeof q.maxScore === 'number' && q.maxScore > 0) {
        totalPercent += (q.score / q.maxScore) * 100;
        count++;
      }
    }
    return count > 0 ? (totalPercent / count) : null;
  }

  // ---------------- Streak calculation ----------------
  // recentQuizzes: array of objects that include submittedAt (ISO string or date)
  // rules: if student submitted at least one quiz on a day -> that day counts
  function computeStreaks(recentQuizzes = []) {
    // Build set of unique submission dates (YYYY-MM-DD)
    const dateSet = new Set();
    recentQuizzes.forEach(q => {
      const d = q.submittedAt ? new Date(q.submittedAt) : null;
      if (!d || isNaN(d)) return;
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      dateSet.add(key);
    });

    // If no quiz dates
    if (dateSet.size === 0) return { currentStreak: 0, maxStreak: 0 };

    // Convert set to array of dates descending
    const dates = Array.from(dateSet).sort((a, b) => (a < b ? 1 : -1)); // newest first

    // Compute current streak: count consecutive days backward from today
    const today = new Date();
    // Normalize today's YYYY-MM-DD
    function ymd(date) {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }
    let streak = 0;
    let dayPointer = ymd(today);

    for (;;) {
      const key = dayPointer.toISOString().slice(0, 10);
      if (dateSet.has(key)) {
        streak++;
        // move pointer one day back
        dayPointer = new Date(dayPointer.getTime() - 24 * 60 * 60 * 1000);
      } else {
        // if today not in set but yesterday is, current streak should be 0 (as per your rule),
        // but if you want streak to be counted even if today missing then start from most recent day:
        // current logic: only consecutive days up to today count.
        break;
      }
    }

    // Alternative interpretation: if they submitted today or yesterday and submissions are consecutive — but user specified
    // "if student submitted at least one quiz that day increase the current streak by 1 per day ... if next day not submitted make it 0"
    // So the above is correct: streak counts consecutive days up to today, else 0.

    // Compute max streak from dates set: find longest run anywhere
    const sortedDatesAsc = Array.from(dateSet).sort(); // oldest -> newest
    let maxStreak = 0;
    let run = 0;
    let prev = null;
    for (const dstr of sortedDatesAsc) {
      const d = new Date(dstr);
      if (!prev) {
        run = 1;
      } else {
        const diffDays = Math.round((d - prev) / (24 * 60 * 60 * 1000));
        if (diffDays === 1) {
          run++;
        } else {
          run = 1;
        }
      }
      if (run > maxStreak) maxStreak = run;
      prev = d;
    }

    return { currentStreak: streak, maxStreak };
  }

  // ---------------- Recent quizzes renderer ----------------
  function renderRecentQuizzes(quizzes) {
    // `recent-quizzes` is a ul in the HTML in the provided template; but user asked "tabular format"
    // So we will render each quiz as a list item with basic details; you can replace with a <table> if preferred.
    recentQuizzesList.innerHTML = '';
    if (!Array.isArray(quizzes) || quizzes.length === 0) {
      recentQuizzesList.innerHTML = '<li>No recent quizzes</li>';
      return;
    }

    // Sort newest first by submittedAt
    quizzes.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    for (const q of quizzes) {
      // each q expected to have: title, score, total, submittedAt
      const date = q.submittedAt ? new Date(q.submittedAt) : null;
      const dateStr = date ? date.toLocaleString() : '-';
      const scoreStr = (typeof q.score === 'number') ? (typeof q.total === 'number' ? `${q.score}/${q.total}` : `${q.score}`) : '-';
      const li = document.createElement('li');
      li.style.padding = '8px 0';
      li.innerHTML = `<strong>${escapeHtml(q.title || 'Quiz')}</strong> — Score: ${escapeHtml(scoreStr)} <span style="color:#666"> (${escapeHtml(dateStr)})</span>`;
      recentQuizzesList.appendChild(li);
    }
  }

  // simple escape helper
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---------------- Leaderboard ----------------
  async function loadLeaderboard() {
    try {
      // expects GET /leaderboard -> [{ username, score }]
      const top = await apiFetch('/leaderboard');
      leaderboardTableBody.innerHTML = '';
      if (!Array.isArray(top) || top.length === 0) {
        leaderboardTableBody.innerHTML = '<tr><td colspan="3">No data</td></tr>';
        return;
      }
      top.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${idx + 1}</td><td>${escapeHtml(row.username || row.fullName || '-')}</td><td>${escapeHtml(String(row.score ?? '-'))}</td>`;
        leaderboardTableBody.appendChild(tr);
      });
    } catch (err) {
      console.error('loadLeaderboard failed', err);
    }
  }

  // ---------------- To-do list features ----------------
  // We assume server endpoints:
  // GET  /tasks           -> list tasks for current user
  // POST /tasks           -> { text } -> create
  // PUT  /tasks/:id       -> { text, done } -> update
  // DELETE /tasks/:id     -> delete

  // Render tasks (table body)
  function renderTasks(tasks) {
    todoTableBody.innerHTML = '';
    if (!Array.isArray(tasks) || tasks.length === 0) {
      todoTableBody.innerHTML = `<tr><td colspan="4">No tasks</td></tr>`;
      return;
    }
    tasks.forEach((task, idx) => {
      const tr = document.createElement('tr');
      tr.dataset.id = task._id;
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${escapeHtml(task.text)}</td>
        <td style="text-align:center">
          <input type="checkbox" class="task-done" ${task.done ? 'checked' : ''}/>
        </td>
        <td style="text-align:center">
          <button class="task-remove">Remove</button>
        </td>
      `;
      todoTableBody.appendChild(tr);
    });

    // attach listeners
    todoTableBody.querySelectorAll('.task-done').forEach(cb => {
      cb.addEventListener('change', async (ev) => {
        const tr = ev.target.closest('tr');
        const id = tr.dataset.id;
        const done = ev.target.checked;
        try {
          await apiFetch(`/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ done })
          });
          // optionally refresh tasks
          loadTasks();
        } catch (err) {
          console.error('Failed to update task', err);
        }
      });
    });

    todoTableBody.querySelectorAll('.task-remove').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        const tr = ev.target.closest('tr');
        const id = tr.dataset.id;
        if (!confirm('Remove this task?')) return;
        try {
          await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
          loadTasks();
        } catch (err) {
          console.error('Failed to delete task', err);
        }
      });
    });
  }

  // Add task UI: we will inject a small input + add button above the to-do table
  function injectTaskControls() {
    const todoCard = document.querySelector('.to-do');
    if (!todoCard) return;
    // Only inject once
    if (todoCard.querySelector('#task-controls')) return;

    const controls = document.createElement('div');
    controls.id = 'task-controls';
    controls.style.marginBottom = '12px';
    controls.innerHTML = `
      <input id="new-task-text" placeholder="New task" style="padding:6px; width:70%; margin-right:8px" />
      <button id="add-task-btn">Add Task</button>
    `;
    todoCard.insertBefore(controls, todoCard.firstChild);

    document.getElementById('add-task-btn').addEventListener('click', async () => {
      const textEl = document.getElementById('new-task-text');
      const text = textEl.value.trim();
      if (!text) { alert('Enter a task'); return; }
      try {
        await apiFetch('/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        textEl.value = '';
        loadTasks();
      } catch (err) {
        console.error('Failed to add task', err);
      }
    });
  }

  // Load tasks from server
  async function loadTasks() {
    try {
      const tasks = await apiFetch('/tasks');
      renderTasks(tasks);
    } catch (err) {
      console.error('loadTasks failed', err);
    }
  }

  // ---------------- Init ----------------
  async function init() {
    injectTaskControls();
    await Promise.all([
      loadProfileAndStats(),
      loadLeaderboard(),
      loadTasks()
    ]);
  }

  // start
  init().catch(err => console.error('dashboard init failed', err));
})(); */



// dashboard.js
(() => {
  const API_BASE = window.API_BASE || 'http://localhost:5000';
  const token = localStorage.getItem('token');

  // DOM refs (IDs from your HTML)
  const profilePic = document.getElementById('profile-pic');
  const welcomeText = document.getElementById('welcome-text');
  const userMeta = document.getElementById('user-meta');
  const quizzesAttemptedEl = document.getElementById('Quizzes_attempted');
  const currentStreakEl = document.getElementById('current-streak');
  const maxStreakEl = document.getElementById('max-streak');
  const accuracyEl = document.getElementById('accuracy');
  const leaderboardTableBody = document.querySelector('#leaderboard-table tbody');
  const recentQuizzesList = document.getElementById('recent-quizzes'); // we'll convert to table below
  const todoTableBody = document.querySelector('#todo-table tbody');

  function headers() {
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  }

  async function apiGet(path) {
    const res = await fetch(API_BASE + path, { headers: headers() });
    if (!res.ok) throw new Error(`${path} failed ${res.status}`);
    return res.json();
  }
  async function apiPost(path, body) {
    const res = await fetch(API_BASE + path, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${path} failed ${res.status}`);
    return res.json();
  }
  async function apiPut(path, body) {
    const res = await fetch(API_BASE + path, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${path} failed ${res.status}`);
    return res.json();
  }
  async function apiDelete(path) {
    const res = await fetch(API_BASE + path, { method: 'DELETE', headers: headers() });
    if (!res.ok) throw new Error(`${path} failed ${res.status}`);
    return res.json();
  }

  // ---------- Profile loader ----------
  async function loadProfile() {
    try {
      const profileResp = await apiGet('/profile'); // assumes you have /profile route that returns student object
      const student = profileResp; // your /profile returned student object

      profilePic.src = student.profileImage || '/images/file.jpeg';
      welcomeText.innerText = student.fullName || 'Welcome';
      userMeta.innerText = `Class: ${student.grade ?? '-'} | Username: ${student.fullName ?? '-'}`;
    } catch (err) {
      console.error('loadProfile error', err);
    }
  }

  // ---------- Recent quizzes (table) ----------
  // We'll replace the <ul id="recent-quizzes"> with a table inside its parent card
  function renderRecentQuizzesTable(quizzes) {
    // Create table inside the recent-quizzes container
    const parent = document.getElementById('recent-quizzes').parentElement; // .past div
    // Remove existing table if any
    const existing = parent.querySelector('#recent-quizzes-table');
    if (existing) existing.remove();

    const table = document.createElement('table');
    table.id = 'recent-quizzes-table';
    table.style.width = '100%';
    table.innerHTML = `
      <thead>
        <tr><th>#</th><th>Title</th><th>Score</th><th>Started</th><th>Finished</th></tr>
      </thead>
      <tbody></tbody>
    `;
    parent.appendChild(table);
    const tbody = table.querySelector('tbody');

    if (!Array.isArray(quizzes) || quizzes.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5">No recent quizzes</td></tr>`;
      return;
    }

    /* quizzes.forEach((q, i) => {
      const started = q.startedAt ? (new Date(q.startedAt)).toLocaleString() : (q.createdAt ? new Date(q.createdAt).toLocaleString() : '-');
      const finished = q.finishedAt ? (new Date(q.finishedAt)).toLocaleString() : '-';
      const score = (typeof q.score === 'number') ? (q.score + (q.total ? ` / ${q.total}` : '')) : '-';
      const title = q.title || `${q.subject || ''} ${q.chapter ? '- ' + q.chapter : ''}`.trim() || 'Quiz';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${escapeHtml(title)}</td><td>${escapeHtml(String(score))}</td><td>${escapeHtml(started)}</td><td>${escapeHtml(finished)}</td>`;
      tbody.appendChild(tr);
    }); */
     const limitedQuizzes = quizzes.slice(0, 10);

  limitedQuizzes.forEach((q, i) => {
    const started = q.startedAt
      ? new Date(q.startedAt).toLocaleString()
      : q.createdAt
      ? new Date(q.createdAt).toLocaleString()
      : '-';
    const finished = q.finishedAt
      ? new Date(q.finishedAt).toLocaleString()
      : '-';
    const score =
      typeof q.score === 'number'
        ? q.score + (q.total ? ` / ${q.total}` : '')
        : '-';
    const title =
      q.title ||
      `${q.subject || ''} ${q.chapter ? '- ' + q.chapter : ''}`.trim() ||
      'Quiz';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i + 1}</td><td>${escapeHtml(
      title
    )}</td><td>${escapeHtml(String(score))}</td><td>${escapeHtml(
      started
    )}</td><td>${escapeHtml(finished)}</td>`;
    tbody.appendChild(tr);
  });
  }

  // ---------- Compute accuracy & streaks ----------
  function computeAccuracy(quizzes) {
    if (!quizzes || quizzes.length === 0) return null;
    let sumPercent = 0, count = 0;
    quizzes.forEach(q => {
      if (typeof q.score === 'number' && typeof q.total === 'number' && q.total > 0) {
        sumPercent += (q.score / q.total) * 100;
        count++;
      }
    });
    return count ? (sumPercent / count) : null;
  }

  function computeStreaksFromQuizzes(quizzes) {
    // Build set of YYYY-MM-DD strings from createdAt (or finishedAt)
    const set = new Set();
    quizzes.forEach(q => {
      const d = q.finishedAt ? new Date(q.finishedAt) : (q.createdAt ? new Date(q.createdAt) : null);
      if (!d || isNaN(d)) return;
      set.add(d.toISOString().slice(0,10)); // YYYY-MM-DD
    });

    if (set.size === 0) return { currentStreak: 0, maxStreak: 0 };

    // current streak: consecutive days up to today
    function dateToYmd(date) {
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      return d.toISOString().slice(0,10);
    }
    let streak = 0;
    let dayPointer = new Date();
    // normalize pointer time to local midnight
    dayPointer = new Date(dayPointer.getFullYear(), dayPointer.getMonth(), dayPointer.getDate());
    while (true) {
      const key = dayPointer.toISOString().slice(0,10);
      if (set.has(key)) {
        streak++;
        dayPointer = new Date(dayPointer.getTime() - 24*60*60*1000);
      } else {
        break;
      }
    }

    // compute max streak anywhere
    const dates = Array.from(set).sort(); // asc
    let maxRun = 0, run = 0, prev = null;
    dates.forEach(s => {
      const d = new Date(s);
      if (!prev) run = 1;
      else {
        const diffDays = Math.round((d - prev) / (24*60*60*1000));
        if (diffDays === 1) run++;
        else run = 1;
      }
      if (run > maxRun) maxRun = run;
      prev = d;
    });

    return { currentStreak: streak, maxStreak: maxRun };
  }

  // ---------- Leaderboard render ----------
  function renderLeaderboard(list) {
    leaderboardTableBody.innerHTML = '';
    if (!list || !list.length) {
      leaderboardTableBody.innerHTML = '<tr><td colspan="3">No data</td></tr>';
      return;
    }
    list.forEach((r, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${escapeHtml(r.username || 'Unknown')}</td><td>${escapeHtml(String(r.score ?? 0))}</td>`;
      leaderboardTableBody.appendChild(tr);
    });
  }

  // ---------- Tasks UI ----------
  function injectTaskControls() {
    const todoCard = document.querySelector('.to-do');
    if (!todoCard) return;
    if (todoCard.querySelector('#task-controls')) return;
    const controls = document.createElement('div');
    controls.id = 'task-controls';
    controls.style.marginBottom = '12px';
    controls.innerHTML = `<input id="new-task-text" placeholder="New task" style="padding:6px; width:70%; margin-right:8px" />
      <button id="add-task-btn">Add Task</button>`;
    todoCard.insertBefore(controls, todoCard.firstChild);

    document.getElementById('add-task-btn').addEventListener('click', async () => {
      const text = document.getElementById('new-task-text').value.trim();
      if (!text) return alert('Enter a task');
      try {
        await apiPost('/api/tasks', { text });
        document.getElementById('new-task-text').value = '';
        await loadTasks();
      } catch (err) {
        console.error('add task error', err);
        alert('Failed to add task');
      }
    });
  }

  function renderTasks(tasks) {
    todoTableBody.innerHTML = '';
    if (!tasks || tasks.length === 0) {
      todoTableBody.innerHTML = '<tr><td colspan="4">No tasks</td></tr>'; return;
    }
    tasks.forEach((t, i) => {
      const tr = document.createElement('tr');
      tr.dataset.id = t._id;
      tr.innerHTML = `<td>${i+1}</td><td>${escapeHtml(t.text)}</td>
        <td style="text-align:center"><input type="checkbox" class="task-done" ${t.done ? 'checked' : ''}></td>
        <td style="text-align:center"><button class="task-remove">Remove</button></td>`;
      todoTableBody.appendChild(tr);
    });

    // listeners
    todoTableBody.querySelectorAll('.task-done').forEach(cb => {
      cb.addEventListener('change', async (ev) => {
        const tr = ev.target.closest('tr');
        const id = tr.dataset.id;
        const done = ev.target.checked;
        try {
          await apiPut(`/api/tasks/${id}`, { done });
          await loadTasks();
        } catch (err) {
          console.error('task update err', err);
        }
      });
    });

    todoTableBody.querySelectorAll('.task-remove').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        const tr = ev.target.closest('tr');
        const id = tr.dataset.id;
        if (!confirm('Remove task?')) return;
        try {
          await apiDelete(`/api/tasks/${id}`);
          await loadTasks();
        } catch (err) { console.error('task delete err', err); }
      });
    });
  }

  // ---------- Loaders ----------
  async function loadRecentQuizzes() {
    try {
      const resp = await apiGet('/api/recent-quizzes'); // returns { success, quizzes }
      const quizzes = resp.quizzes || [];
      // Update UI
      quizzesAttemptedEl.innerText = quizzes.length;
      renderRecentQuizzesTable(quizzes);

      const accuracy = computeAccuracy(quizzes);
      accuracyEl.innerText = accuracy !== null ? `${accuracy.toFixed(1)}%` : '-';

      const { currentStreak, maxStreak } = computeStreaksFromQuizzes(quizzes);
      currentStreakEl.innerText = `Current Streak 🔥 : ${currentStreak}`;
      maxStreakEl.innerText = `Max streak : ${maxStreak}`;

      // optionally persist to server: PUT /profile/streaks (if you implement)
      // await apiPut('/profile/streaks', { currentStreak, maxStreak });

    } catch (err) {
      console.error('loadRecentQuizzes err', err);
    }
  }

  async function loadLeaderboard() {
    try {
      const resp = await apiGet('/api/leaderboard'); // { success, leaderboard }
      renderLeaderboard(resp.leaderboard || []);
    } catch (err) {
      console.error('loadLeaderboard err', err);
    }
  }

  async function loadTasks() {
    try {
      const resp = await apiGet('/api/tasks'); // { success, tasks }
      renderTasks(resp.tasks);
    } catch (err) {
      console.error('loadTasks err', err);
    }
  }

  // ---------- init ----------
  async function init() {
    injectTaskControls();
    await loadProfile();
    await Promise.all([ loadRecentQuizzes(), loadLeaderboard(), loadTasks() ]);
  }

  // helpers
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('add-task-btn');
  if (!btn) return console.error('Add task button not found');
  btn.addEventListener('click', async () => {
    const text = document.getElementById('new-task-text').value.trim();
    if (!text) return alert('Enter a task');
    try {
      await apiPost('/api/tasks', { text });
      document.getElementById('new-task-text').value = '';
      await loadTasks();
    } catch (err) {
      console.error('add task error', err);
      alert('Failed to add task');
    }
  });
});

  // start
  init().catch(err => console.error('dashboard init failed', err));
})();
