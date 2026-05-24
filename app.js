// Life Hub — local-first personal hub for school, sports, health, and tasks.
(function () {
  "use strict";

  const KEY = "life-hub-v2";
  const LEGACY_KEY = "life-organizer-v1";

  const blank = {
    workouts: [], school: [], tasks: [],
    wrestling: [], baseball: [], football: [], golf: [], lifts: [], checkins: [],
    courses: [], finances: [], goals: [], templates: [], foods: [], events: [], decks: [],
    track: [], analyses: [],
    settings: { lunchUrl: "", name: "", aiBase: "", eligGpa: 2.0, calorieGoal: 2400, matchWeight: null, nextEvent: { name: "", date: "" } },
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
  const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  function fmtTime(t) {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const ap = h >= 12 ? "PM" : "AM";
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ap}`;
  }
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

  // Nutrition — food log
  const COMMON_FOODS = [
    { name: "Banana", cal: 105, p: 1, c: 27, f: 0 },
    { name: "Chicken breast (6oz)", cal: 280, p: 52, c: 0, f: 6 },
    { name: "White rice (1 cup)", cal: 205, p: 4, c: 45, f: 0 },
    { name: "Greek yogurt", cal: 150, p: 15, c: 8, f: 4 },
    { name: "PB&J sandwich", cal: 350, p: 14, c: 40, f: 16 },
    { name: "Protein shake", cal: 160, p: 30, c: 5, f: 2 },
    { name: "2 eggs", cal: 140, p: 12, c: 1, f: 10 },
    { name: "Apple", cal: 95, p: 0, c: 25, f: 0 },
    { name: "Granola bar", cal: 190, p: 4, c: 29, f: 7 },
    { name: "Turkey sandwich", cal: 320, p: 24, c: 35, f: 9 },
    { name: "Chocolate milk (cup)", cal: 190, p: 8, c: 26, f: 6 },
    { name: "Pasta (1 cup)", cal: 220, p: 8, c: 43, f: 1 },
  ];

  const foodForm = document.getElementById("food-form");
  document.getElementById("f-date").value = todayISO();
  foodForm.addEventListener("submit", (e) => {
    e.preventDefault();
    data.foods.push({
      id: uid(), date: val("f-date"), name: val("f-name").trim(),
      cal: int("f-cal"), p: int("f-p"), c: int("f-c"), f: int("f-f"), meal: val("f-meal"),
    });
    save(); foodForm.reset(); document.getElementById("f-date").value = todayISO(); render();
  });

  document.getElementById("quick-add").addEventListener("click", (e) => {
    const b = e.target.closest(".qa-chip");
    if (!b) return;
    const f = COMMON_FOODS[+b.dataset.i];
    data.foods.push({ id: uid(), date: todayISO(), name: f.name, cal: f.cal, p: f.p, c: f.c, f: f.f, meal: "Snack" });
    save(); render();
  });

  function renderQuickAdd() {
    document.getElementById("quick-add").innerHTML =
      `<span class="qa-label">Quick add:</span>` +
      COMMON_FOODS.map((f, i) => `<button class="qa-chip" data-i="${i}" type="button">${esc(f.name)} <small>${f.cal}</small></button>`).join("");
  }
  renderQuickAdd();

  // Calendar
  let calMonth = new Date(); calMonth.setDate(1); calMonth.setHours(0, 0, 0, 0);
  let calSelected = isoLocal(new Date());

  document.getElementById("event-form").addEventListener("submit", (e) => {
    e.preventDefault();
    data.events.push({ id: uid(), title: val("e-title").trim(), date: val("e-date"), time: val("e-time"), type: val("e-type"), repeat: val("e-repeat") });
    save(); e.target.reset(); document.getElementById("e-date").value = calSelected; render();
  });
  document.getElementById("cal-prev").addEventListener("click", () => { calMonth.setMonth(calMonth.getMonth() - 1); renderCalendar(); });
  document.getElementById("cal-next").addEventListener("click", () => { calMonth.setMonth(calMonth.getMonth() + 1); renderCalendar(); });
  document.getElementById("cal-today").addEventListener("click", () => { calMonth = new Date(); calMonth.setDate(1); calMonth.setHours(0, 0, 0, 0); calSelected = isoLocal(new Date()); renderCalendar(); });
  document.getElementById("cal-grid").addEventListener("click", (e) => {
    const cell = e.target.closest(".cal-cell[data-date]");
    if (!cell) return;
    calSelected = cell.dataset.date;
    renderCalendar();
  });

  // Game week — adds a Game event to the calendar (they stay in sync)
  document.getElementById("gw-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const date = val("gw-date");
    if (!date) return;
    data.events.push({ id: uid(), title: val("gw-name").trim() || "Game", date, time: "", type: "Game", repeat: "none" });
    save(); e.target.reset(); render();
  });

  // Strength / lifts
  const lfForm = document.getElementById("lift-form");
  document.getElementById("lf-date").value = todayISO();
  lfForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const exercise = val("lf-exercise").trim();
    const weight = num("lf-weight") || 0;
    const reps = int("lf-reps") || 0;
    const key = exercise.toLowerCase();
    const prevBest = data.lifts.filter((l) => l.exercise.toLowerCase() === key)
      .reduce((m, l) => Math.max(m, l.weight), 0);
    data.lifts.push({ id: uid(), date: val("lf-date"), exercise, weight, reps, sets: int("lf-sets") || 1 });
    save(); lfForm.reset();
    document.getElementById("lf-date").value = todayISO();
    document.getElementById("lf-sets").value = 1;
    render();
    if (weight > prevBest && prevBest > 0) {
      openModal("New personal best! 🎉", esc(`${exercise}: ${trimNum(weight)} lb × ${reps}\n\nThat beats your old best of ${trimNum(prevBest)} lb. Keep stacking PRs.`));
    }
  });

  document.getElementById("lift-pick").addEventListener("change", (e) => { liftPick = e.target.value; renderLiftChart(); });

  document.getElementById("health-ai").addEventListener("click", async () => {
    const out = document.getElementById("health-ai-out");
    const btn = document.getElementById("health-ai");
    btn.disabled = true; out.textContent = "Thinking…";
    try { out.textContent = await aiCall("insights", insightsPayload()); }
    catch (err) { out.textContent = aiErrorText(err); }
    finally { btn.disabled = false; }
  });

  // AI workout generator
  document.getElementById("gen-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const req = val("gen-req").trim();
    const out = document.getElementById("gen-out");
    out.textContent = "Building your workout…";
    try {
      out.textContent = await aiCall("workout", { request: req, context: { recentWorkouts: data.workouts.slice(-8), recentLifts: data.lifts.slice(-15) } });
    } catch (err) { out.textContent = aiErrorText(err); }
  });

  // Rest timer
  let restInterval = null;
  const restDisplay = document.getElementById("rest-display");
  function stopRest() { clearInterval(restInterval); restInterval = null; restDisplay.textContent = "Rest timer"; restDisplay.classList.remove("live", "done"); }
  function startRest(sec) {
    clearInterval(restInterval);
    let remaining = sec;
    restDisplay.classList.add("live"); restDisplay.classList.remove("done");
    const tick = () => {
      const m = Math.floor(remaining / 60), s = remaining % 60;
      restDisplay.textContent = `${m}:${String(s).padStart(2, "0")}`;
      if (remaining <= 0) {
        clearInterval(restInterval); restInterval = null;
        restDisplay.textContent = "Done! 💪"; restDisplay.classList.remove("live"); restDisplay.classList.add("done");
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        return;
      }
      remaining--;
    };
    tick();
    restInterval = setInterval(tick, 1000);
  }
  document.querySelectorAll(".rest-btn[data-sec]").forEach((b) => b.addEventListener("click", () => startRest(parseInt(b.dataset.sec, 10))));
  document.getElementById("rest-stop").addEventListener("click", stopRest);

  // Workout templates
  document.getElementById("tmpl-save").addEventListener("click", () => {
    const today = data.lifts.filter((l) => l.date === todayISO());
    if (!today.length) { alert("Log some lifts today first, then save them as a template."); return; }
    const name = prompt("Name this template (e.g. Leg Day):", "");
    if (!name || !name.trim()) return;
    data.templates.push({
      id: uid(), name: name.trim(),
      items: today.map((l) => ({ exercise: l.exercise, weight: l.weight, reps: l.reps, sets: l.sets })),
    });
    save(); render();
  });
  document.querySelector(".content").addEventListener("click", (e) => {
    const btn = e.target.closest(".tmpl-log");
    if (!btn) return;
    const t = data.templates.find((x) => x.id === btn.dataset.id);
    if (!t) return;
    t.items.forEach((it) => data.lifts.push({ id: uid(), date: todayISO(), exercise: it.exercise, weight: it.weight, reps: it.reps, sets: it.sets }));
    save(); render();
    openModal("Logged ✅", esc(`"${t.name}" added to today's strength log (${t.items.length} exercise${t.items.length === 1 ? "" : "s"}). Adjust the weights if today was heavier or lighter.`));
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
  document.getElementById("nutrition-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const goal = int("cal-goal");
    data.settings.calorieGoal = goal || 2400;
    data.settings.matchWeight = num("match-weight");
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
    if (chk && chk.dataset.kind && data[chk.dataset.kind]) {
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
    renderCalendar();
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
    renderNutrition();
    renderTasks();
    renderDecks();
    renderTrack();
    renderAnalyses();
    fillSettings();
  }

  function fillSettings() {
    document.getElementById("lunch-url").value = data.settings.lunchUrl || "";
    document.getElementById("user-name").value = data.settings.name || "";
    document.getElementById("ai-base").value = data.settings.aiBase || "";
    document.getElementById("elig-gpa").value = data.settings.eligGpa != null ? data.settings.eligGpa : 2.0;
    document.getElementById("cal-goal").value = data.settings.calorieGoal || 2400;
    document.getElementById("match-weight").value = data.settings.matchWeight != null ? data.settings.matchWeight : "";
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
    renderGameWeek();
    renderAgenda();
  }

  function renderAgenda() {
    const items = upcomingEvents(3);
    const el = document.getElementById("dash-agenda");
    el.innerHTML = items.length
      ? items.slice(0, 6).map((it) => {
        const r = relDue(it.date);
        const tag = it.type === "school" ? "due" : esc(String(it.type || ""));
        return `<li><span>${esc(it.title)}</span><span class="meta">${r.text}${tag ? " · " + tag : ""}</span></li>`;
      }).join("")
      : `<li class="empty">Clear for the next few days.</li>`;
  }

  function renderGameWeek() {
    const body = document.getElementById("gw-body");
    const g = nextGame();
    if (!g) {
      body.innerHTML = `<p class="hint">No upcoming games scheduled. Add one above (or on the Calendar) and I'll build a day-by-day plan — training, study, and fueling.</p>`;
      return;
    }
    const d = daysUntil(g.date);
    const name = esc(g.label || "Your game");

    let phase, plan;
    if (d > 7) { phase = "Build"; plan = ["Train hard — normal lifts and conditioning.", "Eat and sleep well to build.", "Get ahead on schoolwork now while the week is open."]; }
    else if (d >= 3) { phase = "Sharpen"; plan = ["Ease intensity slightly; sharpen technique and speed.", "Stay consistent with fueling and hydration.", "Clear assignments due this week early."]; }
    else if (d >= 1) { phase = "Taper"; plan = ["Light movement only — rest and recover.", "Hydrate well and prioritize sleep.", "Don't try any new foods or routines.", "Pack your gear tonight."]; }
    else { phase = "Game day"; plan = ["Eat a familiar meal about 3 hours before.", "Hydrate steadily through the day.", "Do your full dynamic warm-up.", "Trust your training — go compete. 🔥"]; }

    const dueBefore = data.school.filter((s) => !s.done && s.due && s.due <= g.date).length;
    const cd = d === 0 ? "Today" : d === 1 ? "Tomorrow" : `in ${d} days`;
    body.innerHTML = `
      <div class="gw-count">
        <span class="gw-d">${d === 0 ? "🏆" : d}</span>
        <div><div class="gw-name">${name}</div><div class="gw-when">${cd} · ${fmtDate(g.date)}</div></div>
        <span class="badge gw-phase">${phase}</span>
      </div>
      ${dueBefore ? `<div class="sug"><span class="sug-i">📚</span><span>${dueBefore} school item${dueBefore > 1 ? "s" : ""} due before ${name} — knock ${dueBefore > 1 ? "them" : "it"} out early so game week stays calm.</span></div>` : ""}
      <ul class="gw-plan">${plan.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`;
  }

  // ============ CALENDAR ============
  function typeCls(type) {
    return { Game: "c-game", Practice: "c-practice", Exam: "c-exam", Work: "c-work", Personal: "c-personal" }[type] || "c-personal";
  }
  function calItems() {
    const items = [];
    data.events.forEach((e) => {
      const base = { label: e.title, cls: typeCls(e.type), kind: "event", ref: e };
      if (e.repeat === "weekly" && e.date) {
        const start = new Date(e.date + "T00:00:00");
        for (let i = 0; i < 60; i++) { const d = new Date(start); d.setDate(d.getDate() + i * 7); items.push({ ...base, date: isoLocal(d) }); }
      } else {
        items.push({ ...base, date: e.date });
      }
    });
    data.school.filter((s) => !s.done && s.due).forEach((s) => items.push({ date: s.due, label: s.title, cls: "c-exam", kind: "school", ref: s }));
    // legacy single game-week event
    const ne = data.settings.nextEvent;
    if (ne && ne.date) items.push({ date: ne.date, label: ne.name || "Game", cls: "c-game", kind: "game", ref: ne });
    return items;
  }

  function nextGame() {
    const today = isoLocal(new Date());
    return calItems()
      .filter((it) => (it.kind === "game" || (it.kind === "event" && it.ref.type === "Game")) && it.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
  }
  function eventsByDate() {
    const m = {};
    calItems().forEach((it) => { (m[it.date] = m[it.date] || []).push(it); });
    return m;
  }
  function upcomingEvents(days) {
    const today = isoLocal(new Date());
    const max = new Date(); max.setDate(max.getDate() + days);
    const maxStr = isoLocal(max);
    return calItems().filter((it) => it.date >= today && it.date <= maxStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((it) => ({ date: it.date, title: it.label, type: it.kind === "event" ? it.ref.type : it.kind }));
  }

  function renderCalendar() {
    const grid = document.getElementById("cal-grid");
    if (!grid) return;
    const y = calMonth.getFullYear(), mo = calMonth.getMonth();
    document.getElementById("cal-title").textContent = calMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const startDow = new Date(y, mo, 1).getDay();
    const daysInMonth = new Date(y, mo + 1, 0).getDate();
    const byDate = eventsByDate();
    const todayStr = isoLocal(new Date());
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(y, mo, day));
    while (cells.length % 7) cells.push(null);
    grid.innerHTML = cells.map((c) => {
      if (!c) return `<div class="cal-cell empty"></div>`;
      const ds = isoLocal(c);
      const evs = byDate[ds] || [];
      const cls = ["cal-cell"];
      if (evs.length) cls.push("has-ev");
      if (ds === todayStr) cls.push("today");
      if (ds === calSelected) cls.push("sel");
      const chips = evs.slice(0, 3).map((e) => `<span class="cal-chip ${e.cls}">${esc(e.label)}</span>`).join("");
      const more = evs.length > 3 ? `<span class="cal-more">+${evs.length - 3} more</span>` : "";
      return `<button class="${cls.join(" ")}" data-date="${ds}"><span class="cal-num">${c.getDate()}</span>${chips}${more}</button>`;
    }).join("");
    renderDayPanel();
  }

  function renderDayPanel() {
    const dateEl = document.getElementById("e-date");
    if (dateEl) dateEl.value = calSelected;
    const d = new Date(calSelected + "T00:00:00");
    document.getElementById("cal-day-title").textContent = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    const items = calItems().filter((it) => it.date === calSelected)
      .sort((a, b) => ((a.ref.time || "99") > (b.ref.time || "99") ? 1 : -1));
    const el = document.getElementById("cal-day-events");
    el.innerHTML = items.length ? items.map((it) => {
      const meta = it.kind === "school" ? "School due" : it.kind === "game" ? "Game week" : esc(it.ref.type || "Event") + (it.ref.repeat === "weekly" ? " · weekly" : "");
      const timeStr = it.kind === "event" && it.ref.time ? fmtTime(it.ref.time) : "";
      const sport = it.kind === "event" ? it.ref.sport : null;
      const sportLink = sport ? `<button class="sport-link" data-sport="${esc(sport)}">${sport === "track" ? "Track & PV" : "Log stats"} ›</button>` : "";
      return `<div class="item"><div class="item-body"><div class="item-title">${esc(it.label)}</div>
        <div class="item-sub"><span class="badge ${it.cls}">${meta}</span>${timeStr ? `<span>${timeStr}</span>` : ""}${sportLink}</div></div>
        ${it.kind === "event" ? `<button class="del" data-kind="events" data-id="${it.ref.id}">×</button>` : ""}</div>`;
    }).join("") : `<div class="empty-state">Nothing scheduled. Add an event below.</div>`;
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
    renderSuggestions();
    renderLiftChart();
    renderTonnage();
    renderTemplates();
  }

  function latestWeight() {
    const c = [...data.checkins].sort((a, b) => b.date.localeCompare(a.date)).find((x) => x.weight != null);
    return c ? c.weight : null;
  }

  function renderTonnage() {
    const el = document.getElementById("vol-strength");
    const weeks = [];
    const start = mondayOf(new Date());
    for (let i = 7; i >= 0; i--) {
      const ws = new Date(start); ws.setDate(ws.getDate() - i * 7);
      const we = new Date(ws); we.setDate(we.getDate() + 7);
      const ton = data.lifts
        .filter((l) => { const d = new Date(l.date + "T00:00:00"); return d >= ws && d < we; })
        .reduce((s, l) => s + (l.weight || 0) * (l.reps || 0) * (l.sets || 1), 0);
      weeks.push({ label: `${ws.getMonth() + 1}/${ws.getDate()}`, ton });
    }
    const max = Math.max(1, ...weeks.map((w) => w.ton));
    const fmt = (v) => (v >= 1000 ? (v / 1000).toFixed(1) + "k" : String(v));
    el.innerHTML = weeks.map((w) => `
      <div class="bar-wrap" title="${w.ton.toLocaleString()} lb">
        <span class="bar-val">${w.ton ? fmt(w.ton) : ""}</span>
        <div class="bar" style="height:${(w.ton / max) * 100}%"></div>
        <span class="bar-label">${w.label}</span>
      </div>`).join("");
  }

  function renderTemplates() {
    const el = document.getElementById("tmpl-list");
    el.innerHTML = data.templates.length ? data.templates.map((t) => `
      <div class="item"><div class="item-body">
        <div class="item-title">${esc(t.name)}</div>
        <div class="item-sub"><span class="badge">${t.items.length} exercise${t.items.length === 1 ? "" : "s"}</span>
        <span>${esc(t.items.map((i) => i.exercise).slice(0, 4).join(", "))}</span></div></div>
        <button class="tmpl-log ai-chip" data-id="${t.id}" title="Log this workout today">＋ Log</button>
        <button class="del" data-kind="templates" data-id="${t.id}">×</button></div>`).join("")
      : `<div class="empty-state">No templates yet. Log some lifts today, then tap "Save today's lifts".</div>`;
  }

  const ytSearch = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

  function renderSuggestions() {
    const el = document.getElementById("health-suggestions");
    const tips = [];
    const dates = data.workouts.map((w) => w.date).sort();
    if (dates.length) {
      const gap = -daysUntil(dates[dates.length - 1]);
      if (gap >= 3) tips.push(["⏰", `It's been ${gap} days since your last workout — time to get moving.`]);
    } else {
      tips.push(["🏁", "Log your first workout to start building a streak."]);
    }
    const wkStart = mondayOf(new Date());
    const weekMin = data.workouts.filter((w) => new Date(w.date + "T00:00:00") >= wkStart).reduce((s, w) => s + (w.duration || 0), 0);
    if (weekMin > 0 && weekMin < 150) tips.push(["📈", `${weekMin} active min this week — ${150 - weekMin} more reaches a solid weekly target.`]);
    if (weekMin >= 150) tips.push(["💪", `${weekMin} active minutes this week — crushing it.`]);
    const st = streakInfo(data.workouts.map((x) => x.date));
    if (st.current >= 6) tips.push(["🧘", `${st.current}-day streak — work in a mobility or rest day to recover.`]);
    const avgSleep = avgField(data.checkins.slice(-7), "sleep");
    if (avgSleep != null && avgSleep < 7) tips.push(["😴", `Avg sleep is ${avgSleep.toFixed(1)}h — aim for 8+ for recovery and focus.`]);
    // strength progression on your most-logged lift
    const counts = {};
    data.lifts.forEach((l) => { const k = l.exercise.toLowerCase(); (counts[k] = counts[k] || []).push(l); });
    let topEx = null, topN = 0;
    Object.values(counts).forEach((arr) => { if (arr.length > topN) { topN = arr.length; topEx = arr; } });
    if (topEx && topEx.length >= 2) {
      const sorted = [...topEx].sort((a, b) => a.date.localeCompare(b.date));
      const a = sorted[sorted.length - 2], b = sorted[sorted.length - 1];
      if (b.weight <= a.weight && b.reps >= 8) tips.push(["⬆️", `${b.exercise}: you hit ${b.reps} reps at ${trimNum(b.weight)} lb — try +5 lb next session.`]);
    }
    const recentTypes = new Set(data.workouts.slice(-8).map((w) => w.type));
    if (data.workouts.length >= 5 && recentTypes.size === 1) tips.push(["🔀", `Recent sessions are all ${[...recentTypes][0]} — mix in another style to round out your fitness.`]);

    el.innerHTML = tips.length
      ? tips.slice(0, 6).map(([i, t]) => `<div class="sug"><span class="sug-i">${i}</span><span>${esc(t)}</span></div>`).join("")
      : `<div class="sug"><span class="sug-i">✅</span><span>Everything looks balanced — keep it up!</span></div>`;
  }

  let liftPick = null;
  function renderLiftChart() {
    const sel = document.getElementById("lift-pick");
    const chart = document.getElementById("lift-chart");
    const exercises = [...new Set(data.lifts.map((l) => l.exercise))].sort((a, b) => a.localeCompare(b));
    if (!exercises.length) {
      sel.innerHTML = `<option>No lifts yet</option>`;
      chart.innerHTML = `<div class="empty-state" style="width:100%">Log lifts to see your progress.</div>`;
      return;
    }
    if (!liftPick || !exercises.includes(liftPick)) liftPick = exercises[0];
    sel.innerHTML = exercises.map((e) => `<option ${e === liftPick ? "selected" : ""}>${esc(e)}</option>`).join("");
    const byDate = {};
    data.lifts.filter((l) => l.exercise === liftPick).forEach((l) => { byDate[l.date] = Math.max(byDate[l.date] || 0, l.weight); });
    const sessions = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])).slice(-10);
    const max = Math.max(...sessions.map((s) => s[1]), 1);
    chart.innerHTML = sessions.map(([d, w]) => `
      <div class="bar-wrap" title="${trimNum(w)} lb on ${fmtDate(d)}">
        <span class="bar-val">${trimNum(w)}</span>
        <div class="bar" style="height:${(w / max) * 100}%"></div>
        <span class="bar-label">${d.slice(5).replace("-", "/")}</span>
      </div>`).join("");
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
    const bw = latestWeight();
    const prEl = document.getElementById("lift-prs");
    prEl.innerHTML = prs.length ? prs.map((e) => `
      <div class="pr-card">
        <div class="pr-name">${esc(e.name)}</div>
        <div class="pr-val">${trimNum(e.maxWeight)}<small> lb × ${e.bestSet.reps}</small></div>
        <div class="pr-sub">est. 1RM ${trimNum(Math.round(e.oneRm))} lb</div>
        ${bw ? `<div class="pr-ratio">${(e.maxWeight / bw).toFixed(2)}× bodyweight</div>` : ""}
        <a class="vid-link" href="${ytSearch(e.name + " proper form technique")}" target="_blank" rel="noopener">▶ Form video</a>
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

  // ============ NUTRITION ============
  const pointsFor = (cal) => Math.max(0, Math.round(cal / 50));

  function nutritionToday() {
    const today = todayISO();
    const foods = data.foods.filter((f) => f.date === today);
    const consumed = foods.reduce((s, f) => s + (f.cal || 0), 0);
    const goal = data.settings.calorieGoal || 2400;
    const latestWeight = [...data.checkins].sort((a, b) => b.date.localeCompare(a.date)).find((c) => c.weight != null);
    return { foods, consumed, goal, remaining: goal - consumed, weight: latestWeight ? latestWeight.weight : null };
  }

  function renderNutrition() {
    const n = nutritionToday();
    const pctEl = Math.min(100, n.goal ? Math.round((n.consumed / n.goal) * 100) : 0);
    const target = data.settings.matchWeight;
    const weightLabel = n.weight != null
      ? (target != null ? `${trimNum(n.weight)} → ${trimNum(target)}` : trimNum(n.weight))
      : "–";

    document.getElementById("nutri-stats").innerHTML =
      statCard(n.consumed + "<small> cal</small>", "Eaten today") +
      statCard((n.remaining < 0 ? "−" : "") + Math.abs(n.remaining) + "<small> cal</small>", n.remaining < 0 ? "Over budget" : "Remaining") +
      statCard(`${pointsFor(n.consumed)}<small>/${pointsFor(n.goal)}</small>`, "Points used") +
      statCard(weightLabel, target != null ? "Weight → target" : "Latest weight");

    document.getElementById("cal-summary").textContent =
      `${n.consumed} of ${n.goal} cal today · ${n.remaining >= 0 ? n.remaining + " left" : Math.abs(n.remaining) + " over"}`;
    const P = n.foods.reduce((s, f) => s + (f.p || 0), 0);
    const C = n.foods.reduce((s, f) => s + (f.c || 0), 0);
    const F = n.foods.reduce((s, f) => s + (f.f || 0), 0);
    document.getElementById("macro-summary").textContent = `Protein ${P}g · Carbs ${C}g · Fat ${F}g`;
    const fill = document.getElementById("cal-fill");
    fill.style.width = pctEl + "%";
    fill.style.background = n.remaining < 0
      ? "linear-gradient(90deg,#fb7185,#f43f5e)"
      : "linear-gradient(90deg,#fb923c,#fbbf24)";

    const el = document.getElementById("food-list");
    const items = [...data.foods].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
    el.innerHTML = items.length ? items.map((f) => `
      <div class="item"><div class="item-body">
        <div class="item-title">${esc(f.name)}</div>
        <div class="item-sub"><span class="badge">${esc(f.meal || "Snack")}</span>
        <span>${f.cal} cal</span><span>${pointsFor(f.cal)} pts</span>${(f.p || f.c || f.f) ? `<span>${f.p || 0}P · ${f.c || 0}C · ${f.f || 0}F</span>` : ""}<span>${fmtDate(f.date)}</span></div></div>
        <button class="del" data-kind="foods" data-id="${f.id}">×</button></div>`).join("")
      : `<div class="empty-state">No foods logged yet. Track what you eat to manage your weight.</div>`;
  }

  document.getElementById("nutri-ai").addEventListener("click", async () => {
    const out = document.getElementById("nutri-out");
    const btn = document.getElementById("nutri-ai");
    const n = nutritionToday();
    btn.disabled = true; out.textContent = "Thinking…";
    try {
      out.textContent = await aiCall("nutrition", {
        intent: data.settings.matchWeight != null ? "maintain weight toward their match target while fueling for training" : "fuel well and maintain weight",
        context: {
          remainingCalories: n.remaining, calorieGoal: n.goal, eatenToday: n.consumed,
          currentWeight: n.weight, targetWeight: data.settings.matchWeight,
          foodsToday: n.foods.map((f) => ({ name: f.name, cal: f.cal, meal: f.meal })),
        },
      });
    } catch (err) { out.textContent = aiErrorText(err); }
    finally { btn.disabled = false; }
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
      upcomingSchedule: upcomingEvents(14),
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
      upcomingSchedule: upcomingEvents(21),
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

  // ============ HOMEWORK HELPER ============
  let tutorSubject = "math";
  let tutorImage = null;     // { mediaType, data } base64, no data-URL prefix
  let pendingDeck = null;    // last generated, not-yet-saved flashcard deck

  const SUBJECT_NAMES = { math: "Math", science: "Science", english: "English", history: "History", language: "Foreign Language", cs: "Comp Sci", other: "Other" };
  const subjectName = (k) => SUBJECT_NAMES[k] || "Other";

  async function aiCallFull(kind, payload) {
    const base = data.settings.aiBase || "";
    const res = await fetch(`${base}/api/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, payload }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status}).`);
    return json;
  }

  // Shrink a photo before upload so it stays well under serverless body limits.
  function resizePhoto(file, max = 1280, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("decode"));
        img.onload = () => {
          let { width, height } = img;
          const longest = Math.max(width, height);
          if (longest > max) { const s = max / longest; width = Math.round(width * s); height = Math.round(height * s); }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  document.getElementById("subject-grid").addEventListener("click", (e) => {
    const chip = e.target.closest(".subject-chip");
    if (!chip) return;
    document.querySelectorAll(".subject-chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    tutorSubject = chip.dataset.subject;
  });

  document.getElementById("hw-photo").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizePhoto(file);
      tutorImage = { mediaType: "image/jpeg", data: dataUrl.split(",")[1] };
      const prev = document.getElementById("hw-preview");
      prev.src = dataUrl; prev.hidden = false;
      document.getElementById("photo-drop-empty").hidden = true;
      document.getElementById("photo-clear").hidden = false;
      document.getElementById("photo-drop").classList.add("has-photo");
    } catch {
      alert("Couldn't read that image. Try another photo.");
    }
  });

  document.getElementById("photo-clear").addEventListener("click", () => {
    tutorImage = null;
    document.getElementById("hw-photo").value = "";
    const prev = document.getElementById("hw-preview");
    prev.src = ""; prev.hidden = true;
    document.getElementById("photo-drop-empty").hidden = false;
    document.getElementById("photo-clear").hidden = true;
    document.getElementById("photo-drop").classList.remove("has-photo");
  });

  const tutorErr = (msg) => `<div class="tutor-error">${esc(msg)}</div>`;
  const loadingLabel = (kind) =>
    kind === "tutor-flashcards" ? "Building your flashcards…"
    : kind === "tutor-quiz" ? "Writing your practice quiz…"
    : "Reading your problem…";

  function flashcardsHTML(cards) {
    return `<div class="flashcards">${cards.map((c, i) => `
      <button type="button" class="flashcard" data-i="${i}">
        <span class="fc-inner">
          <span class="fc-face fc-front"><span class="fc-tag">Card ${i + 1}</span><span class="fc-text">${esc(c.front)}</span></span>
          <span class="fc-face fc-back"><span class="fc-tag">Answer</span><span class="fc-text">${esc(c.back)}</span></span>
        </span>
      </button>`).join("")}</div>`;
  }

  function renderExplain(out, text) {
    const d = document.createElement("div");
    d.className = "ai-output";
    d.textContent = text || "No response.";
    out.innerHTML = "";
    out.appendChild(d);
  }

  function renderGeneratedDeck(out, deck) {
    pendingDeck = deck;
    out.innerHTML = `<div class="result-head">
        <h4 class="result-title">${esc(deck.title || "Flashcards")}</h4>
        <button type="button" class="btn-ghost" id="save-deck">＋ Save deck</button>
      </div>
      <p class="result-tip">Tap a card to flip it.</p>
      ${flashcardsHTML(deck.cards)}`;
  }

  function renderQuiz(out, quiz) {
    const qs = Array.isArray(quiz.questions) ? quiz.questions : [];
    out.innerHTML = `<h4 class="result-title">${esc(quiz.title || "Practice quiz")}</h4>
      <p class="result-tip">Pick an answer to see if you're right.</p>
      <div class="quiz">${qs.map((q, qi) => `
        <div class="quiz-q" data-answer="${Number(q.answer) || 0}">
          <div class="quiz-prompt"><span class="quiz-num">${qi + 1}</span><span>${esc(q.q)}</span></div>
          <div class="quiz-choices">${(q.choices || []).map((ch, ci) => `
            <button type="button" class="quiz-choice" data-c="${ci}">${esc(ch)}</button>`).join("")}</div>
          <div class="quiz-why" hidden>${esc(q.why || "")}</div>
        </div>`).join("")}</div>
      <div class="quiz-score" id="quiz-score" hidden></div>`;
  }

  document.querySelector(".tutor-actions").addEventListener("click", async (e) => {
    const btn = e.target.closest(".tutor-action");
    if (!btn) return;
    const kind = btn.dataset.action;
    const out = document.getElementById("tutor-output");
    const question = document.getElementById("hw-question").value.trim();
    if (!tutorImage && !question) {
      out.innerHTML = tutorErr("Add a photo of the homework or type the problem first.");
      return;
    }
    const actions = document.querySelectorAll(".tutor-action");
    actions.forEach((b) => (b.disabled = true));
    out.innerHTML = `<div class="tutor-loading"><span class="spinner"></span>${loadingLabel(kind)}</div>`;
    try {
      const json = await aiCallFull(kind, { subject: tutorSubject, question, image: tutorImage });
      if (kind === "tutor-explain") {
        renderExplain(out, json.text);
      } else if (kind === "tutor-flashcards") {
        if (json.data && Array.isArray(json.data.cards) && json.data.cards.length) renderGeneratedDeck(out, json.data);
        else renderExplain(out, json.text || "I couldn't turn that into flashcards — try a clearer photo.");
      } else if (kind === "tutor-quiz") {
        if (json.data && Array.isArray(json.data.questions) && json.data.questions.length) renderQuiz(out, json.data);
        else renderExplain(out, json.text || "I couldn't turn that into a quiz — try a clearer photo.");
      }
    } catch (err) {
      out.innerHTML = tutorErr(aiErrorText(err));
    } finally {
      actions.forEach((b) => (b.disabled = false));
    }
  });

  function saveDeck() {
    if (!pendingDeck) return;
    data.decks.push({
      id: uid(),
      title: pendingDeck.title || "Flashcards",
      subject: tutorSubject,
      cards: pendingDeck.cards,
      created: todayISO(),
    });
    save();
    renderDecks();
    const btn = document.getElementById("save-deck");
    if (btn) { btn.textContent = "✓ Saved"; btn.disabled = true; }
  }

  function handleQuizChoice(choice) {
    const qEl = choice.closest(".quiz-q");
    if (!qEl || qEl.classList.contains("answered")) return;
    qEl.classList.add("answered");
    choice.classList.add("picked");
    const correct = Number(qEl.dataset.answer);
    qEl.querySelectorAll(".quiz-choice").forEach((b) => {
      b.disabled = true;
      const ci = Number(b.dataset.c);
      if (ci === correct) b.classList.add("correct");
      else if (b.classList.contains("picked")) b.classList.add("wrong");
    });
    const why = qEl.querySelector(".quiz-why");
    if (why) why.hidden = false;
    const all = document.querySelectorAll(".quiz-q");
    if (![...all].every((q) => q.classList.contains("answered"))) return;
    const got = document.querySelectorAll(".quiz-choice.correct.picked").length;
    const pct = Math.round((got / all.length) * 100);
    const el = document.getElementById("quiz-score");
    el.hidden = false;
    el.textContent = `You got ${got} / ${all.length} (${pct}%). ` +
      (pct === 100 ? "Perfect — you've got this!" : pct >= 70 ? "Solid — review the ones you missed." : "Keep at it — read the explanations and try again.");
  }

  // Delegated interactions for the whole tutor view (flips, save, quiz, decks).
  document.getElementById("view-tutor").addEventListener("click", (e) => {
    const card = e.target.closest(".flashcard");
    if (card) { card.classList.toggle("flipped"); return; }
    if (e.target.closest("#save-deck")) { saveDeck(); return; }
    const choice = e.target.closest(".quiz-choice");
    if (choice) { handleQuizChoice(choice); return; }
    const del = e.target.closest(".deck-del");
    if (del) { data.decks = data.decks.filter((d) => d.id !== del.dataset.id); save(); renderDecks(); return; }
    const toggle = e.target.closest(".deck-toggle");
    if (toggle) {
      const body = document.getElementById("deck-body-" + toggle.dataset.id);
      if (body) body.hidden = !body.hidden;
      toggle.classList.toggle("open");
    }
  });

  function renderDecks() {
    const card = document.getElementById("decks-card");
    const list = document.getElementById("deck-list");
    if (!card || !list) return;
    if (!data.decks.length) { card.hidden = true; list.innerHTML = ""; return; }
    card.hidden = false;
    list.innerHTML = [...data.decks].reverse().map((d) => `
      <div class="deck">
        <div class="deck-header">
          <button type="button" class="deck-toggle" data-id="${d.id}">
            <span class="deck-name">${esc(d.title)}</span>
            <span class="deck-meta">${d.cards.length} cards · ${esc(subjectName(d.subject))} · ${fmtDate(d.created)}</span>
            <span class="deck-caret">›</span>
          </button>
          <button type="button" class="del deck-del" data-id="${d.id}" title="Delete deck">×</button>
        </div>
        <div class="deck-body" id="deck-body-${d.id}" hidden>${flashcardsHTML(d.cards)}</div>
      </div>`).join("");
  }

  // ============ SCHEDULE IMPORT (photo → calendar) ============
  let schedImage = null;
  const EVENT_TYPES = ["Game", "Practice", "Exam", "Work", "Personal"];

  document.getElementById("sched-photo").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizePhoto(file, 1600, 0.85);
      schedImage = { mediaType: "image/jpeg", data: dataUrl.split(",")[1] };
      const prev = document.getElementById("sched-preview");
      prev.src = dataUrl; prev.hidden = false;
      document.getElementById("sched-drop-empty").hidden = true;
      document.getElementById("sched-drop").classList.add("has-photo");
      document.getElementById("sched-controls").hidden = false;
    } catch {
      alert("Couldn't read that image. Try another photo.");
    }
  });

  function clearSchedPhoto() {
    schedImage = null;
    document.getElementById("sched-photo").value = "";
    const prev = document.getElementById("sched-preview");
    prev.src = ""; prev.hidden = true;
    document.getElementById("sched-drop-empty").hidden = false;
    document.getElementById("sched-drop").classList.remove("has-photo");
    document.getElementById("sched-controls").hidden = true;
  }

  document.getElementById("sched-clear").addEventListener("click", () => {
    clearSchedPhoto();
    document.getElementById("sched-result").innerHTML = "";
  });

  document.getElementById("sched-scan").addEventListener("click", async () => {
    if (!schedImage) return;
    const out = document.getElementById("sched-result");
    const btn = document.getElementById("sched-scan");
    btn.disabled = true;
    out.innerHTML = `<div class="tutor-loading"><span class="spinner"></span>Reading your schedule…</div>`;
    try {
      const note = document.getElementById("sched-note").value.trim();
      const json = await aiCallFull("schedule-import", { today: todayISO(), note, image: schedImage });
      const events = json.data && Array.isArray(json.data.events) ? json.data.events : [];
      renderSchedReview(out, events);
    } catch (err) {
      out.innerHTML = `<div class="tutor-error">${esc(aiErrorText(err))}</div>`;
    } finally {
      btn.disabled = false;
    }
  });

  function renderSchedReview(out, events) {
    const valid = (events || []).filter((ev) => ev && ev.date);
    if (!valid.length) {
      out.innerHTML = `<div class="tutor-error">Couldn't find any dated events. Try a clearer, straight-on photo of the schedule.</div>`;
      return;
    }
    out.innerHTML = `<div class="sched-review">
      <p class="sched-review-head"><strong>${valid.length}</strong> event${valid.length > 1 ? "s" : ""} found — uncheck any you don't want, and fix anything that's off.</p>
      <div class="sched-rows">${valid.map((ev) => {
        const type = EVENT_TYPES.includes(ev.type) ? ev.type : "Game";
        return `<div class="sched-row">
          <input type="checkbox" class="check sched-pick" checked>
          <input type="text" class="sched-f sched-title" value="${esc(ev.title || "")}" placeholder="Event">
          <input type="date" class="sched-f sched-date" value="${esc(ev.date)}">
          <input type="time" class="sched-f sched-time" value="${esc(ev.time || "")}">
          <select class="sched-f sched-type">${EVENT_TYPES.map((t) => `<option value="${t}"${t === type ? " selected" : ""}>${t}</option>`).join("")}</select>
        </div>`;
      }).join("")}</div>
      <div class="sched-actions">
        <button type="button" id="sched-add">Add to calendar</button>
        <button type="button" class="btn-ghost" id="sched-cancel">Cancel</button>
      </div>
    </div>`;
  }

  document.getElementById("sched-result").addEventListener("click", (e) => {
    if (e.target.closest("#sched-cancel")) {
      document.getElementById("sched-result").innerHTML = "";
      return;
    }
    if (!e.target.closest("#sched-add")) return;
    const sport = document.getElementById("sched-sport").value;
    let added = 0;
    document.querySelectorAll(".sched-row").forEach((row) => {
      if (!row.querySelector(".sched-pick").checked) return;
      const date = row.querySelector(".sched-date").value;
      if (!date) return;
      const title = row.querySelector(".sched-title").value.trim();
      const time = row.querySelector(".sched-time").value;
      const type = row.querySelector(".sched-type").value;
      const ev = { id: uid(), title: title || type, date, time, type, repeat: "none" };
      if (sport) ev.sport = sport;
      data.events.push(ev);
      added++;
    });
    if (!added) return;
    save();
    render();
    clearSchedPhoto();
    document.getElementById("sched-result").innerHTML =
      `<div class="sched-success">✓ Added ${added} event${added > 1 ? "s" : ""} to your calendar.</div>`;
  });

  // ============ TRACK & POLE VAULT ============
  document.getElementById("track-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!val("tr-date") || !val("tr-meet").trim()) return;
    data.track.push({
      id: uid(), date: val("tr-date"), meet: val("tr-meet").trim(),
      event: val("tr-event").trim(), mark: val("tr-mark").trim(), notes: val("tr-notes").trim(),
    });
    save(); e.target.reset(); render();
  });

  function renderTrack() {
    const list = document.getElementById("track-list");
    if (!list) return;
    const items = [...data.track].sort((a, b) => b.date.localeCompare(a.date));
    const pv = items.filter((t) => /vault|\bpv\b/i.test(t.event || ""));
    document.getElementById("track-stats").innerHTML =
      statCard(items.length, "Entries") +
      statCard(new Set(items.map((t) => t.meet)).size, "Meets") +
      statCard(pv.length, "Pole vault marks");
    list.innerHTML = items.length ? items.map((t) => `
      <div class="item"><div class="item-body">
        <div class="item-title">${esc(t.meet)}${t.event ? ` · ${esc(t.event)}` : ""}</div>
        <div class="item-sub">${t.mark ? `<span class="badge">${esc(t.mark)}</span>` : ""}<span>${fmtDate(t.date)}</span>${t.notes ? `<span>· ${esc(t.notes)}</span>` : ""}</div></div>
        <button class="del" data-kind="track" data-id="${t.id}">×</button></div>`).join("")
      : `<div class="empty-state">No meets logged yet. Add one above.</div>`;
  }

  // ============ SHARED VIDEO ANALYSIS ENGINE ============
  const DISC_LABELS = { swing: "Swing", pitching: "Pitching", wrestling: "Wrestling", polevault: "Pole vault" };
  const discLabel = (d) => DISC_LABELS[d] || "Video";

  const VA_CONFIGS = {
    baseball: { title: "AI video breakdown", hint: "Upload a clip of your at-bat or pitching delivery for coaching feedback. Film side-on with your whole body in frame — slow-motion is ideal.", disciplines: [{ value: "swing", label: "Swing / at-bat" }, { value: "pitching", label: "Pitching" }] },
    wrestling: { title: "AI video breakdown", hint: "Upload a clip of a match, a shot, or a drill for coaching feedback. Keep your whole body in frame.", disciplines: [{ value: "wrestling", label: "Wrestling" }] },
    track: { title: "Pole vault video analysis", hint: "Upload a side-on clip of your vault — approach through bar clearance. Slow-motion helps a lot.", disciplines: [{ value: "polevault", label: "Pole Vault" }] },
  };
  const lastVA = {}; // last unsaved analysis per analyzer key

  function videoAnalyzerHTML(prefix, cfg) {
    const disc = cfg.disciplines.length > 1
      ? `<div class="va-disc" id="${prefix}-disc">${cfg.disciplines.map((d, i) => `<button type="button" class="va-disc-btn${i === 0 ? " active" : ""}" data-disc="${d.value}">${esc(d.label)}</button>`).join("")}</div>`
      : "";
    return `<h3>${esc(cfg.title)}</h3>
      <p class="hint">${esc(cfg.hint)}</p>
      ${disc}
      <label class="photo-drop compact" id="${prefix}-drop">
        <input type="file" id="${prefix}-file" accept="video/*">
        <div class="photo-drop-empty">
          <span class="photo-ic">🎥</span>
          <span class="photo-label">Upload a video</span>
          <span class="photo-hint">Side-on, full body in frame. Slow-mo is ideal.</span>
        </div>
      </label>
      <video id="${prefix}-preview" class="va-preview" playsinline controls hidden></video>
      <div class="import-controls" id="${prefix}-controls" hidden>
        <input type="text" id="${prefix}-note" class="sched-note" placeholder="Optional: what should I focus on?">
        <button type="button" id="${prefix}-go">Analyze with AI</button>
        <button type="button" class="btn-ghost" id="${prefix}-clear">Remove</button>
      </div>
      <div id="${prefix}-out" class="tutor-output"></div>
      <div id="${prefix}-saved" class="va-saved"></div>`;
  }

  function seekVideo(video, t) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (done) return; done = true; video.removeEventListener("seeked", finish); resolve(); };
      video.addEventListener("seeked", finish);
      try { video.currentTime = Math.min(t, Math.max(0, (video.duration || 0) - 0.05)); } catch { finish(); }
      setTimeout(finish, 3000); // some browsers don't reliably fire "seeked"
    });
  }

  function extractVideoFrames(file, count = 6, maxDim = 720) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "auto"; video.muted = true; video.playsInline = true; video.src = url;
      const fail = (msg) => { URL.revokeObjectURL(url); reject(new Error(msg)); };
      video.addEventListener("error", () => fail("Couldn't read that video file."), { once: true });
      video.addEventListener("loadedmetadata", async () => {
        const dur = video.duration;
        if (!dur || !isFinite(dur) || !video.videoWidth) { fail("Couldn't read that video file."); return; }
        const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const ctx = canvas.getContext("2d");
        const frames = [];
        try {
          for (let i = 0; i < count; i++) {
            await seekVideo(video, dur * ((i + 0.5) / count));
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            frames.push(canvas.toDataURL("image/jpeg", 0.8));
          }
        } catch { fail("Couldn't read frames from that video."); return; }
        URL.revokeObjectURL(url);
        resolve(frames);
      }, { once: true });
    });
  }

  function makeThumb(dataUrl, max = 360, q = 0.6) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", q));
      };
      img.onerror = () => resolve("");
      img.src = dataUrl;
    });
  }

  function setupVideoAnalyzer(key) {
    const root = document.getElementById("va-" + key);
    const cfg = VA_CONFIGS[key];
    if (!root || !cfg) return;
    const prefix = "va-" + key;
    root.innerHTML = videoAnalyzerHTML(prefix, cfg);
    const $ = (s) => document.getElementById(prefix + s);
    let file = null;
    let disc = cfg.disciplines[0].value;

    if (cfg.disciplines.length > 1) {
      $("-disc").addEventListener("click", (e) => {
        const b = e.target.closest(".va-disc-btn");
        if (!b) return;
        disc = b.dataset.disc;
        root.querySelectorAll(".va-disc-btn").forEach((x) => x.classList.toggle("active", x === b));
      });
    }

    $("-file").addEventListener("change", (e) => {
      file = e.target.files[0] || null;
      if (!file) return;
      const v = $("-preview");
      v.src = URL.createObjectURL(file); v.hidden = false;
      $("-drop").hidden = true;
      $("-controls").hidden = false;
      $("-out").innerHTML = "";
    });

    $("-clear").addEventListener("click", () => {
      file = null; $("-file").value = "";
      const v = $("-preview"); v.removeAttribute("src"); v.load(); v.hidden = true;
      $("-drop").hidden = false; $("-controls").hidden = true; $("-out").innerHTML = "";
    });

    $("-go").addEventListener("click", async () => {
      if (!file) return;
      const out = $("-out"), btn = $("-go");
      btn.disabled = true;
      out.innerHTML = `<div class="tutor-loading"><span class="spinner"></span>Pulling frames and analyzing your ${esc(discLabel(disc).toLowerCase())}…</div>`;
      try {
        const dataUrls = await extractVideoFrames(file);
        if (!dataUrls.length) throw new Error("Couldn't read frames from that video.");
        const frames = dataUrls.map((u) => ({ mediaType: "image/jpeg", data: u.split(",")[1] }));
        const note = $("-note").value.trim();
        const json = await aiCallFull("video-analyze", { discipline: disc, note, frames });
        const text = json.text || "No feedback returned — try a clearer clip.";
        const thumb = await makeThumb(dataUrls[Math.floor(dataUrls.length / 2)]);
        lastVA[key] = { discipline: disc, note, feedback: text, thumb };
        const d = document.createElement("div"); d.className = "ai-output"; d.textContent = text;
        out.innerHTML = `<div class="result-head"><h4 class="result-title">${esc(discLabel(disc))} breakdown</h4><button type="button" class="btn-ghost" data-va-save="${key}">＋ Save analysis</button></div>`;
        out.appendChild(d);
      } catch (err) {
        out.innerHTML = `<div class="tutor-error">${esc(aiErrorText(err))}</div>`;
      } finally {
        btn.disabled = false;
      }
    });
  }

  function saveAnalysis(key) {
    const a = lastVA[key];
    if (!a) return;
    data.analyses.push({ id: uid(), discipline: a.discipline, label: a.note || discLabel(a.discipline), date: todayISO(), thumb: a.thumb, feedback: a.feedback });
    save(); renderAnalyses();
  }

  function renderAnalyses() {
    Object.keys(VA_CONFIGS).forEach((key) => {
      const el = document.getElementById("va-" + key + "-saved");
      if (!el) return;
      const vals = VA_CONFIGS[key].disciplines.map((d) => d.value);
      const items = data.analyses.filter((a) => vals.includes(a.discipline)).sort((a, b) => b.date.localeCompare(a.date));
      el.innerHTML = !items.length ? "" : `<h4 class="va-saved-title">Saved breakdowns</h4>` + items.map((a) => `
        <div class="deck">
          <div class="deck-header">
            <button type="button" class="deck-toggle va-saved-toggle" data-id="${a.id}">
              ${a.thumb ? `<img class="va-thumb" src="${a.thumb}" alt="">` : ""}
              <span class="deck-name">${esc(a.label || discLabel(a.discipline))}</span>
              <span class="deck-meta">${esc(discLabel(a.discipline))} · ${fmtDate(a.date)}</span>
              <span class="deck-caret">›</span>
            </button>
            <button type="button" class="del va-del" data-kind="analyses" data-id="${a.id}" title="Delete">×</button>
          </div>
          <div class="deck-body" id="va-body-${a.id}" hidden></div>
        </div>`).join("");
      // fill feedback as text (avoids HTML injection while keeping line breaks via CSS)
      items.forEach((a) => {
        const body = document.getElementById("va-body-" + a.id);
        if (body) { const d = document.createElement("div"); d.className = "ai-output"; d.textContent = a.feedback; body.appendChild(d); }
      });
    });
  }

  // ============ STATS SCREENSHOT IMPORT (baseball / wrestling) ============
  function statImporterHTML(prefix) {
    return `<label class="photo-drop compact" id="${prefix}-drop">
        <input type="file" id="${prefix}-file" accept="image/*" capture="environment">
        <div class="photo-drop-empty">
          <span class="photo-ic">🧾</span>
          <span class="photo-label">Upload stats screenshot</span>
          <span class="photo-hint">A GameChanger box score or season screen works great</span>
        </div>
        <img id="${prefix}-preview" class="photo-preview" alt="Stats preview" hidden>
      </label>
      <div class="import-controls" id="${prefix}-controls" hidden>
        <button type="button" id="${prefix}-scan">Read stats</button>
        <button type="button" class="btn-ghost" id="${prefix}-clear">Remove</button>
      </div>
      <div id="${prefix}-result" class="sched-result"></div>`;
  }

  function setupStatImport(sport) {
    const container = document.getElementById(sport === "baseball" ? "bb-stat-import" : "wr-stat-import");
    if (!container) return;
    const prefix = "si-" + sport;
    container.innerHTML = statImporterHTML(prefix);
    container.hidden = true;
    const $ = (s) => document.getElementById(prefix + s);
    let image = null;

    $("-file").addEventListener("change", async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const dataUrl = await resizePhoto(f, 1600, 0.85);
        image = { mediaType: "image/jpeg", data: dataUrl.split(",")[1] };
        const p = $("-preview"); p.src = dataUrl; p.hidden = false;
        $("-drop").querySelector(".photo-drop-empty").hidden = true;
        $("-drop").classList.add("has-photo");
        $("-controls").hidden = false;
      } catch { alert("Couldn't read that image. Try another."); }
    });

    $("-clear").addEventListener("click", () => {
      image = null; $("-file").value = "";
      const p = $("-preview"); p.src = ""; p.hidden = true;
      $("-drop").querySelector(".photo-drop-empty").hidden = false;
      $("-drop").classList.remove("has-photo");
      $("-controls").hidden = true; $("-result").innerHTML = "";
    });

    $("-scan").addEventListener("click", async () => {
      if (!image) return;
      const out = $("-result"), btn = $("-scan");
      btn.disabled = true;
      out.innerHTML = `<div class="tutor-loading"><span class="spinner"></span>Reading the stats…</div>`;
      try {
        const json = await aiCallFull("stats-import", { sport, today: todayISO(), image });
        const rows = sport === "baseball"
          ? (json.data && Array.isArray(json.data.games) ? json.data.games : [])
          : (json.data && Array.isArray(json.data.matches) ? json.data.matches : []);
        renderStatReview(sport, out, rows);
      } catch (err) {
        out.innerHTML = `<div class="tutor-error">${esc(aiErrorText(err))}</div>`;
      } finally {
        btn.disabled = false;
      }
    });

    $("-result").addEventListener("click", (e) => {
      if (e.target.closest(".si-cancel")) { $("-result").innerHTML = ""; return; }
      if (!e.target.closest(".si-add")) return;
      let added = 0;
      document.querySelectorAll(`#${prefix}-result .sched-row`).forEach((row) => {
        if (!row.querySelector(".si-pick").checked) return;
        const get = (c) => { const el = row.querySelector("." + c); return el ? el.value : ""; };
        const date = get("si-date");
        if (!date) return;
        if (sport === "baseball") {
          data.baseball.push({ id: uid(), date, opponent: get("si-opp").trim(),
            ab: parseInt(get("si-ab"), 10) || 0, h: parseInt(get("si-h"), 10) || 0, rbi: parseInt(get("si-rbi"), 10) || 0,
            r: parseInt(get("si-r"), 10) || 0, bb: parseInt(get("si-bb"), 10) || 0, k: parseInt(get("si-k"), 10) || 0 });
        } else {
          data.wrestling.push({ id: uid(), date, opponent: get("si-opp").trim() || "Opponent", event: "",
            result: get("si-result"), method: get("si-method"), score: get("si-score").trim(), notes: "" });
        }
        added++;
      });
      if (!added) return;
      save(); render();
      const noun = sport === "baseball" ? (added > 1 ? "games" : "game") : (added > 1 ? "matches" : "match");
      $("-result").innerHTML = `<div class="sched-success">✓ Added ${added} ${noun} to ${sport}.</div>`;
    });
  }

  function renderStatReview(sport, out, rows) {
    const valid = (rows || []).filter((r) => r && r.date);
    if (!valid.length) {
      out.innerHTML = `<div class="tutor-error">Couldn't read any stats. Try a clearer, straight-on screenshot.</div>`;
      return;
    }
    const methodOpts = ["Decision", "Major", "Tech", "Pin", "Forfeit"];
    const rowsHTML = valid.map((r) => {
      if (sport === "baseball") {
        const n = (k) => Number.isFinite(+r[k]) ? +r[k] : 0;
        return `<div class="sched-row">
          <input type="checkbox" class="check si-pick" checked>
          <input type="date" class="sched-f si-date" value="${esc(r.date)}">
          <input type="text" class="sched-f si-opp" value="${esc(r.opponent || "")}" placeholder="Opp">
          <input type="number" class="sched-f si-num si-ab" value="${n("ab")}" title="AB">
          <input type="number" class="sched-f si-num si-h" value="${n("h")}" title="H">
          <input type="number" class="sched-f si-num si-rbi" value="${n("rbi")}" title="RBI">
          <input type="number" class="sched-f si-num si-r" value="${n("r")}" title="R">
          <input type="number" class="sched-f si-num si-bb" value="${n("bb")}" title="BB">
          <input type="number" class="sched-f si-num si-k" value="${n("k")}" title="K">
        </div>`;
      }
      const result = r.result === "Loss" ? "Loss" : "Win";
      const method = methodOpts.includes(r.method) ? r.method : "Decision";
      return `<div class="sched-row">
        <input type="checkbox" class="check si-pick" checked>
        <input type="date" class="sched-f si-date" value="${esc(r.date)}">
        <input type="text" class="sched-f si-opp" value="${esc(r.opponent || "")}" placeholder="Opp">
        <select class="sched-f si-result"><option${result === "Win" ? " selected" : ""}>Win</option><option${result === "Loss" ? " selected" : ""}>Loss</option></select>
        <select class="sched-f si-method">${methodOpts.map((m) => `<option${m === method ? " selected" : ""}>${m}</option>`).join("")}</select>
        <input type="text" class="sched-f si-score" value="${esc(r.score || "")}" placeholder="Score">
      </div>`;
    }).join("");
    const cols = sport === "baseball" ? " (date, opponent, then AB · H · RBI · R · BB · K)" : "";
    out.innerHTML = `<div class="sched-review">
      <p class="sched-review-head"><strong>${valid.length}</strong> ${sport === "baseball" ? "game" : "match"}${valid.length > 1 ? "s" : ""} found${cols} — uncheck or fix any, then add.</p>
      <div class="sched-rows">${rowsHTML}</div>
      <div class="sched-actions"><button type="button" class="si-add" id="${"si-" + sport}-add-btn">Add to ${sport}</button><button type="button" class="btn-ghost si-cancel">Cancel</button></div>
    </div>`;
  }

  // ============ STAT ANALYSIS BUTTONS (text AI) ============
  async function runStatAnalysis(kind, payload, outId, btnId) {
    const out = document.getElementById(outId), btn = document.getElementById(btnId);
    btn.disabled = true; out.textContent = "Thinking…";
    try { out.textContent = await aiCall(kind, payload); }
    catch (e) { out.textContent = aiErrorText(e); }
    finally { btn.disabled = false; }
  }
  document.getElementById("bb-analyze").addEventListener("click", () => {
    if (!data.baseball.length) { document.getElementById("bb-analyze-out").textContent = "Log a game or two first, then I can break down your hitting."; return; }
    runStatAnalysis("baseball-analysis", { games: data.baseball.slice(-20) }, "bb-analyze-out", "bb-analyze");
  });
  document.getElementById("wr-analyze").addEventListener("click", () => {
    if (!data.wrestling.length) { document.getElementById("wr-analyze-out").textContent = "Log a match or two first, then I can break down how you're wrestling."; return; }
    runStatAnalysis("wrestling-analysis", { matches: data.wrestling.slice(-20) }, "wr-analyze-out", "wr-analyze");
  });

  // jump to a sport's section (used by calendar event links)
  function goToSport(sport) {
    if (sport === "track") { showView("track"); return; }
    showView("sports");
    const sub = sport === "wrestling" ? "wrestling" : sport === "baseball" ? "baseball" : null;
    if (sub) {
      document.querySelectorAll(".subtab").forEach((b) => b.classList.toggle("active", b.dataset.sub === sub));
      document.querySelectorAll(".subview").forEach((v) => v.classList.remove("active"));
      const el = document.getElementById("sub-" + sub);
      if (el) el.classList.add("active");
    }
  }

  // ============ CONSOLIDATED CONTENT CLICKS (links, deep-links, saves) ============
  document.querySelector(".content").addEventListener("click", (e) => {
    const lb = e.target.closest(".link-btn[data-view]");
    if (lb) { showView(lb.dataset.view); return; }
    const sl = e.target.closest(".sport-link[data-sport]");
    if (sl) { goToSport(sl.dataset.sport); return; }
    const card = e.target.closest(".link-card[data-link]");
    if (card) { showView(card.dataset.link); return; }
    const saveBtn = e.target.closest("[data-va-save]");
    if (saveBtn) { saveAnalysis(saveBtn.dataset.vaSave); saveBtn.textContent = "✓ Saved"; saveBtn.disabled = true; return; }
    const vaToggle = e.target.closest(".va-saved-toggle");
    if (vaToggle) { const b = document.getElementById("va-body-" + vaToggle.dataset.id); if (b) b.hidden = !b.hidden; vaToggle.classList.toggle("open"); return; }
    const si = e.target.closest(".stat-import-btn");
    if (si) {
      const c = document.getElementById(si.dataset.sport === "baseball" ? "bb-stat-import" : "wr-stat-import");
      if (c) c.hidden = !c.hidden;
    }
  });

  // ---- one-time setup of the dynamic widgets ----
  ["baseball", "wrestling", "track"].forEach(setupVideoAnalyzer);
  ["baseball", "wrestling"].forEach(setupStatImport);

  document.body.dataset.view = "dashboard";
  render();
})();
