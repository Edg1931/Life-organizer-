// Life Organizer — local-first tracker for workouts, school, and tasks.
(function () {
  "use strict";

  const STORE_KEY = "life-organizer-v1";

  const defaultData = { workouts: [], school: [], tasks: [] };

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return structuredClone(defaultData);
      const parsed = JSON.parse(raw);
      return {
        workouts: parsed.workouts || [],
        school: parsed.school || [],
        tasks: parsed.tasks || [],
      };
    } catch (e) {
      return structuredClone(defaultData);
    }
  }

  let data = load();

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // --- Date helpers ---
  function todayISO() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }
  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  function daysUntil(iso) {
    const due = new Date(iso + "T00:00:00");
    const now = new Date(todayISO() + "T00:00:00");
    return Math.round((due - now) / 86400000);
  }
  function relativeDue(iso) {
    const d = daysUntil(iso);
    if (d < 0) return { text: `${Math.abs(d)}d overdue`, overdue: true };
    if (d === 0) return { text: "Today", overdue: false };
    if (d === 1) return { text: "Tomorrow", overdue: false };
    return { text: `in ${d}d`, overdue: false };
  }
  function startOfWeek() {
    const d = new Date(todayISO() + "T00:00:00");
    const day = d.getDay(); // 0 = Sun
    const diff = (day === 0 ? -6 : 1) - day; // Monday start
    d.setDate(d.getDate() + diff);
    return d;
  }

  // --- Tab navigation ---
  document.getElementById("tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("view-" + btn.dataset.view).classList.add("active");
  });

  // --- Workouts ---
  const workoutForm = document.getElementById("workout-form");
  document.getElementById("w-date").value = todayISO();
  workoutForm.addEventListener("submit", (e) => {
    e.preventDefault();
    data.workouts.push({
      id: uid(),
      activity: document.getElementById("w-activity").value.trim(),
      type: document.getElementById("w-type").value,
      duration: parseInt(document.getElementById("w-duration").value, 10) || 0,
      date: document.getElementById("w-date").value,
      notes: document.getElementById("w-notes").value.trim(),
    });
    save();
    workoutForm.reset();
    document.getElementById("w-date").value = todayISO();
    render();
  });

  function renderWorkouts() {
    const el = document.getElementById("workout-list");
    const items = [...data.workouts].sort((a, b) => b.date.localeCompare(a.date));
    if (!items.length) {
      el.innerHTML = `<div class="empty-state">No workouts logged yet. Add your first session above.</div>`;
      return;
    }
    el.innerHTML = items
      .map(
        (w) => `
      <div class="item">
        <div class="item-body">
          <div class="item-title">${esc(w.activity)}</div>
          <div class="item-sub">
            <span class="badge">${esc(w.type)}</span>
            <span>${w.duration} min</span>
            <span>${fmtDate(w.date)}</span>
            ${w.notes ? `<span>· ${esc(w.notes)}</span>` : ""}
          </div>
        </div>
        <button class="del" data-kind="workouts" data-id="${w.id}" title="Delete">×</button>
      </div>`
      )
      .join("");
  }

  // --- School ---
  const schoolForm = document.getElementById("school-form");
  document.getElementById("s-due").value = todayISO();
  schoolForm.addEventListener("submit", (e) => {
    e.preventDefault();
    data.school.push({
      id: uid(),
      title: document.getElementById("s-title").value.trim(),
      subject: document.getElementById("s-subject").value.trim(),
      priority: document.getElementById("s-priority").value,
      due: document.getElementById("s-due").value,
      done: false,
    });
    save();
    schoolForm.reset();
    document.getElementById("s-due").value = todayISO();
    render();
  });

  function renderSchool() {
    const el = document.getElementById("school-list");
    const items = [...data.school].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.due.localeCompare(b.due);
    });
    if (!items.length) {
      el.innerHTML = `<div class="empty-state">No assignments yet. Add one to stay on top of deadlines.</div>`;
      return;
    }
    el.innerHTML = items
      .map((s) => {
        const rel = relativeDue(s.due);
        return `
      <div class="item ${s.done ? "done" : ""}">
        <input type="checkbox" class="check" data-kind="school" data-id="${s.id}" ${s.done ? "checked" : ""}>
        <div class="item-body">
          <div class="item-title">${esc(s.title)}</div>
          <div class="item-sub">
            <span class="badge ${s.priority}">${s.priority}</span>
            <span>${esc(s.subject)}</span>
            <span class="badge ${rel.overdue && !s.done ? "overdue" : ""}">${fmtDate(s.due)} · ${rel.text}</span>
          </div>
        </div>
        <button class="del" data-kind="school" data-id="${s.id}" title="Delete">×</button>
      </div>`;
      })
      .join("");
  }

  // --- Tasks ---
  const taskForm = document.getElementById("task-form");
  taskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    data.tasks.push({
      id: uid(),
      title: document.getElementById("t-title").value.trim(),
      category: document.getElementById("t-category").value,
      due: document.getElementById("t-due").value || "",
      done: false,
    });
    save();
    taskForm.reset();
    render();
  });

  function renderTasks() {
    const el = document.getElementById("task-list");
    const items = [...data.tasks].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (a.due || "9999").localeCompare(b.due || "9999");
    });
    if (!items.length) {
      el.innerHTML = `<div class="empty-state">No tasks yet. Add something you need to get done.</div>`;
      return;
    }
    el.innerHTML = items
      .map((t) => {
        const rel = t.due ? relativeDue(t.due) : null;
        return `
      <div class="item ${t.done ? "done" : ""}">
        <input type="checkbox" class="check" data-kind="tasks" data-id="${t.id}" ${t.done ? "checked" : ""}>
        <div class="item-body">
          <div class="item-title">${esc(t.title)}</div>
          <div class="item-sub">
            <span class="badge">${esc(t.category)}</span>
            ${rel ? `<span class="badge ${rel.overdue && !t.done ? "overdue" : ""}">${fmtDate(t.due)} · ${rel.text}</span>` : ""}
          </div>
        </div>
        <button class="del" data-kind="tasks" data-id="${t.id}" title="Delete">×</button>
      </div>`;
      })
      .join("");
  }

  // --- Dashboard ---
  function renderDashboard() {
    const weekStart = startOfWeek();
    const weekWorkouts = data.workouts.filter((w) => new Date(w.date + "T00:00:00") >= weekStart);
    const weekMinutes = weekWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0);
    const openSchool = data.school.filter((s) => !s.done);
    const openTasks = data.tasks.filter((t) => !t.done);

    document.getElementById("stats").innerHTML = `
      <div class="stat-card"><div class="stat-num">${weekWorkouts.length}</div><div class="stat-label">Workouts this week</div></div>
      <div class="stat-card"><div class="stat-num">${weekMinutes}</div><div class="stat-label">Active minutes</div></div>
      <div class="stat-card"><div class="stat-num">${openSchool.length}</div><div class="stat-label">School to-dos</div></div>
      <div class="stat-card"><div class="stat-num">${openTasks.length}</div><div class="stat-label">Open tasks</div></div>
    `;

    const schoolEl = document.getElementById("dash-school");
    const upcomingSchool = [...openSchool].sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5);
    schoolEl.innerHTML = upcomingSchool.length
      ? upcomingSchool
          .map((s) => {
            const rel = relativeDue(s.due);
            return `<li><span>${esc(s.title)}</span><span class="meta ${rel.overdue ? "" : ""}">${rel.text}</span></li>`;
          })
          .join("")
      : `<li class="empty">Nothing due. </li>`;

    const wEl = document.getElementById("dash-workouts");
    const recent = [...weekWorkouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    wEl.innerHTML = recent.length
      ? recent.map((w) => `<li><span>${esc(w.activity)}</span><span class="meta">${w.duration}m · ${fmtDate(w.date)}</span></li>`).join("")
      : `<li class="empty">No workouts this week yet.</li>`;

    const tEl = document.getElementById("dash-tasks");
    const tasks = [...openTasks].sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999")).slice(0, 5);
    tEl.innerHTML = tasks.length
      ? tasks.map((t) => `<li><span>${esc(t.title)}</span><span class="meta">${t.due ? relativeDue(t.due).text : t.category}</span></li>`).join("")
      : `<li class="empty">All clear!</li>`;
  }

  // --- Shared events (toggle / delete) ---
  document.querySelector("main").addEventListener("click", (e) => {
    const del = e.target.closest(".del");
    if (del) {
      const { kind, id } = del.dataset;
      data[kind] = data[kind].filter((x) => x.id !== id);
      save();
      render();
    }
  });

  document.querySelector("main").addEventListener("change", (e) => {
    const chk = e.target.closest(".check");
    if (chk) {
      const { kind, id } = chk.dataset;
      const item = data[kind].find((x) => x.id === id);
      if (item) {
        item.done = chk.checked;
        save();
        render();
      }
    }
  });

  function esc(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function render() {
    renderDashboard();
    renderWorkouts();
    renderSchool();
    renderTasks();
  }

  render();
})();
