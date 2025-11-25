(function () {
  // ---------- HELPERS ----------
  const qs  = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  let LANG = window.LANG || "hu";

  // ---------- ÁLLAPOT ----------
  let EXERCISES = [];
  let workoutMode = null; 
  let currentDayType = null; 
  let dayTheme = "push";

  const TRAINING_SCHEDULES = {
    "Könnyű":  [1, 4],          
    "Közepes": [1, 3, 5],       
    "Nehéz":   [1, 2, 4, 5, 6]  
  };

  const WORKOUT_SPLIT = ["push", "pull", "legs"];
  const DIFFICULTY_MAP = { "Könnyű": "beginner", "Közepes": "intermediate", "Nehéz": "expert" };
  
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

  // ---------- VIEW SWITCHING ----------
  function switchView(viewName) {
    const viewCal = qs("#viewCalendar");
    const viewDay = qs("#viewDay");
    if (!viewCal || !viewDay) return;

    if (viewName === "day") {
      viewCal.classList.add("hidden");
      viewCal.classList.remove("active");
      setTimeout(() => {
        viewDay.classList.remove("hidden");
        viewDay.classList.add("active");
        viewDay.style.visibility = "visible";
      }, 50);
    } else {
      viewDay.classList.add("hidden");
      viewDay.classList.remove("active");
      setTimeout(() => {
        viewCal.classList.remove("hidden");
        viewCal.classList.add("active");
        viewCal.style.visibility = "visible";
      }, 50);
    }
  }

  // ---------- ANIMÁLT HÓNAP VÁLTÁS (ÚJ) ----------
  function handleMonthChange(direction) {
    const grid = qs("#calendarList");
    if (!grid) return;

    // 1. Kifelé animáció
    const exitClass = direction === 1 ? 'anim-slide-out-left' : 'anim-slide-out-right';
    grid.classList.add(exitClass);

    // Várjuk meg, amíg kimegy (200ms kb)
    setTimeout(() => {
      // 2. Dátum léptetés és Render
      calendarMonth.setMonth(calendarMonth.getMonth() + direction);
      renderCalendar();

      // 3. Kifelé class levétele, Befelé class rátétele
      grid.classList.remove(exitClass);
      
      const enterClass = direction === 1 ? 'anim-slide-in-right' : 'anim-slide-in-left';
      grid.classList.add(enterClass);

      // 4. Takarítás az animáció végén
      setTimeout(() => {
        grid.classList.remove(enterClass);
      }, 300);

    }, 200);
  }

  // ---------- BACKEND KOMM ----------
  async function fetchUserWorkouts() {
    try {
      const res = await fetch("/api/v1/workouts/", { headers: authHeaders() });
      if (res.ok) {
        const logs = await res.json();
        processServerLogs(logs);
      }
    } catch (err) { console.error("Edzésnapló hiba:", err); }
  }

  async function saveWorkoutToServer(dateStr, mode, dayType, mainIds, extraIds, cardioId) {
    const payload = {
      date: dateStr, mode, day_type: dayType,
      data: { main_ids: mainIds || [], extra_ids: extraIds || [], cardio_id: cardioId || null }
    };
    try {
      const res = await fetch("/api/v1/workouts/", {
        method: "POST", headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Mentés sikertelen");
      console.log("Edzés mentve!");
    } catch (err) { alert("Hiba: Nem sikerült menteni a szerverre."); }
  }

  function processServerLogs(logs) {
    logs.forEach(log => {
      const key = log.date; 
      if (log.mode === "gym") {
        const main = (log.data.main_ids || []).map(id => EXERCISES.find(e => e.id == id)).filter(Boolean);
        const extra = (log.data.extra_ids || []).map(id => EXERCISES.find(e => e.id == id)).filter(Boolean);
        calendarData[key] = { mode: "gym", dayType: log.day_type, main, extra };
      } else if (log.mode === "cardio") {
        const act = cardioActivities.find(c => c.id == log.data.cardio_id);
        if (act) calendarData[key] = { mode: "cardio", cardio: act };
      }
    });
    renderCalendar();
  }

  // ---------- HELPER ----------
  function dateKey(d) { return d.toISOString().slice(0, 10); }
  function prettyDate(d) {
    const dn = d.toLocaleDateString("hu-HU", { weekday: "long" });
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}. ${m}. ${day}. (${dn})`;
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
        if (data.training_profiles && data.training_profiles.length > 0) {
           const active = data.training_profiles.find(p => p.is_active === 1) || data.training_profiles[0];
           apiData = active.load_level;
        } else if (data.training_profile) {
           apiData = data.training_profile.load_level;
        }
        if (apiData) loadLevel = normalizeLoadLevel(apiData);
      }
    } catch (e) {}
    localStorage.setItem("athlion_load_level", loadLevel);
  }

  // ---------- ADATOK BETÖLTÉSE ----------
  async function loadGymExercises() {
    try {
      const res = await fetch("/api/v1/exercises/", { headers: authHeaders() });
      if(!res.ok) throw new Error();
      const data = await res.json();
      EXERCISES = data.map(ex => ({
        id: ex.id.toString(), name: ex.name, level: (ex.level||"").toLowerCase(),
        primaryMuscles: (ex.primary_muscles||"").split(",").map(s=>s.trim().toLowerCase())
      }));
    } catch(e) { EXERCISES = []; }
  }

  async function loadCardioActivities() {
    try {
      const res = await fetch("/api/v1/physical_activities/?limit=150", { headers: authHeaders() });
      if(!res.ok) throw new Error();
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

  // ---------- BUILDER LOGIC ----------
  function filterExercisesForContext() {
    if (workoutMode !== "gym") return [];
    return EXERCISES.filter(ex => {
        if (!currentDayType) return true;
        const prim = ex.primaryMuscles[0] || "";
        if (currentDayType === "push") return ["chest", "shoulder", "tricep"].some(m => prim.includes(m));
        if (currentDayType === "pull") return ["back", "bicep", "trap"].some(m => prim.includes(m));
        if (currentDayType === "legs") return ["quadricep", "hamstring", "glute", "calf"].some(m => prim.includes(m));
        return true;
    });
  }

  function renderExercisePool() {
    const pool = qs("#exercisePool");
    if (!pool) return;
    pool.innerHTML = "";
    const list = filterExercisesForContext();
    if(!list.length) pool.innerHTML = `<p class="muted small">Nincs elérhető gyakorlat.</p>`;
    
    list.forEach(ex => {
      const pill = document.createElement("div");
      pill.className = "exercise-pill";
      pill.draggable = !dayLocked;
      pill.innerHTML = `<span>${ex.name}</span>`;
      pill.addEventListener("dragstart", e => { if(!dayLocked) e.dataTransfer.setData("text", ex.id); });
      pill.addEventListener("click", () => { if(!dayLocked) addExerciseToBuilder("main", ex.id); });
      pool.appendChild(pill);
    });
  }

  function renderDropzones() {
    const mainZone = qs("#mainExercises");
    const extraZone = qs("#extraExercises");
    if (!mainZone) return;
    
    const renderZone = (zone, list, type) => {
        zone.innerHTML = "";
        if (!list.length) {
            zone.innerHTML = `<span class="dropzone-placeholder">${type === 'main' ? 'Fő gyakorlatok' : 'Kiegészítők'}</span>`;
        }
        list.forEach(ex => {
            const pill = document.createElement("div");
            pill.className = "exercise-pill" + (dayLocked ? " locked" : "");
            pill.textContent = ex.name;
            if(!dayLocked) pill.addEventListener("click", () => {
                if(type === 'main') mainExercises = mainExercises.filter(e => e.id !== ex.id);
                else extraExercises = extraExercises.filter(e => e.id !== ex.id);
                renderDropzones();
                updateLockButton();
            });
            zone.appendChild(pill);
        });
    };
    renderZone(mainZone, mainExercises, 'main');
    renderZone(extraZone, extraExercises, 'extra');
    
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
     renderDropzones();
  }

  // ---------- NAPTÁR ----------
  function renderCalendar() {
    const grid = qs("#calendarList");
    const monthLabel = qs("#calendarMonthLabel");
    if (!grid) return;
    // Megjegyzés: itt nem töröljük azonnal az innerHTML-t, ha animáció van,
    // de a legegyszerűbb, ha hagyjuk, és az animáció a konténeren fut.
    grid.innerHTML = "";

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
      const isToday = key === dateKey(new Date());

      let classes = ["cal-day"];
      if (isToday) classes.push("today");
      if (dayData) classes.push("has-data");
      
      let dayOfWeek = d.getDay(); 
      if (dayOfWeek === 0) dayOfWeek = 7; 
      
      if (schedule.includes(d.getDay()) || (d.getDay()===0 && schedule.includes(7))) {
          classes.push("scheduled-train-day");
      }

      cell.className = classes.join(" ");
      cell.innerHTML = `<span>${dayNum}</span><div class="dot-indicator"></div>`;

      cell.addEventListener("click", () => {
        selectCalendarDay(key);
      });

      grid.appendChild(cell);
    }
  }

  function selectCalendarDay(key) {
    selectedDateKey = key;
    const data = calendarData[key];
    const d = new Date(key);

    const label = qs("#calendarCurrentLabel");
    if(label) label.textContent = prettyDate(d);

    if (data) {
      dayLocked = true;
      if (data.mode === "gym") {
        mainExercises = [...(data.main || [])];
        extraExercises = [...(data.extra || [])];
        currentDayType = data.dayType;
        setWorkoutMode("gym");
      } else {
        cardioSelection = data.cardio;
        setWorkoutMode("cardio");
      }
    } else {
      dayLocked = false;
      mainExercises = [];
      extraExercises = [];
      cardioSelection = null;
      
      qs("#gymBuilder").style.display = "none";
      qs("#cardioBuilder").style.display = "none";
      qs("#modeGym").classList.remove("active");
      qs("#modeCardio").classList.remove("active");
      qs("#dayTypeLabel").textContent = "Válassz edzésformát!";
    }
    switchView("day");
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
        
        if (!currentDayType) {
            const gymDays = Object.values(calendarData).filter(d => d.mode === "gym").length;
            currentDayType = WORKOUT_SPLIT[gymDays % 3];
        }
        qs("#dayTypeLabel").textContent = "Mai fókusz: " + currentDayType.toUpperCase();
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
            calendarData[key] = { mode: 'gym', dayType: currentDayType, main: mainExercises, extra: extraExercises };
            saveWorkoutToServer(key, 'gym', currentDayType, mainExercises.map(e=>e.id), extraExercises.map(e=>e.id), null);
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

    qs("#modeGym")?.addEventListener("click", () => !dayLocked && setWorkoutMode("gym"));
    qs("#modeCardio")?.addEventListener("click", () => !dayLocked && setWorkoutMode("cardio"));
    
    qs("#backToCalendarBtn")?.addEventListener("click", () => {
        switchView("calendar");
        renderCalendar(); 
    });

    // ITT A LÉNYEG: handleMonthChange hívása a sima render helyett
    qs("#calendarPrev")?.addEventListener("click", () => { handleMonthChange(-1); });
    qs("#calendarNext")?.addEventListener("click", () => { handleMonthChange(1); });

    renderCalendar();
    initLockButton();
  });
})();