// Life Hub — local-first personal hub for school, sports, health, and tasks.
(function () {
  "use strict";

  const KEY = "life-hub-v2";
  const LEGACY_KEY = "life-organizer-v1";

  const blank = {
    workouts: [], school: [], tasks: [],
    wrestling: [], baseball: [], football: [], golf: [], lifts: [], checkins: [],
    courses: [], finances: [], goals: [],
    settings: { lunchUrl: "", name: "", aiBase: "", eligGpa: 2.0 },
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return Object.assign(structuredClone(blank), JSON.parse(raw));
      // migrate from the original organizer
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const old = JSON.parse(legacy);
        const d = structuredClone(blank);
        d.workouts = (old.workouts || []).map((w) => ({ intensity: "Moderate", ...w }));
        d.school = old.school || [];
        d.tasks = old.tasks || [];
        return d;
      }
    } catch (e) { /* fall through */ }
    return structuredClone(blank);
  }

  let data = load();
  const save = () => localStorage.setItem(KEY, JSON.stringify(data));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // --- date helpers ---
  const todayISO = () => new Date().toISOString().slice(0, 10);
  function fmtDate(iso) {
    if (!iso) return "";
    return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  function daysUntil(iso) {
    return Math.round((new Date(iso + "T00:00:00") - new Date(todayISO() + "T00:00:00")) / 86400000);
  }
  function relDue(iso) {
    const d = daysUntil(iso);
    if (d < 0) return { text: `${Math.abs(d)}d overdue`, overdue: true };
    if (d === 0) return { text: "Today", overdue: false };
    if (d === 1) return { text: "Tomorrow", overdue: false };
    return { text: `in ${d}d`, overdue: false };
  }
  function mondayOf(date) {
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    d.setDate(d.getDate() + ((day === 0 ? -6 : 1) - day));
    return d;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // --- navigation ---
  document.getElementById("nav").addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item");
    if (!btn) return;
    showView(btn.dataset.view);
  });
  document.querySelector(".nav-settings").addEventListener("click", () => showView("settings"));

  document.getElementById("menu-toggle").addEventListener("click", () => document.body.classList.toggle("nav-open"));
  document.getElementById("nav-backdrop").addEventListener("click", () => document.body.classList.remove("nav-open"));

  function showView(view) {
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    const el = document.getElementById("view-" + view);
    if (el) el.classList.add("active");
    document.body.dataset.view = view;
    document.body.classList.remove("nav-open");
    if (view === "lunch") loadLunch();
  }

  // sub-tabs (sports)
  document.getElementById("sports-subtabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".subtab");
    if (!btn) return;
    document.querySelectorAll(".subtab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".subview").forEach((v) => v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("sub-" + btn.dataset.sub).classList.add("active");
  });

  // ============ FORMS ============
  // Workouts
  const wForm = document.getElementById("workout-form");
  document.getElementById("w-date").value = todayISO();
  wForm.addEventListener("submit", (e) => {
    e.preventDefault();
    data.workouts.push({
      id: uid(),
      activity: val("w-activity"), type: val("w-type"), intensity: val("w-intensity"),
      duration: int("w-duration"), date: val("w-date"), notes: val("w-notes"),
    });
    save(); wForm.reset(); document.getElementById("w-date").value = todayISO(); render();
  });

  // Daily check-in
  const cForm = document.getElementById("checkin-form");
  document.getElementById("h-date").value = todayISO();
  cForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const date = val("h-date");
    const entry = {
      id: uid(), date,
      sleep: num("h-sleep"), weight: num("h-weight"), water: num("h-water"),
      mood: val("h-mood") ? int("h-mood") : null,
    };
    // one check-in per day: replace if exists
    data.checkins = data.checkins.filter((c) => c.date !== date);
    data.checkins.push(entry);
    save(); cForm.reset(); document.getElementById("h-date").value = todayISO(); render();
  });

  // School
  const sForm = document.getElementById("school-form");
  document.getElementById("s-due").value = todayISO();
  sForm.addEventListener("submit", (e) => {
    e.preventDefault();
    data.school.push({
      id: uid(), title: val("s-title"), subject: val("s-subject"),
      type: val("s-type"), priority: val("s-priority"), due: val("s-due"), done: false,
    });
    save(); sForm.reset(); document.getElementById("s-due").value = todayISO(); render();
  });

  // Tasks
  const tForm = document.getElementById("task-form");
  tForm.addEventListener("submit", (e) => {
    e.preventDefault();
    data.tasks.push({ id: uid(), title: val("t-title"), category: val("t-category"), due: val("t-due"), done: false });
    save(); tForm.reset(); render();
  });

  // Wrestling
  const wrForm = document.getElementById("wrestling-form");
  document.getElementById("wr-date").value = todayISO();
  wrForm.addEventListener("submit", (e) => {
    e.preventDefault();
    data.wrestling.push({
      id: uid(), opponent: val("wr-opponent"), event: val("wr-event"), date: val("wr-date"),
      result: val("wr-result"), method: val("wr-method"), score: val("wr-score"), notes: val("wr-notes"),
    });
    save(); wrForm.reset(); document.getElementById("wr-date").value = todayISO(); render();
  });

  // Baseball
  const bbForm = document.getElementById("baseball-form");
  document.getElementById("bb-date").value = todayISO();
  bbForm.addEventListener("submit", (e) => {
    e.preventDefault();
    data.baseball.push({
      id: uid(), date: val("bb-date"), opponent: val("bb-opponent"),
      ab: int("bb-ab"), h: int("bb-h"), rbi: int("bb-rbi"), r: int("bb-r"), bb: int("bb-bb"), k: int("bb-k"),
    });
    save(); bbForm.reset(); document.getElementById("bb-date").value = todayISO(); render();
  });

  // Football
  const fbForm = document.getElementById("football-form");
  document.getElementById("fb-date").value = todayISO();
  fbForm.addEventListener("submit", (e) => {
    e.preventDefault();
    data.football.push({
      id: uid(), date: val("fb-date"), opponent: val("fb-opponent"), result: val("fb-result"),
      td: int("fb-td"), yards: int("fb-yards"), tackles: int("fb-tackles"), notes: val("fb-notes"),
    });
    save(); fbForm.reset(); document.getElementById("fb-date").value = todayISO(); render();
  });

  // Golf
  const gfForm = document.getElementById("golf-form");
  document.getElementById("gf-date").value = todayISO();
  gfForm.addEventListener("submit", (e) => {
    e.preventDefault();
    data.golf.push({
      id: uid(), date: val("gf-date"), course: val("gf-course"), holes: int("gf-holes") || 18,
      score: int("gf-score"), par: int("gf-par") || 0, putts: num("gf-putts"),
    });
    save(); gfForm.reset(); document.getElementById("gf-date").value = todayISO(); render();
  });

  // Courses / grades
  const cForm2 = document.getElementById("course-form");
  cForm2.addEventListener("submit", (e) => {
    e.preventDefault();
    data.courses.push({
      id: uid(), name: val("c-name").trim(),
      grade: num("c-grade") != null ? num("c-grade") : 0,
      credits: num("c-credits") || 1,
    });
    save(); cForm2.reset(); document.getElementById("c-credits").value = 1; render();
  });

  // Money — transactions
  const txnForm = document.getElementById("txn-form");
  document.getElementById("x-date").value = todayISO();
  txnForm.addEventListener("submit", (e) => {
    e.preventDefault();
    data.finances.push({
      id: uid(), date: val("x-date"), desc: val("x-desc").trim(),
      type: val("x-type"), category: val("x-cat"), amount: num("x-amount") || 0,
    });
    save(); txnForm.reset(); document.getElementById("x-date").value = todayISO(); render();
  });

  // Money — savings goals
  const goalForm = document.getElementById("goal-form");
  goalForm.addEventListener("submit", (e) => {
    e.preventDefault();
    data.goals.push({ id: uid(), name: val("g-name").trim(), target: num("g-target") || 0, saved: 0 });
    save(); goalForm.reset(); render();
  });

  // Strength / lifts
  const lfForm = document.getElementById("lift-form");
  document.getElementById("lf-date").value = todayISO();
  lfForm.addEventListener("submit", (e) => {
    e.preventDefault();
    data.lifts.push({
      id: uid(), date: val("lf-date"), exercise: val("lf-exercise").trim(),
      weight: num("lf-weight") || 0, reps: int("lf-reps") || 0, sets: int("lf-sets") || 1,
    });
    save(); lfForm.reset();
    document.getElementById("lf-date").value = todayISO();
    document.getElementById("lf-sets").value = 1;
    render();
  });

  // Settings forms
  document.getElementById("lunch-form").addEventListener("submit", (e) => {
    e.preventDefault();
    data.settings.lunchUrl = val("lunch-url").trim();
    save();
    document.getElementById("lunch-save-status").textContent = "Saved. Open the Lunch tab to see the menu.";
    if (document.body.dataset.view === "lunch") loadLunch();
  });
  document.getElementById("name-form").addEventListener("submit", (e) => {
    e.preventDefault();
    data.settings.name = val("user-name").trim();
    save(); render();
  });
  document.getElementById("ai-form").addEventListener("submit", (e) => {
    e.preventDefault();
    data.settings.aiBase = val("ai-base").trim().replace(/\/$/, "");
    save();
    document.getElementById("ai-save-status").textContent = "Saved.";
  });
  document.getElementById("elig-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const g = num("elig-gpa");
    data.settings.eligGpa = g == null ? 2.0 : g;
    save(); render();
  });

  // Export / import
  document.getElementById("export-btn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `life-hub-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  document.getElementById("import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        data = Object.assign(structuredClone(blank), JSON.parse(reader.result));
        save(); render(); alert("Data imported.");
      } catch { alert("That file could not be read."); }
    };
    reader.readAsText(file);
  });

  // shared toggle / delete
  document.querySelector(".content").addEventListener("click", (e) => {
    const del = e.target.closest(".del");
    if (del) { data[del.dataset.kind] = data[del.dataset.kind].filter((x) => x.id !== del.dataset.id); save(); render(); }
  });
  document.querySelector(".content").addEventListener("change", (e) => {
    const chk = e.target.closest(".check");
    if (chk) {
      const item = data[chk.dataset.kind].find((x) => x.id === chk.dataset.id);
      if (item) { item.done = chk.checked; save(); render(); }
    }
  });

  // input getters
  function val(id) { return document.getElementById(id).value; }
  function int(id) { return parseInt(document.getElementById(id).value, 10) || 0; }
  function num(id) { const v = parseFloat(document.getElementById(id).value); return isNaN(v) ? null : v; }

  // ============ RENDERERS ============
  function statCard(num, label) { return `<div class="stat-card"><div class="stat-num">${num}</div><div class="stat-label">${label}</div></div>`; }

  function render() {
    renderDashboard();
    renderSchool();
    renderWorkouts();
    renderHealth();
    renderWrestling();
    renderBaseball();
    renderFootball();
    renderGolf();
    renderLifts();
    renderGrades();
    renderMoney();
    renderTasks();
    fillSettings();
  }

  function fillSettings() {
    document.getElementById("lunch-url").value = data.settings.lunchUrl || "";
    document.getElementById("user-name").value = data.settings.name || "";
    document.getElementById("ai-base").value = data.settings.aiBase || "";
    document.getElementById("elig-gpa").value = data.settings.eligGpa != null ? data.settings.eligGpa : 2.0;
  }

  function renderDashboard() {
    const now = new Date();
    document.getElementById("dash-date").textContent = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    const hr = now.getHours();
    const greet = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
    document.getElementById("dash-greeting").textContent = data.settings.name ? `${greet}, ${data.settings.name}` : greet;

    const wkStart = mondayOf(now);
    const weekWorkouts = data.workouts.filter((w) => new Date(w.date + "T00:00:00") >= wkStart);
    const weekMin = weekWorkouts.reduce((s, w) => s + (w.duration || 0), 0);
    const openSchool = data.school.filter((s) => !s.done);
    const openTasks = data.tasks.filter((t) => !t.done);
    const overdue = openSchool.filter((s) => daysUntil(s.due) < 0).length;

    document.getElementById("stats").innerHTML =
      statCard(weekWorkouts.length, "Workouts this week") +
      statCard(weekMin + "<small> min</small>", "Active minutes") +
      statCard(openSchool.length, "School to-dos") +
      statCard(workoutStreak() + "<small> d</small>", "Workout streak");

    // brief
    const bits = [];
    const dueToday = openSchool.filter((s) => daysUntil(s.due) === 0);
    if (dueToday.length) bits.push(`${dueToday.length} school item${dueToday.length > 1 ? "s" : ""} due today (${dueToday.map((s) => s.title).slice(0,2).join(", ")}).`);
    if (overdue) bits.push(`${overdue} assignment${overdue > 1 ? "s are" : " is"} overdue — knock those out first.`);
    const nextDue = [...openSchool].sort((a, b) => a.due.localeCompare(b.due))[0];
    if (!dueToday.length && nextDue) bits.push(`Next up: "${nextDue.title}" ${relDue(nextDue.due).text}.`);
    if (weekWorkouts.length === 0) bits.push("No training logged this week yet — get a session in.");
    else bits.push(`You've trained ${weekWorkouts.length}× this week (${weekMin} min). Nice work.`);
    if (openTasks.length) bits.push(`${openTasks.length} open task${openTasks.length > 1 ? "s" : ""} on your list.`);
    document.getElementById("brief-text").textContent = bits.join(" ");

    fillMini("dash-school", [...openSchool].sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5),
      (s) => ({ left: s.title, right: relDue(s.due).text }), "Nothing due — you're clear.");
    fillMini("dash-workouts", [...weekWorkouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
      (w) => ({ left: w.activity, right: `${w.duration}m · ${fmtDate(w.date)}` }), "No workouts this week yet.");
    fillMini("dash-tasks", [...openTasks].sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999")).slice(0, 5),
      (t) => ({ left: t.title, right: t.due ? relDue(t.due).text : t.category }), "All clear!");

    renderDashLunch();
    renderStreaks();
  }

  function fillMini(id, items, map, emptyMsg) {
    const el = document.getElementById(id);
    el.innerHTML = items.length
      ? items.map((it) => { const m = map(it); return `<li><span>${esc(m.left)}</span><span class="meta">${esc(m.right)}</span></li>`; }).join("")
      : `<li class="empty">${emptyMsg}</li>`;
  }

  function workoutStreak() {
    const days = new Set(data.workouts.map((w) => w.date));
    let streak = 0;
    const d = new Date(); d.setHours(0, 0, 0, 0);
    // allow today to be empty without breaking streak
    if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
    while (days.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1); }
    return streak;
  }

  function streakInfo(dates) {
    const set = new Set(dates);
    // current streak (today or yesterday counts as live)
    let current = 0;
    const d = new Date(); d.setHours(0, 0, 0, 0);
    if (!set.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
    while (set.has(d.toISOString().slice(0, 10))) { current++; d.setDate(d.getDate() - 1); }
    // best streak ever
    const sorted = [...set].sort();
    let best = 0, run = 0, prev = null;
    for (const ds of sorted) {
      if (prev && Date.parse(ds) - Date.parse(prev) === 86400000) run++;
      else run = 1;
      if (run > best) best = run;
      prev = ds;
    }
    return { current, best };
  }

  function renderStreaks() {
    const w = streakInfo(data.workouts.map((x) => x.date));
    const c = streakInfo(data.checkins.map((x) => x.date));
    const tile = (icon, cur, label, best) =>
      `<div class="streak-tile"><div class="streak-icon">${icon}</div>
        <div><div class="streak-num">${cur}<small> day${cur === 1 ? "" : "s"}</small></div>
        <div class="streak-label">${label}</div><div class="streak-best">best: ${best}</div></div></div>`;
    document.getElementById("dash-streaks").innerHTML =
      tile("🔥", w.current, "Workout streak", w.best) +
      tile("✅", c.current, "Check-in streak", c.best);
  }

  function renderSchool() {
    const el = document.getElementById("school-list");
    const items = [...data.school].sort((a, b) => (a.done - b.done) || a.due.localeCompare(b.due));
    el.innerHTML = items.length ? items.map((s) => {
      const r = relDue(s.due);
      return `<div class="item ${s.done ? "done" : ""}">
        <input type="checkbox" class="check" data-kind="school" data-id="${s.id}" ${s.done ? "checked" : ""}>
        <div class="item-body"><div class="item-title">${esc(s.title)}</div>
          <div class="item-sub"><span class="badge ${s.priority}">${s.priority}</span>
          <span class="badge">${esc(s.type || "Assignment")}</span><span>${esc(s.subject)}</span>
          <span class="badge ${r.overdue && !s.done ? "overdue" : ""}">${fmtDate(s.due)} · ${r.text}</span></div></div>
        <button class="ai-breakdown ai-chip" data-id="${s.id}" title="Break this down with AI">✨</button>
        <button class="del" data-kind="school" data-id="${s.id}">×</button></div>`;
    }).join("") : `<div class="empty-state">No assignments yet. Add one above to stay on top of deadlines.</div>`;
  }

  function renderWorkouts() {
    const el = document.getElementById("workout-list");
    const items = [...data.workouts].sort((a, b) => b.date.localeCompare(a.date));
    el.innerHTML = items.length ? items.map((w) => `
      <div class="item"><div class="item-body"><div class="item-title">${esc(w.activity)}</div>
        <div class="item-sub"><span class="badge">${esc(w.type)}</span><span>${esc(w.intensity || "")}</span>
        <span>${w.duration} min</span><span>${fmtDate(w.date)}</span>${w.notes ? `<span>· ${esc(w.notes)}</span>` : ""}</div></div>
        <button class="del" data-kind="workouts" data-id="${w.id}">×</button></div>`).join("")
      : `<div class="empty-state">No workouts logged yet.</div>`;
  }

  function renderHealth() {
    const last = [...data.checkins].sort((a, b) => b.date.localeCompare(a.date))[0];
    const wkStart = mondayOf(new Date());
    const weekWorkouts = data.workouts.filter((w) => new Date(w.date + "T00:00:00") >= wkStart);
    const weekMin = weekWorkouts.reduce((s, w) => s + (w.duration || 0), 0);
    const avgSleep = avgField(data.checkins.slice(-7), "sleep");
    document.getElementById("health-stats").innerHTML =
      statCard(weekMin + "<small> min</small>", "Training this week") +
      statCard(workoutStreak() + "<small> d</small>", "Current streak") +
      statCard((avgSleep ? avgSleep.toFixed(1) : "–") + "<small> h</small>", "Avg sleep (7d)") +
      statCard(last && last.weight ? last.weight : "–", "Latest weight");
    renderVolumeChart();
  }

  function avgField(arr, f) {
    const vals = arr.map((x) => x[f]).filter((v) => typeof v === "number");
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }

  function renderVolumeChart() {
    const el = document.getElementById("volume-chart");
    const weeks = [];
    let start = mondayOf(new Date());
    for (let i = 7; i >= 0; i--) {
      const ws = new Date(start); ws.setDate(ws.getDate() - i * 7);
      const we = new Date(ws); we.setDate(we.getDate() + 7);
      const min = data.workouts
        .filter((w) => { const d = new Date(w.date + "T00:00:00"); return d >= ws && d < we; })
        .reduce((s, w) => s + (w.duration || 0), 0);
      weeks.push({ label: `${ws.getMonth() + 1}/${ws.getDate()}`, min });
    }
    const max = Math.max(60, ...weeks.map((w) => w.min));
    el.innerHTML = weeks.map((w) => `
      <div class="bar-wrap" title="${w.min} min">
        <span class="bar-val">${w.min || ""}</span>
        <div class="bar" style="height:${(w.min / max) * 100}%"></div>
        <span class="bar-label">${w.label}</span>
      </div>`).join("");
  }

  function renderWrestling() {
    const items = [...data.wrestling].sort((a, b) => b.date.localeCompare(a.date));
    const wins = items.filter((m) => m.result === "Win").length;
    const losses = items.length - wins;
    const pins = items.filter((m) => m.method === "Pin").length;
    document.getElementById("wrestling-stats").innerHTML =
      statCard(`${wins}<small>-${losses}</small>`, "Record") +
      statCard(items.length ? Math.round((wins / items.length) * 100) + "<small>%</small>" : "–", "Win rate") +
      statCard(pins, "Pins");
    const el = document.getElementById("wrestling-list");
    el.innerHTML = items.length ? items.map((m) => `
      <div class="item ${m.result.toLowerCase()}"><div class="item-body">
        <div class="item-title">vs ${esc(m.opponent)} ${m.score ? `· ${esc(m.score)}` : ""}</div>
        <div class="item-sub"><span class="badge ${m.result.toLowerCase()}">${m.result}</span>
        <span class="badge">${esc(m.method)}</span>${m.event ? `<span>${esc(m.event)}</span>` : ""}
        <span>${fmtDate(m.date)}</span>${m.notes ? `<span>· ${esc(m.notes)}</span>` : ""}</div></div>
        <button class="del" data-kind="wrestling" data-id="${m.id}">×</button></div>`).join("")
      : `<div class="empty-state">No matches logged yet.</div>`;
  }

  function renderBaseball() {
    const items = [...data.baseball].sort((a, b) => b.date.localeCompare(a.date));
    const sum = (f) => items.reduce((s, g) => s + (g[f] || 0), 0);
    const ab = sum("ab"), h = sum("h"), bb = sum("bb");
    const avg = ab ? (h / ab) : 0;
    const obp = (ab + bb) ? (h + bb) / (ab + bb) : 0;
    document.getElementById("baseball-stats").innerHTML =
      statCard(ab ? avg.toFixed(3).replace(/^0/, "") : "–", "Batting avg") +
      statCard(ab ? obp.toFixed(3).replace(/^0/, "") : "–", "On-base %") +
      statCard(h, "Hits") +
      statCard(sum("rbi"), "RBI");
    const el = document.getElementById("baseball-list");
    el.innerHTML = items.length ? items.map((g) => `
      <div class="item"><div class="item-body">
        <div class="item-title">${fmtDate(g.date)}${g.opponent ? ` vs ${esc(g.opponent)}` : ""}</div>
        <div class="item-sub"><span>${g.h}-${g.ab}</span><span>${g.rbi} RBI</span><span>${g.r} R</span>
        <span>${g.bb} BB</span><span>${g.k} K</span></div></div>
        <button class="del" data-kind="baseball" data-id="${g.id}">×</button></div>`).join("")
      : `<div class="empty-state">No games logged yet.</div>`;
  }

  function renderFootball() {
    const items = [...data.football].sort((a, b) => b.date.localeCompare(a.date));
    const sum = (f) => items.reduce((s, g) => s + (g[f] || 0), 0);
    const wins = items.filter((g) => g.result === "Win").length;
    const losses = items.filter((g) => g.result === "Loss").length;
    document.getElementById("football-stats").innerHTML =
      statCard(`${wins}<small>-${losses}</small>`, "Record") +
      statCard(sum("td"), "Touchdowns") +
      statCard(sum("yards"), "Total yards") +
      statCard(sum("tackles"), "Tackles");
    const el = document.getElementById("football-list");
    el.innerHTML = items.length ? items.map((g) => `
      <div class="item ${g.result ? g.result.toLowerCase() : ""}"><div class="item-body">
        <div class="item-title">${fmtDate(g.date)}${g.opponent ? ` vs ${esc(g.opponent)}` : ""}</div>
        <div class="item-sub"><span class="badge ${g.result === "Win" ? "win" : g.result === "Loss" ? "loss" : ""}">${esc(g.result || "")}</span>
        ${g.td ? `<span>${g.td} TD</span>` : ""}${g.yards ? `<span>${g.yards} yds</span>` : ""}${g.tackles ? `<span>${g.tackles} tackles</span>` : ""}
        ${g.notes ? `<span>· ${esc(g.notes)}</span>` : ""}</div></div>
        <button class="del" data-kind="football" data-id="${g.id}">×</button></div>`).join("")
      : `<div class="empty-state">No football games logged yet.</div>`;
  }

  function renderGolf() {
    const items = [...data.golf].sort((a, b) => b.date.localeCompare(a.date));
    const scored = items.filter((r) => r.score);
    const best = scored.length ? Math.min(...scored.map((r) => r.score)) : null;
    const avg = scored.length ? scored.reduce((s, r) => s + r.score, 0) / scored.length : null;
    const toPar = scored.filter((r) => r.par);
    const avgPar = toPar.length ? toPar.reduce((s, r) => s + (r.score - r.par), 0) / toPar.length : null;
    const fmtPar = (v) => (v == null ? "–" : v === 0 ? "E" : v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`);
    document.getElementById("golf-stats").innerHTML =
      statCard(items.length, "Rounds") +
      statCard(best != null ? best : "–", "Best score") +
      statCard(avg != null ? avg.toFixed(1) : "–", "Avg score") +
      statCard(fmtPar(avgPar), "Avg vs par");
    const el = document.getElementById("golf-list");
    el.innerHTML = items.length ? items.map((r) => {
      const tp = r.par ? r.score - r.par : null;
      return `<div class="item"><div class="item-body">
        <div class="item-title">${esc(r.course || "Round")} · ${fmtDate(r.date)}</div>
        <div class="item-sub"><span class="badge">${r.holes} holes</span>
        ${r.score ? `<span>${r.score} strokes</span>` : ""}${tp != null ? `<span>${fmtPar(tp)}</span>` : ""}
        ${r.putts != null ? `<span>${r.putts} putts</span>` : ""}</div></div>
        <button class="del" data-kind="golf" data-id="${r.id}">×</button></div>`;
    }).join("") : `<div class="empty-state">No rounds logged yet.</div>`;
  }

  function renderLifts() {
    const items = [...data.lifts].sort((a, b) => b.date.localeCompare(a.date));
    // personal records per exercise
    const byEx = {};
    data.lifts.forEach((l) => {
      const key = l.exercise.toLowerCase();
      const oneRm = l.weight * (1 + (l.reps || 0) / 30); // Epley estimate
      if (!byEx[key]) byEx[key] = { name: l.exercise, maxWeight: 0, bestSet: null, oneRm: 0 };
      const e = byEx[key];
      if (l.weight > e.maxWeight) { e.maxWeight = l.weight; e.bestSet = l; e.name = l.exercise; }
      if (oneRm > e.oneRm) e.oneRm = oneRm;
    });
    const prs = Object.values(byEx).sort((a, b) => b.oneRm - a.oneRm);
    const prEl = document.getElementById("lift-prs");
    prEl.innerHTML = prs.length ? prs.map((e) => `
      <div class="pr-card">
        <div class="pr-name">${esc(e.name)}</div>
        <div class="pr-val">${trimNum(e.maxWeight)}<small> lb × ${e.bestSet.reps}</small></div>
        <div class="pr-sub">est. 1RM ${trimNum(Math.round(e.oneRm))} lb</div>
      </div>`).join("") : `<div class="empty-state">Log a lift to start tracking PRs.</div>`;

    const el = document.getElementById("lift-list");
    el.innerHTML = items.length ? items.map((l) => `
      <div class="item"><div class="item-body">
        <div class="item-title">${esc(l.exercise)}</div>
        <div class="item-sub"><span class="badge">${trimNum(l.weight)} lb</span>
        <span>${l.sets}×${l.reps}</span><span>${fmtDate(l.date)}</span></div></div>
        <button class="del" data-kind="lifts" data-id="${l.id}">×</button></div>`).join("")
      : `<div class="empty-state">No lifts logged yet.</div>`;
  }

  const trimNum = (n) => (Math.round(n * 10) / 10).toString().replace(/\.0$/, "");

  function renderTasks() {
    const el = document.getElementById("task-list");
    const items = [...data.tasks].sort((a, b) => (a.done - b.done) || (a.due || "9999").localeCompare(b.due || "9999"));
    el.innerHTML = items.length ? items.map((t) => {
      const r = t.due ? relDue(t.due) : null;
      return `<div class="item ${t.done ? "done" : ""}">
        <input type="checkbox" class="check" data-kind="tasks" data-id="${t.id}" ${t.done ? "checked" : ""}>
        <div class="item-body"><div class="item-title">${esc(t.title)}</div>
          <div class="item-sub"><span class="badge">${esc(t.category)}</span>
          ${r ? `<span class="badge ${r.overdue && !t.done ? "overdue" : ""}">${fmtDate(t.due)} · ${r.text}</span>` : ""}</div></div>
        <button class="del" data-kind="tasks" data-id="${t.id}">×</button></div>`;
    }).join("") : `<div class="empty-state">No tasks yet. Add something you need to get done.</div>`;
  }

  // ============ MONEY ============
  const money = (n) => "$" + (Math.round(n * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });

  function renderMoney() {
    const txns = data.finances;
    const income = txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;
    const ym = todayISO().slice(0, 7);
    const monthIn = txns.filter((t) => t.type === "income" && t.date.startsWith(ym)).reduce((s, t) => s + t.amount, 0);
    const monthOut = txns.filter((t) => t.type === "expense" && t.date.startsWith(ym)).reduce((s, t) => s + t.amount, 0);
    const saved = data.goals.reduce((s, g) => s + (g.saved || 0), 0);

    document.getElementById("money-stats").innerHTML =
      statCard(money(balance), "Balance") +
      statCard(money(monthIn), "In this month") +
      statCard(money(monthOut), "Out this month") +
      statCard(money(saved), "Saved in goals");

    const gEl = document.getElementById("goal-list");
    gEl.innerHTML = data.goals.length ? data.goals.map((g) => {
      const pct = g.target ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
      return `<div class="goal">
        <div class="goal-top">
          <span class="goal-name">${esc(g.name)}</span>
          <span class="goal-amt">${money(g.saved)} <small>/ ${money(g.target)}</small></span>
        </div>
        <div class="goal-bar"><div class="goal-fill" style="width:${pct}%"></div></div>
        <div class="goal-actions">
          <span class="goal-pct">${pct}%</span>
          <button class="goal-add" data-id="${g.id}">+ Add money</button>
          <button class="del" data-kind="goals" data-id="${g.id}">×</button>
        </div>
      </div>`;
    }).join("") : `<div class="empty-state">No goals yet. Add one to start saving toward something.</div>`;

    const tEl = document.getElementById("txn-list");
    const items = [...txns].sort((a, b) => b.date.localeCompare(a.date));
    tEl.innerHTML = items.length ? items.map((t) => `
      <div class="item"><div class="item-body">
        <div class="item-title">${esc(t.desc)}</div>
        <div class="item-sub"><span class="badge">${esc(t.category)}</span><span>${fmtDate(t.date)}</span></div></div>
        <span class="txn-amt ${t.type}">${t.type === "income" ? "+" : "−"}${money(t.amount)}</span>
        <button class="del" data-kind="finances" data-id="${t.id}">×</button></div>`).join("")
      : `<div class="empty-state">No transactions yet. Log your job, allowance, or spending.</div>`;
  }

  // contribute to a savings goal
  document.querySelector(".content").addEventListener("click", (e) => {
    const btn = e.target.closest(".goal-add");
    if (!btn) return;
    const g = data.goals.find((x) => x.id === btn.dataset.id);
    if (!g) return;
    const input = prompt(`Add to "${g.name}" (use a negative number to remove):`, "");
    if (input == null) return;
    const amt = parseFloat(input);
    if (isNaN(amt)) return;
    g.saved = Math.max(0, (g.saved || 0) + amt);
    save(); render();
  });

  // ============ GRADES ============
  function gradePoint(pct) {
    if (pct >= 93) return 4.0; if (pct >= 90) return 3.7;
    if (pct >= 87) return 3.3; if (pct >= 83) return 3.0; if (pct >= 80) return 2.7;
    if (pct >= 77) return 2.3; if (pct >= 73) return 2.0; if (pct >= 70) return 1.7;
    if (pct >= 67) return 1.3; if (pct >= 63) return 1.0; if (pct >= 60) return 0.7;
    return 0.0;
  }
  function letterFor(pct) {
    const map = [[93,"A"],[90,"A-"],[87,"B+"],[83,"B"],[80,"B-"],[77,"C+"],[73,"C"],[70,"C-"],[67,"D+"],[63,"D"],[60,"D-"]];
    for (const [min, l] of map) if (pct >= min) return l;
    return "F";
  }

  function renderGrades() {
    const courses = data.courses;
    const totalCredits = courses.reduce((s, c) => s + (c.credits || 1), 0);
    const gpa = totalCredits ? courses.reduce((s, c) => s + gradePoint(c.grade) * (c.credits || 1), 0) / totalCredits : null;
    const lowest = courses.length ? Math.min(...courses.map((c) => c.grade)) : null;
    const failing = courses.filter((c) => c.grade < 60);
    const threshold = data.settings.eligGpa != null ? data.settings.eligGpa : 2.0;

    document.getElementById("grade-stats").innerHTML =
      statCard(gpa != null ? gpa.toFixed(2) : "–", "GPA (unweighted)") +
      statCard(courses.length, "Classes") +
      statCard(lowest != null ? lowest + "<small>%</small>" : "–", "Lowest class") +
      statCard(trimNum(totalCredits), "Credits");

    const eligEl = document.getElementById("elig-card");
    const eligContent = document.getElementById("elig-content");
    if (!courses.length) {
      eligEl.className = "card elig";
      eligContent.innerHTML = `<div class="elig-status">Add your classes to check eligibility.</div>`;
    } else {
      const okGpa = gpa >= threshold;
      const eligible = okGpa && failing.length === 0;
      eligEl.className = "card elig " + (eligible ? "ok" : "risk");
      const reasons = [];
      if (!okGpa) reasons.push(`GPA ${gpa.toFixed(2)} is below the ${threshold} minimum`);
      if (failing.length) reasons.push(`failing ${failing.length} class${failing.length > 1 ? "es" : ""} (${failing.map((c) => esc(c.name)).join(", ")})`);
      eligContent.innerHTML = `
        <div class="elig-status">${eligible ? "✅ Eligible to play" : "⚠️ At risk"}</div>
        <div class="elig-sub">${eligible ? `GPA ${gpa.toFixed(2)} — above the ${threshold} minimum, no failing classes.` : "You're " + reasons.join(" and ") + "."}</div>`;
    }

    const el = document.getElementById("course-list");
    const items = [...courses].sort((a, b) => a.grade - b.grade);
    el.innerHTML = items.length ? items.map((c) => `
      <div class="item"><div class="item-body">
        <div class="item-title">${esc(c.name)}</div>
        <div class="item-sub"><span class="badge ${c.grade < 60 ? "high" : c.grade < 73 ? "medium" : "low"}">${letterFor(c.grade)}</span>
        <span>${trimNum(c.grade)}%</span><span>${trimNum(c.credits || 1)} cr</span></div></div>
        <button class="del" data-kind="courses" data-id="${c.id}">×</button></div>`).join("")
      : `<div class="empty-state">No classes yet. Add them to track your GPA.</div>`;
  }

  // ============ LUNCH ============
  // Avon Lake City Schools uses Health-e Pro. We embed the live menu directly.
  const DEFAULT_LUNCH_URL = "https://menus.healthepro.com/organizations/79/sites/640/menus/100481?calendarView=month&date=2026-05-01#today";

  function lunchUrl() { return data.settings.lunchUrl || DEFAULT_LUNCH_URL; }

  // Point the menu at the current month and jump to today.
  function buildMenuUrl(raw) {
    try {
      const u = new URL(raw);
      if (u.hostname.includes("healthepro.com")) {
        const now = new Date();
        const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        u.searchParams.set("calendarView", "month");
        u.searchParams.set("date", first);
        u.hash = "today";
        return u.toString();
      }
      return raw;
    } catch { return raw; }
  }

  function loadLunch() {
    const el = document.getElementById("lunch-content");
    const url = buildMenuUrl(lunchUrl());
    el.innerHTML = `
      <div class="lunch-bar">
        <span class="hint">This month's menu, live from your school. If the box is blank, tap "Open full menu".</span>
        <a class="ai-btn" href="${esc(url)}" target="_blank" rel="noopener">Open full menu ↗</a>
      </div>
      <iframe class="lunch-frame" src="${esc(url)}" title="School lunch menu" loading="lazy"></iframe>`;
  }

  function renderDashLunch() {
    const el = document.getElementById("dash-lunch");
    el.innerHTML = `<a href="${esc(buildMenuUrl(lunchUrl()))}" target="_blank" rel="noopener" class="lunch-link">View this week's menu ↗</a>`;
  }

  // ============ AI COACH ============
  async function aiCall(kind, payload) {
    const base = data.settings.aiBase || "";
    const res = await fetch(`${base}/api/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, payload }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status}).`);
    return json.text || "";
  }

  function aiErrorText(e) {
    const msg = (e && e.message) || "Something went wrong.";
    if (/Failed to fetch|NetworkError|404/i.test(msg)) {
      return "Couldn't reach the AI backend. If you're on GitHub Pages, deploy the app to Vercel and paste its URL in Settings → AI coach connection. (See the setup steps.)";
    }
    return msg;
  }

  // snapshot helpers for prompts
  function briefPayload() {
    const wkStart = mondayOf(new Date());
    const weekWorkouts = data.workouts.filter((w) => new Date(w.date + "T00:00:00") >= wkStart);
    return {
      date: todayISO(),
      name: data.settings.name || null,
      school: data.school.filter((s) => !s.done).map((s) => ({ title: s.title, subject: s.subject, type: s.type, due: s.due, priority: s.priority })),
      workoutsThisWeek: weekWorkouts.length,
      minutesThisWeek: weekWorkouts.reduce((s, w) => s + (w.duration || 0), 0),
      workoutStreak: workoutStreak(),
      openTasks: data.tasks.filter((t) => !t.done).map((t) => ({ title: t.title, category: t.category, due: t.due })),
    };
  }
  function insightsPayload() {
    return {
      recentWorkouts: data.workouts.slice(-14),
      checkins: data.checkins.slice(-14),
      wrestling: data.wrestling.slice(-10),
      baseball: data.baseball.slice(-10),
      football: data.football.slice(-10),
      golf: data.golf.slice(-10),
      lifts: data.lifts.slice(-20),
      openSchool: data.school.filter((s) => !s.done),
    };
  }

  // Modal
  const modal = document.getElementById("modal");
  function openModal(title, html) {
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-content").innerHTML = html;
    modal.hidden = false;
  }
  function closeModal() { modal.hidden = true; }
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-backdrop").addEventListener("click", closeModal);

  // Daily AI brief
  document.getElementById("brief-ai").addEventListener("click", async () => {
    const el = document.getElementById("brief-text");
    const btn = document.getElementById("brief-ai");
    btn.disabled = true;
    const original = el.textContent;
    el.textContent = "Thinking…";
    try {
      el.textContent = await aiCall("brief", briefPayload());
    } catch (e) {
      el.textContent = original;
      openModal("AI brief", esc(aiErrorText(e)));
    } finally {
      btn.disabled = false;
    }
  });

  // Ask the coach
  document.getElementById("coach-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = val("coach-q").trim();
    if (!q) return;
    const out = document.getElementById("coach-answer");
    out.textContent = "Thinking…";
    try {
      out.textContent = await aiCall("coach", { question: q, context: briefPayload() });
    } catch (err) {
      out.textContent = aiErrorText(err);
    }
  });

  // Break down a school item (delegated)
  document.querySelector(".content").addEventListener("click", async (e) => {
    const btn = e.target.closest(".ai-breakdown");
    if (!btn) return;
    const item = data.school.find((s) => s.id === btn.dataset.id);
    if (!item) return;
    openModal(item.title, "Thinking…");
    try {
      const text = await aiCall("breakdown", { title: item.title, subject: item.subject, type: item.type, due: item.due });
      openModal(item.title, esc(text));
    } catch (err) {
      openModal(item.title, esc(aiErrorText(err)));
    }
  });

  document.body.dataset.view = "dashboard";
  render();
})();
