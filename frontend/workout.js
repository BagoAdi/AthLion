(function () {
  // ---------- HELPERS ----------
  const qs  = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  let LANG = window.LANG || "hu";

  // ---------- ÁLLAPOT ----------
  let EXERCISES = [];
  let workoutMode = null; 
  let currentDayType = null; 
  let selectedSplit = "mixed"; 

  const TRAINING_SCHEDULES = {
    "Könnyű":  [1, 4],          
    "Közepes": [1, 3, 5],       
    "Nehéz":   [1, 2, 4, 5, 6]  
  };

  const WORKOUT_SPLIT = ["push", "pull", "legs"];
  
  const LEVEL_ORDER = ["beginner", "intermediate", "expert"];
  const DIFFICULTY_MAP = {
    "Könnyű": "beginner",
    "Közepes": "intermediate",
    "Nehéz": "expert"
  };

  const SPLIT_TARGETS = {
    push: ["chest", "shoulder", "tricep"],
    pull: ["back", "bicep", "trap"],
    legs: ["quadricep", "hamstring", "glute", "calf"]
  };

  function authHeaders(extra = {}) {
    const token = localStorage.getItem("token");
    const headers = { ...extra };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  let loadLevel = "Közepes"; 
  let cardioActivities = []; 
  let cardioSelection = null;
  let mainExercises = [];  
  let extraExercises = []; 
  let dayLocked = false;
  let calendarData = {};   
  let selectedDateKey = null;
  let calendarMonth = new Date();
  calendarMonth.setDate(1);

  // ---------- DATE HELPER (JAVÍTOTT!) ----------
  // Ez volt a hiba forrása. Most már lokális időt használ, nem UTC-t.
  function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function prettyDate(d) {
    const dn = d.toLocaleDateString("hu-HU", { weekday: "long" });
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}. ${m}. ${day}. (${dn})`;
  }

  function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  // ---------- VIEW SWITCHING ----------
  function switchView(viewName) {
    const viewCal = qs("#viewCalendar");
    const viewDay = qs("#viewDay");
    if (!viewCal || !viewDay) return;

    if (viewName === "day") {
      viewCal.classList.add("view-hidden");
      viewCal.classList.remove("active");
      setTimeout(() => {
        viewDay.classList.remove("view-hidden");
        viewDay.classList.add("active");
        viewDay.style.visibility = "visible";
      }, 50);
    } else {
      viewDay.classList.add("view-hidden");
      viewDay.classList.remove("active");
      setTimeout(() => {
        viewCal.classList.remove("view-hidden");
        viewCal.classList.add("active");
        viewCal.style.visibility = "visible";
      }, 50);
    }
  }

  // ---------- POPUP KEZELÉS ----------
  function showSummaryPopup(data, dateObj) {
      const popup = qs("#dayPopup");
      const title = qs("#popupDate");
      const body = qs("#popupBody");
      
      title.textContent = prettyDate(dateObj);
      body.innerHTML = "";
      
      if (data.mode === 'gym') {
          const type = data.dayType ? data.dayType.toUpperCase() : "VEGYES";
          let html = `<div style="text-align:center; margin-bottom:15px;"><span style="background:rgba(255,255,255,0.1); padding:4px 12px; border-radius:12px; font-size:13px; color:var(--muted);">${type}</span></div>`;
          html += `<ul style="padding-left: 0; list-style:none;">`;
          if(data.main?.length) {
              html += `<li style="font-weight:700; color:var(--gold-1); margin-top:10px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px; margin-bottom:6px;">Fő gyakorlatok</li>`;
              data.main.forEach(ex => html += `<li style="padding:4px 0; color:#fff;">• ${ex.name}</li>`);
          }
          if(data.extra?.length) {
               html += `<li style="font-weight:700; color:var(--muted); margin-top:16px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px; margin-bottom:6px;">Kiegészítők</li>`;
              data.extra.forEach(ex => html += `<li style="padding:4px 0; color:var(--muted);">• ${ex.name}</li>`);
          }
          html += `</ul>`;
          body.innerHTML = html;
      } else {
          const name = data.cardio ? data.cardio.name : "Ismeretlen aktivitás";
          const met = data.cardio?.met ? data.cardio.met + " MET" : "";
          body.innerHTML = `<div style="text-align:center; padding: 20px 0;"><div style="font-size: 48px; margin-bottom:10px;">🏃</div><h4 style="margin: 0 0 6px 0; color: #fff; font-size: 20px;">${name}</h4><p class="muted" style="font-size:14px;">${met}</p></div>`;
      }
      popup.classList.remove("hidden");
  }

  function hideSummaryPopup() { qs("#dayPopup")?.classList.add("hidden"); }

  function handleMonthChange(direction) {
    const grid = qs("#calendarList");
    if (!grid) return;
    const exitClass = direction === 1 ? 'anim-slide-out-left' : 'anim-slide-out-right';
    grid.classList.add(exitClass);
    setTimeout(() => {
      calendarMonth.setMonth(calendarMonth.getMonth() + direction);
      renderCalendar();
      grid.classList.remove(exitClass);
      const enterClass = direction === 1 ? 'anim-slide-in-right' : 'anim-slide-in-left';
      grid.classList.add(enterClass);
      setTimeout(() => { grid.classList.remove(enterClass); }, 300);
    }, 200);
  }

  // ---------- BACKEND & HELPER ----------
  async function fetchUserWorkouts() {
    try {
      const res = await fetch("/api/v1/workouts/", { headers: authHeaders() });
      if (res.ok) processServerLogs(await res.json());
    } catch (err) {}
  }

  async function saveWorkoutToServer(dateStr, mode, dayType, mainIds, extraIds, cardioId) {
    const payload = {
      date: dateStr, mode, 
      day_type: (mode === 'gym') ? dayType : null, 
      data: { main_ids: mainIds || [], extra_ids: extraIds || [], cardio_id: cardioId || null }
    };
    try {
      const res = await fetch("/api/v1/workouts/", {
        method: "POST", headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Hiba");
    } catch (err) { alert("Mentési hiba!"); }
  }

  function processServerLogs(logs) {
    logs.forEach(log => {
      calendarData[log.date] = { 
          mode: log.mode, 
          dayType: log.day_type,
          main: (log.data.main_ids||[]).map(id=>EXERCISES.find(e=>e.id==id)).filter(Boolean),
          extra: (log.data.extra_ids||[]).map(id=>EXERCISES.find(e=>e.id==id)).filter(Boolean),
          cardio: cardioActivities.find(c=>c.id == log.data.cardio_id)
      };
    });
    renderCalendar();
  }

  function normalizeLoadLevel(raw) {
    if (!raw) return "Közepes";
    const s = String(raw).toLowerCase().trim();
    if (s.includes("könny") || s.includes("easy")) return "Könnyű";
    if (s.includes("nehéz") || s.includes("hard")) return "Nehéz";
    return "Közepes";
  }

  async function fetchLoadLevel() {
    try {
      const res = await fetch("/api/v1/users/me", { method: "GET", headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        let apiData = null;
        if (data.training_profiles?.length) apiData = (data.training_profiles.find(p => p.is_active === 1) || data.training_profiles[0]).load_level;
        else if (data.training_profile) apiData = data.training_profile.load_level;
        if (apiData) loadLevel = normalizeLoadLevel(apiData);
      }
    } catch (e) {}
    localStorage.setItem("athlion_load_level", loadLevel);
  }

  async function loadGymExercises() {
    try {
      const res = await fetch("/api/v1/exercises/", { headers: authHeaders() });
      const data = await res.json();
      EXERCISES = data.map(ex => ({
        id: ex.id.toString(), name: ex.name, 
        level: (ex.level||"").toLowerCase(),
        primaryMuscles: (ex.primary_muscles||"").split(",").map(s=>s.trim().toLowerCase())
      }));
    } catch(e) { EXERCISES = []; }
  }

  function getExerciseTag(ex) {
    const mus = ex.primaryMuscles[0] || "";
    const lvl = ex.level || "";
    return `${mus} • ${lvl}`; 
  }

  async function loadCardioActivities() {
    try {
      const res = await fetch("/api/v1/physical_activities/?limit=150", { headers: authHeaders() });
      const data = await res.json();
      cardioActivities = data.filter(a => !a.name.toLowerCase().includes("lawn"));
    } catch(e) { cardioActivities = []; }
  }

  function renderCardioList() {
    const container = qs("#cardioList");
    if (!container) return;
    container.innerHTML = "";
    cardioActivities.forEach(act => {
      const div = document.createElement("div");
      div.className = "cardio-item" + (cardioSelection?.id === act.id ? " selected" : "");
      div.innerHTML = `<span>${act.name}</span><span class="muted small">${act.met ? act.met + " MET" : ""}</span>`;
      div.addEventListener("click", () => {
        cardioSelection = act;
        renderCardioList(); 
        updateLockButton();
      });
      container.appendChild(div);
    });
  }

  function levelAllowed(userLv, exLv) {
    if (!exLv) return true; 
    const uIndex = LEVEL_ORDER.indexOf(userLv);
    const eIndex = LEVEL_ORDER.indexOf(exLv);
    if (uIndex === -1 || eIndex === -1) return true; 
    return eIndex <= uIndex; 
  }

  // ---------- SMART ALGORITMUS ----------
  function calculateDayType(dateObj) {
    const schedule = TRAINING_SCHEDULES[loadLevel] || [1, 3, 5];
    let dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0) dayOfWeek = 7;

    if (!schedule.includes(dateObj.getDay()) && !(dateObj.getDay()===0 && schedule.includes(7))) {
       return null; 
    }
    const weekNum = getWeekNumber(dateObj);
    const scheduleIndex = schedule.indexOf(dayOfWeek === 7 ? 0 : dayOfWeek); 
    const globalIndex = (weekNum * schedule.length) + (scheduleIndex !== -1 ? scheduleIndex : 0);
    return WORKOUT_SPLIT[globalIndex % 3];
  }

  function getSmartRecommendations(pool) {
    const coveredMuscles = new Set();
    mainExercises.forEach(ex => { ex.primaryMuscles.forEach(m => coveredMuscles.add(m)); });
    const targetType = (selectedSplit === 'mixed') ? currentDayType : selectedSplit;
    const requiredMuscles = (targetType && SPLIT_TARGETS[targetType]) ? SPLIT_TARGETS[targetType] : [];
    const missingMuscles = requiredMuscles.filter(m => !coveredMuscles.has(m));

    const priorityList = pool.filter(ex => ex.primaryMuscles.some(m => missingMuscles.includes(m)));
    const otherList = pool.filter(ex => !priorityList.includes(ex));
    const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
    return [...shuffle(priorityList), ...shuffle(otherList)].slice(0, 3);
  }

  // ---------- BUILDER LOGIC ----------
  function setupSplitSelector() {
      const container = qs("#splitSelectorContainer");
      if(!container) return;
      container.addEventListener("click", (e) => {
          if(e.target.classList.contains("split-btn")) {
              selectedSplit = e.target.dataset.type;
              updateSplitSelectorUI();
              renderExercisePool(); 
          }
      });
  }

  function updateSplitSelectorUI() {
      const btns = qsa(".split-btn");
      btns.forEach(b => {
          if(b.dataset.type === selectedSplit) b.classList.add("active");
          else b.classList.remove("active");
      });
  }

  function filterExercisesForContext() {
    if (workoutMode !== "gym") return [];
    
    const userDiff = DIFFICULTY_MAP[loadLevel] || "intermediate";
    let filtered = EXERCISES.filter(ex => levelAllowed(userDiff, ex.level)); // SZINT SZŰRÉS VISSZATÉRT

    if (selectedSplit === "mixed") return filtered;

    return filtered.filter(ex => {
        const prim = ex.primaryMuscles[0] || "";
        if (selectedSplit === "push") return ["chest", "shoulder", "tricep"].some(m => prim.includes(m));
        if (selectedSplit === "pull") return ["back", "bicep", "trap"].some(m => prim.includes(m));
        if (selectedSplit === "legs") return ["quadricep", "hamstring", "glute", "calf", "adductor"].some(m => prim.includes(m));
        return true;
    });
  }

  function renderExercisePool() {
    const pool = qs("#exercisePool");
    if (!pool) return;
    pool.innerHTML = "";
    const list = filterExercisesForContext();
    
    if(!list.length) {
       pool.innerHTML = `<p class="muted small">Nincs találat a szűrők alapján.</p>`;
       return;
    }
    list.forEach(ex => {
      const pill = document.createElement("div");
      pill.className = "exercise-pill";
      pill.draggable = !dayLocked;
      pill.innerHTML = `<span>${ex.name}</span><span class="tag">${getExerciseTag(ex)}</span>`;
      pill.addEventListener("dragstart", e => { if(!dayLocked) e.dataTransfer.setData("text", ex.id); });
      pill.addEventListener("click", () => { if(!dayLocked) addExerciseToBuilder("main", ex.id); });
      pool.appendChild(pill);
    });
  }

  function renderDropzones() {
    const mainZone = qs("#mainExercises");
    const extraZone = qs("#extraExercises");
    if (!mainZone) return;
    const renderZone = (zone, list) => {
        zone.innerHTML = "";
        if (!list.length) zone.innerHTML = `<span class="dropzone-placeholder">Húzd ide a gyakorlatot</span>`;
        list.forEach(ex => {
            const pill = document.createElement("div");
            pill.className = "exercise-pill" + (dayLocked ? " locked" : "");
            pill.textContent = ex.name;
            if(!dayLocked) pill.addEventListener("click", () => {
                if(zone.id === 'mainExercises') mainExercises = mainExercises.filter(e => e.id !== ex.id);
                else extraExercises = extraExercises.filter(e => e.id !== ex.id);
                renderDropzones();
                updateLockButton();
            });
            zone.appendChild(pill);
        });
    };
    renderZone(mainZone, mainExercises);
    renderZone(extraZone, extraExercises);
    [mainZone, extraZone].forEach(zone => {
       zone.ondragover = e => { e.preventDefault(); zone.classList.add("active"); };
       zone.ondragleave = () => zone.classList.remove("active");
       zone.ondrop = e => {
           e.preventDefault(); zone.classList.remove("active");
           if(dayLocked) return;
           addExerciseToBuilder(zone.id === "mainExercises" ? "main" : "extra", e.dataTransfer.getData("text"));
       };
    });
    updateLockButton();
  }

  function addExerciseToBuilder(slot, id) {
     const ex = EXERCISES.find(e => e.id === id);
     if(!ex) return;
     if([...mainExercises, ...extraExercises].some(e => e.id === id)) return;
     if (slot === "main" && mainExercises.length < 3) mainExercises.push(ex);
     else if (slot === "extra" && (mainExercises.length + extraExercises.length < 6)) extraExercises.push(ex);
     
     if (mainExercises.length === 3 && extraExercises.length === 0) {
        const pool = filterExercisesForContext().filter(e => !mainExercises.some(m => m.id === e.id));
        extraExercises = getSmartRecommendations(pool);
     }
     renderDropzones();
     updateLockButton();
  }

  // ---------- NAPTÁR RENDER ----------
  function renderCalendar() {
    const grid = qs("#calendarList");
    const monthLabel = qs("#calendarMonthLabel");
    if (!grid) return;
    grid.innerHTML = "";

    const today = new Date();
    const todayKey = dateKey(today); // Most már helyes, pl. "2025-11-25"

    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const firstOfMonth = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const jsDay = firstOfMonth.getDay(); 
    const offset = (jsDay === 0 ? 6 : jsDay - 1);

    if (monthLabel) monthLabel.textContent = firstOfMonth.toLocaleDateString("hu-HU", { year: "numeric", month: "long" });
    const schedule = TRAINING_SCHEDULES[loadLevel] || [1, 3, 5];

    for (let i = 0; i < 42; i++) {
      const cell = document.createElement("div");
      const dayNum = i - offset + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        cell.className = "cal-day empty";
        grid.appendChild(cell);
        continue;
      }
      const d = new Date(y, m, dayNum);
      const key = dateKey(d);
      const dayData = calendarData[key];
      
      let classes = ["cal-day"];
      if (key === todayKey) classes.push("today"); // MAI NAP JELÖLÉS
      if (dayData) classes.push("has-data");
      
      let dayOfWeek = d.getDay(); 
      if (dayOfWeek === 0) dayOfWeek = 7; 
      if (schedule.includes(d.getDay()) || (d.getDay()===0 && schedule.includes(7))) {
          classes.push("scheduled-train-day");
      }

      cell.className = classes.join(" ");
      cell.innerHTML = `<span>${dayNum}</span><div class="dot-indicator"></div>`;
      cell.addEventListener("click", () => { selectCalendarDay(key); });
      grid.appendChild(cell);
    }
  }

  function selectCalendarDay(key) {
    selectedDateKey = key;
    const data = calendarData[key];
    
    // Dátum objektum létrehozása manuálisan a sztringből a biztonság kedvéért
    // Hogy elkerüljük az újabb UTC/Local csúszást
    const parts = key.split('-');
    const d = new Date(parts[0], parts[1] - 1, parts[2]); 

    const label = qs("#calendarCurrentLabel");
    if(label) label.textContent = prettyDate(d);

    if (data) {
      showSummaryPopup(data, d);
    } else {
      dayLocked = false;
      mainExercises = [];
      extraExercises = [];
      cardioSelection = null;
      
      currentDayType = calculateDayType(d);

      if(currentDayType) {
          selectedSplit = currentDayType;
          qs("#dayTypeLabel").textContent = "Tervezett edzésnap: " + currentDayType.toUpperCase();
      } else {
          selectedSplit = "mixed";
          qs("#dayTypeLabel").textContent = "Pihenőnap (szabadon választható edzés)";
      }

      qs("#gymBuilder").style.display = "none";
      qs("#cardioBuilder").style.display = "none";
      qs("#modeGym").classList.remove("active");
      qs("#modeCardio").classList.remove("active");
      
      updateSplitSelectorUI(); 
      switchView("day");
    }
  }

  function setWorkoutMode(mode) {
    workoutMode = mode;
    const btnGym = qs("#modeGym");
    const btnCardio = qs("#modeCardio");
    if(mode === "gym") {
        btnGym.classList.add("active");
        btnCardio.classList.remove("active");
        qs("#gymBuilder").style.display = "block";
        qs("#cardioBuilder").style.display = "none";
        renderExercisePool();
        renderDropzones();
    } else {
        btnCardio.classList.add("active");
        btnGym.classList.remove("active");
        qs("#cardioBuilder").style.display = "block";
        qs("#gymBuilder").style.display = "none";
        qs("#dayTypeLabel").textContent = "Kardió edzés";
        renderCardioList();
    }
    updateLockButton();
  }

  function updateLockButton() {
      const btn = qs("#lockDayBtn");
      if(!btn) return;
      if (dayLocked) {
          btn.textContent = "Nap lezárva";
          btn.disabled = true;
      } else {
          btn.textContent = "Nap lezárása";
          if (workoutMode === "gym") btn.disabled = mainExercises.length < 3;
          else if (workoutMode === "cardio") btn.disabled = !cardioSelection;
          else btn.disabled = true;
      }
  }

  function initLockButton() {
    qs("#lockDayBtn")?.addEventListener("click", () => {
        if(dayLocked) return;
        const key = selectedDateKey;
        if(workoutMode === 'gym') {
            calendarData[key] = { mode: 'gym', dayType: selectedSplit, main: mainExercises, extra: extraExercises };
            saveWorkoutToServer(key, 'gym', selectedSplit, mainExercises.map(e=>e.id), extraExercises.map(e=>e.id), null);
        } else {
            calendarData[key] = { mode: 'cardio', cardio: cardioSelection };
            saveWorkoutToServer(key, 'cardio', null, [], [], cardioSelection.id);
        }
        dayLocked = true;
        updateLockButton();
        renderCalendar(); 
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await fetchLoadLevel();
    await loadGymExercises();
    await loadCardioActivities();
    await fetchUserWorkouts();

    setupSplitSelector(); 

    qs("#modeGym")?.addEventListener("click", () => !dayLocked && setWorkoutMode("gym"));
    qs("#modeCardio")?.addEventListener("click", () => !dayLocked && setWorkoutMode("cardio"));
    qs("#backToCalendarBtn")?.addEventListener("click", () => { switchView("calendar"); renderCalendar(); });
    qs("#calendarPrev")?.addEventListener("click", () => { handleMonthChange(-1); });
    qs("#calendarNext")?.addEventListener("click", () => { handleMonthChange(1); });
    qs("#closePopupBtn")?.addEventListener("click", hideSummaryPopup);
    qs("#dayPopup")?.addEventListener("click", (e) => { if(e.target === qs("#dayPopup")) hideSummaryPopup(); });

    renderCalendar();
    initLockButton();
  });
})();