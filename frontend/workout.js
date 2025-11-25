(function () {
  // ---------- HELPERS ----------
  const qs  = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  let LANG = window.LANG || "hu";

  // ---------- ÁLLAPOT ----------

  // backendről jövő gyakorlatok (csak edzőterem mód)
  let EXERCISES = [];

  // aktuális mód: 'gym' vagy 'cardio' vagy null
  let workoutMode = null;

  // aktuális edzésnap téma: push | pull | legs
  let dayTheme = "push";
  let currentDayType = null;

  // Heti terhelés schedule (backend: training_profile.load_level)
  const TRAINING_SCHEDULES = {
    "Könnyű":  [1, 4],          // H, Cs
    "Közepes": [1, 3, 5],       // H, Sze, P
    "Nehéz":   [1, 2, 4, 5, 6]  // H, K, Cs, P, Szo
  };

  // Push–Pull–Legs ciklus
  const WORKOUT_SPLIT = ["push", "pull", "legs"];

  // Szint mapping (hu -> english)
  const DIFFICULTY_MAP = {
    "Könnyű": "beginner",
    "Közepes": "intermediate",
    "Nehéz": "expert"
  };

  function normalizeLoadLevel(raw) {
    if (!raw) return "Közepes";
    const s = String(raw).toLowerCase().trim();

    if (
      s.includes("könny") ||
      s.includes("konny") ||
      s.includes("easy") ||
      s.includes("light")
    ) {
      return "Könnyű";
    }

    if (
      s.includes("nehéz") ||
      s.includes("nehez") ||
      s.includes("hard") ||
      s.includes("heavy")
    ) {
      return "Nehéz";
    }

    return "Közepes";
  }
  
  function authHeaders(extra = {}) {
    const token = localStorage.getItem("token");
    const headers = { ...extra };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  let loadLevel = null; // "Könnyű" | "Közepes" | "Nehéz"

  // Kardió adatok
  let cardioActivities = []; // /physical_activities
  let cardioSelection = null;

  // Builder state
  let mainExercises = [];  // max 3 fő
  let extraExercises = []; // max +3 kiegészítő
  let dayLocked = false;

  // Naptár state
  let calendarData = {};   // { 'YYYY-MM-DD': { mode, dayType, main, extra, cardio } }
  let selectedDateKey = null;

  // opcionális: ha auth kódból beállítod:
  // window.AthlionRegistrationDate = "2025-11-10T00:00:00Z";
  let registrationDate = window.AthlionRegistrationDate
    ? new Date(window.AthlionRegistrationDate)
    : null;

  // melyik hónap van épp megjelenítve (első napra állítva)
  let calendarMonth = new Date();
  calendarMonth.setDate(1);
  // ---------- WORKOUTS BACKEND KOMM ----------

  async function fetchUserWorkouts() {
    try {
      const res = await fetch("/api/v1/workouts/", {
        headers: authHeaders()
      });
      if (res.ok) {
        const logs = await res.json();
        console.log("Letöltött edzések:", logs);
        processServerLogs(logs);
      }
    } catch (err) {
      console.error("Nem sikerült betölteni az edzésnaplót:", err);
    }
  }

  async function saveWorkoutToServer(dateStr, mode, dayType, mainIds, extraIds, cardioId) {
    const payload = {
      date: dateStr,
      mode: mode,
      day_type: dayType, // lehet null
      data: {
        main_ids: mainIds || [],
        extra_ids: extraIds || [],
        cardio_id: cardioId || null
      }
    };

    try {
      const res = await fetch("/api/v1/workouts/", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Mentés sikertelen");
      console.log("Edzés sikeresen mentve!");
    } catch (err) {
      console.error("Hiba a mentéskor:", err);
      alert("Hiba: Nem sikerült menteni a szerverre. Ellenőrizd a kapcsolatot!");
    }
  }

  function processServerLogs(logs) {
    // A szerverről jövő adatokat visszaalakítjuk a frontend formátumára (calendarData)
    logs.forEach(log => {
      const key = log.date; // YYYY-MM-DD
      
      if (log.mode === "gym") {
        // ID-k alapján megkeressük a teljes gyakorlat objektumokat
        const main = (log.data.main_ids || []).map(id => EXERCISES.find(e => e.id == id)).filter(Boolean);
        const extra = (log.data.extra_ids || []).map(id => EXERCISES.find(e => e.id == id)).filter(Boolean);
        
        calendarData[key] = {
          mode: "gym",
          dayType: log.day_type,
          main: main,
          extra: extra
        };
      } else if (log.mode === "cardio") {
        const act = cardioActivities.find(c => c.id == log.data.cardio_id);
        if (act) {
          calendarData[key] = {
            mode: "cardio",
            cardio: act
          };
        }
      }
    });
    
    // Frissítjük a naptárat, hogy látszódjanak a betöltött napok
    renderCalendar();
    
    // Ha a mai napra volt mentés, töltsük be
    if (calendarData[selectedDateKey]) {
        selectCalendarDay(selectedDateKey);
    }
  }

  // ---------- KÖZÖS DATE HELPER ----------

  function dateKey(d) {
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  function prettyDate(d) {
    const dn = d.toLocaleDateString("hu-HU", { weekday: "short" });
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}. ${m}. ${day}. (${dn})`;
  }

  // ---------- LOAD LEVEL NORMALIZÁLÁS ----------

  // Backend bármit visszaadhat: "Könnyű", "konnyu", "easy", "light", "medium", "hard" stb.
  // Ebből mindig: "Könnyű" | "Közepes" | "Nehéz" lesz.
  function normalizeLoadLevel(raw) {
    if (!raw) return "Közepes";
    const s = String(raw).toLowerCase().trim();

    // könnyű / easy / light
    if (
      s.includes("könny") ||
      s.includes("konny") ||
      s.includes("easy") ||
      s.includes("light")
    ) {
      return "Könnyű";
    }

    // nehéz / hard / heavy
    if (
      s.includes("nehéz") ||
      s.includes("nehez") ||
      s.includes("hard") ||
      s.includes("heavy")
    ) {
      return "Nehéz";
    }

    // minden más → közepes (medium / moderate / stb.)
    return "Közepes";
  }

   // ---------- USER LOAD LEVEL ----------

// frontend/workout.js - Cseréld le a fetchLoadLevel függvényt erre:

  // frontend/workout.js - fetchLoadLevel JAVÍTOTT verzió

  async function fetchLoadLevel() {
    let apiData = null;

    try {
      // JAVÍTÁS: Hozzáadtuk a headers-t, hogy a tokent is elküldje!
      const res = await fetch("/api/v1/users/me", {
        method: "GET",
        headers: authHeaders(), // <--- EZ HIÁNYZOTT! Enélkül 401-et kapsz.
        credentials: "include"
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log("Profile Data (Server):", data);

        // --- ADATFELDOLGOZÁS ---
        if (data.training_profiles && Array.isArray(data.training_profiles)) {
          const activeProfile = data.training_profiles.find(p => p.is_active === 1);
          
          if (activeProfile) {
            apiData = activeProfile.load_level;
          } else if (data.training_profiles.length > 0) {
            apiData = data.training_profiles[0].load_level;
          }
        }
        else if (data.training_profile && typeof data.training_profile === "object") {
          apiData = data.training_profile.load_level;
        }
      } else {
        // Ha 401 van, akkor lehet, hogy lejárt a bejelentkezés
        if (res.status === 401) {
            console.warn("Lejárt a bejelentkezés, vagy hiányzik a token.");
        }
      }
    } catch (err) {
      console.warn("Backend fetch failed, using fallback:", err);
    }

    // 2. ÉRTÉK BEÁLLÍTÁSA
    if (apiData) {
      loadLevel = normalizeLoadLevel(apiData);
      localStorage.setItem("athlion_load_level", loadLevel);
      console.log("LoadLevel updated from Server:", loadLevel);
    } else {
      const stored = localStorage.getItem("athlion_load_level");
      if (stored) {
        loadLevel = normalizeLoadLevel(stored);
      } else {
        loadLevel = "Közepes";
      }
    }
  }

  // ---------- EDZŐTEREM GYAKORLATOK ----------

  async function loadGymExercises() {
    try {
      const res = await fetch("/api/v1/exercises/", {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Hiba az edzésgyakorlatok lekérésénél");

      const data = await res.json();
      // Backend: {id, name, level, force, primary_muscles, ...}
      EXERCISES = data.map(ex => ({
        id: ex.id.toString(),
        name: ex.name,
        level: (ex.level || "").toLowerCase(), // "beginner" / "intermediate" / "expert"
        force: ex.force || null,
        primaryMuscles: (ex.primary_muscles || "")
          .split(",")
          .map(s => s.trim())
          .filter(Boolean)
          .map(s => s.toLowerCase()),
        category: (ex.category || "").toLowerCase()
      }));

      renderExercisePool();
    } catch (err) {
      console.error(err);
      EXERCISES = [];
      renderExercisePool();
    }
  }

  // ---------- KARDIÓ AKTIVITÁSOK ----------

  async function loadCardioActivities() {
    try {
      const res = await fetch("/api/v1/physical_activities/?limit=150", {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Hiba a kardió aktivitások lekérésénél");
      const data = await res.json();

      // Szűrés: ne legyenek kertészkedés / házimunka jellegű aktivitások
      cardioActivities = data.filter(a => {
        const name = (a.name || "").toLowerCase();
        return !name.includes("lawn")
            && !name.includes("garden")
            && !name.includes("household");
      });

      renderCardioList();
    } catch (err) {
      console.error(err);
      cardioActivities = [];
      renderCardioList();
    }
  }

  function renderCardioList() {
    const container = qs("#cardioList");
    if (!container) return;

    container.innerHTML = "";

    if (!cardioActivities.length) {
      const p = document.createElement("p");
      p.className = "muted small";
      p.textContent = "Nincs elérhető kardió aktivitás.";
      container.appendChild(p);
      return;
    }

    cardioActivities.forEach(act => {
      const div = document.createElement("div");
      div.className = "cardio-item";

      div.innerHTML = `
        <span>${act.name}</span>
        <span class="muted small">${act.met ? act.met + " MET" : ""}</span>
      `;

      div.addEventListener("click", () => {
        cardioSelection = act;
        qsa(".cardio-item", container).forEach(el => el.classList.remove("selected"));
        div.classList.add("selected");
        updateLockButton();
      });

      container.appendChild(div);
    });
  }

  // ---------- SZINT & THEME SZŰRÉS ----------

  function levelAllowed(userLv, exLv) {
    if (!exLv) return true; // ha nincs szint a gyakszinál, ne dobjuk ki

    const order = ["beginner", "intermediate", "expert"];

    const u = order.indexOf(userLv);
    const e = order.indexOf(exLv);

    if (u === -1 || e === -1) return true; // ismeretlen string, engedjük át
    return e <= u;  // csak az ő szintjéig engedjük
  }

  function filterExercisesForContext() {
    if (workoutMode !== "gym") return [];

    const userDiff = DIFFICULTY_MAP[loadLevel] || null; // 'beginner' | 'intermediate' | 'expert'

    return EXERCISES.filter(ex => {
      // --- nehézség szűrés (user szint + alatta lévők) ---
      if (userDiff && ex.level && !levelAllowed(userDiff, ex.level)) {
        return false;
      }

      // --- push / pull / legs szűrés ---
      if (!currentDayType) return true;

      const prim = ex.primaryMuscles[0] || "";
      if (!prim) return true;

      if (currentDayType === "push") {
        return ["chest", "shoulder", "tricep"].some(m => prim.includes(m));
      }
      if (currentDayType === "pull") {
        return ["back", "bicep", "trap"].some(m => prim.includes(m));
      }
      if (currentDayType === "legs") {
        return ["quadricep", "hamstring", "glute", "calf", "adductor"]
          .some(m => prim.includes(m));
      }

      return true;
    });
  }

  function getExerciseTag(ex) {
    const level = ex.level || "";
    const prim = ex.primaryMuscles[0] || "";
    if (level && prim) return `${prim} · ${level}`;
    if (prim) return prim;
    if (level) return level;
    return "";
  }

  // ---------- GYAKORLATLISTA RENDER ----------

  function renderExercisePool() {
    if (workoutMode !== "gym") return;
    const pool = qs("#exercisePool");
    if (!pool) return;

    pool.innerHTML = "";

    const list = filterExercisesForContext();

    if (!list.length) {
      const p = document.createElement("p");
      p.className = "muted small";
      p.textContent = "Ehhez a naphoz nincs elérhető gyakorlat.";
      pool.appendChild(p);
      return;
    }

    list.forEach(ex => {
      const pill = document.createElement("div");
      pill.className = "exercise-pill";
      pill.draggable = !dayLocked;
      pill.dataset.id = ex.id;

      const tag = getExerciseTag(ex);

      pill.innerHTML = `
        <span>${ex.name}</span>
        <span class="tag">${tag}</span>
      `;

      pill.addEventListener("dragstart", e => {
        if (dayLocked) { e.preventDefault(); return; }
        e.dataTransfer.setData("text/plain", ex.id);
      });

      pill.addEventListener("click", () => {
        if (dayLocked) return;
        addExerciseToBuilder("main", ex.id);
      });

      pool.appendChild(pill);
    });
  }

  // ---------- NAP TÍPUS (PPL CIKLUS) ----------

  function determineDayTypeForNewGymDay() {
    const gymDaysSoFar = Object.values(calendarData).filter(d => d.mode === "gym").length;
    currentDayType = WORKOUT_SPLIT[gymDaysSoFar % WORKOUT_SPLIT.length];
    updateDayTypeLabel();
  }

  function updateDayTypeLabel() {
    const label = qs("#dayTypeLabel");
    if (!label) return;

    const mapHu = {
      push: "Push day (mell/váll/tricepsz)",
      pull: "Pull day (hát/bicepsz)",
      legs: "Leg day (láb)"
    };

    if (dayLocked && workoutMode === "gym" && currentDayType) {
      label.textContent = `Mai edzésnap: ${mapHu[currentDayType] || currentDayType}`;
    } else if (!workoutMode) {
      label.textContent = "Válaszd ki a módot a fenti gombokkal.";
    } else if (workoutMode === "cardio") {
      label.textContent = "Kardió nap – válassz egy aktivitást a listából.";
    } else if (workoutMode === "gym" && currentDayType) {
      label.textContent = `Mai edzésnap: ${mapHu[currentDayType] || currentDayType}`;
    } else {
      label.textContent = "";
    }
  }

  // ---------- WORKOUT MODE VÁLTÁS ----------

  function setWorkoutMode(mode) {
    if (dayLocked && selectedDateKey && calendarData[selectedDateKey]) {
      // lezárt napnál ne lehessen módot váltani
      return;
    }

    workoutMode = mode;
    cardioSelection = null;

    const gymBuilder    = qs("#gymBuilder");
    const cardioBuilder = qs("#cardioBuilder");
    const btnCardio     = qs("#modeCardio");
    const btnGym        = qs("#modeGym");

    [btnCardio, btnGym].forEach(btn => btn && btn.classList.remove("active"));

    if (mode === "gym") {
      btnGym && btnGym.classList.add("active");
      if (gymBuilder)   gymBuilder.style.display = "";
      if (cardioBuilder) cardioBuilder.style.display = "none";

      if (!calendarData[selectedDateKey]) {
        determineDayTypeForNewGymDay();
      }

      renderExercisePool();
      renderDropzones();
    } else if (mode === "cardio") {
      btnCardio && btnCardio.classList.add("active");
      if (cardioBuilder) cardioBuilder.style.display = "";
      if (gymBuilder)    gymBuilder.style.display = "none";

      renderCardioList();
    } else {
      if (gymBuilder)    gymBuilder.style.display = "none";
      if (cardioBuilder) cardioBuilder.style.display = "none";
    }

    updateDayTypeLabel();
    updateLockButton();
  }

  function setupModeSelector() {
    const btnCardio = qs("#modeCardio");
    const btnGym    = qs("#modeGym");

    if (btnCardio) {
      btnCardio.addEventListener("click", () => {
        setWorkoutMode("cardio");
      });
    }

    if (btnGym) {
      btnGym.addEventListener("click", () => {
        setWorkoutMode("gym");
      });
    }
  }

  // ---------- DROPZÓNÁK + RANDOM EXTRA ----------

  function renderDropzones() {
    if (workoutMode !== "gym") return;

    const mainZone = qs("#mainExercises");
    const extraZone = qs("#extraExercises");
    const info = qs("#lockInfo");

    if (!mainZone || !extraZone) return;

    // fő
    mainZone.innerHTML = "";
    if (!mainExercises.length) {
      const sp = document.createElement("span");
      sp.className = "dropzone-placeholder";
      sp.textContent = "Húzd ide a fő gyakorlatokat";
      mainZone.appendChild(sp);
    } else {
      mainExercises.forEach(ex => {
        const pill = document.createElement("div");
        pill.className = "exercise-pill" + (dayLocked ? " locked" : "");
        pill.textContent = ex.name;

        if (!dayLocked) {
          pill.addEventListener("click", () => {
            mainExercises = mainExercises.filter(e => e.id !== ex.id);
            renderDropzones();
            updateLockButton();
          });
        }

        mainZone.appendChild(pill);
      });
    }

    // extra
    extraZone.innerHTML = "";
    if (!extraExercises.length) {
      const sp = document.createElement("span");
      sp.className = "dropzone-placeholder";
      sp.textContent = "Ha megvan a 3 fő gyakorlat, automatikusan ajánlunk +3-at ide.";
      extraZone.appendChild(sp);
    } else {
      extraExercises.forEach(ex => {
        const pill = document.createElement("div");
        pill.className = "exercise-pill" + (dayLocked ? " locked" : "");
        pill.textContent = ex.name;

        if (!dayLocked) {
          pill.addEventListener("click", () => {
            extraExercises = extraExercises.filter(e => e.id !== ex.id);
            renderDropzones();
            updateLockButton();
          });
        }

        extraZone.appendChild(pill);
      });
    }

    // drag & drop
    [mainZone, extraZone].forEach(zone => {
      zone.classList.toggle("locked", dayLocked);

      zone.ondragover = e => {
        if (dayLocked) return;
        e.preventDefault();
        zone.classList.add("active");
      };
      zone.ondragleave = () => zone.classList.remove("active");
      zone.ondrop = e => {
        if (dayLocked) return;
        e.preventDefault();
        zone.classList.remove("active");
        const id = e.dataTransfer.getData("text/plain");
        const slot = zone.id === "mainExercises" ? "main" : "extra";
        addExerciseToBuilder(slot, id);
      };
    });

    if (info) {
      info.textContent = dayLocked
        ? "Ez a nap lezárva. A naptárból visszanézheted, de nem módosítható."
        : "Válassz ki legalább 3 gyakorlatot a nap lezárásához.";
    }

    updateLockButton();
  }

  function shuffle(array) {
    return array
      .map(a => ({ sort: Math.random(), value: a }))
      .sort((a, b) => a.sort - b.sort)
      .map(a => a.value);
  }

  function addExerciseToBuilder(slot, id) {
    const ex = EXERCISES.find(e => e.id === id);
    if (!ex) return;

    const already = [...mainExercises, ...extraExercises].some(e => e.id === id);
    if (already) return;

    if (slot === "main") {
      if (mainExercises.length >= 3) return;
      mainExercises.push(ex);
    } else {
      if (mainExercises.length + extraExercises.length >= 6) return;
      extraExercises.push(ex);
    }

    // ha épp most lett meg a 3 fő és még nincs extra → random +3 ajánló
    if (mainExercises.length === 3 && extraExercises.length === 0) {
      const pool = filterExercisesForContext().filter(e =>
        !mainExercises.some(m => m.id === e.id)
      );
      const shuffled = shuffle(pool);
      extraExercises = shuffled.slice(0, 3);
    }

    renderDropzones();
    updateLockButton();
  }

  // ---------- NAPTÁR ----------

  function renderCalendar() {
    const grid = qs("#calendarList");
    const label = qs("#calendarCurrentLabel");
    const monthLabel = qs("#calendarMonthLabel");
    if (!grid) return;

    grid.innerHTML = "";

    const today = new Date();
    if (!selectedDateKey) {
      selectedDateKey = dateKey(today);
    }

    if (!calendarMonth) {
      const sel = new Date(selectedDateKey);
      calendarMonth = new Date(sel.getFullYear(), sel.getMonth(), 1);
    }

    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const firstOfMonth = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const trainingDays = TRAINING_SCHEDULES[loadLevel] || [];

    // hétfő-első offset (0 = hétfő, 6 = vasárnap)
    const jsDay = firstOfMonth.getDay();      // 0 = vasárnap
    const offset = (jsDay + 6) % 7;           // 0 = hétfő

    if (monthLabel) {
      monthLabel.textContent = firstOfMonth.toLocaleDateString("hu-HU", {
        year: "numeric",
        month: "long"
      });
    }

    for (let i = 0; i < 42; i++) {
      const cell = document.createElement("div");
      const dayNum = i - offset + 1;

      if (dayNum < 1 || dayNum > daysInMonth) {
        cell.className = "calendar-day empty";
        grid.appendChild(cell);
        continue;
      }

      const d = new Date(y, m, dayNum);
      const key = dateKey(d);
      const dayData = calendarData[key];
      const isSelected = key === selectedDateKey;
      const isToday = key === dateKey(today);

      cell.className = "calendar-day";

      const wd = d.getDay(); // 0=V,1=H,2=K...
      const isTrainingDay = trainingDays.includes(wd);

      if (isTrainingDay) {
        cell.classList.add("train-day");
      } else {
        cell.classList.add("rest-day");
      }

      if (isSelected) cell.classList.add("active");
      if (dayData) {
        cell.classList.add("filled");
        if (dayData.mode === "gym") {
          cell.classList.add("gym-day");
        } else if (dayData.mode === "cardio") {
          cell.classList.add("cardio-day");
        }
      }
      if (isToday) cell.classList.add("today");

      // összegzés: hány gyakorlat
      let summary = "";
      if (dayData) {
        const count = (dayData.main?.length || 0) + (dayData.extra?.length || 0);
        if (count > 0) summary = `${count} gyakorlat`;
      }

      cell.dataset.dateKey = key;
      cell.innerHTML = `
        <div class="calendar-date">
          <span class="calendar-dayname">${d.toLocaleDateString("hu-HU", { weekday: "short" })}</span>
          <span class="calendar-datenum">${dayNum}</span>
        </div>
        <div class="calendar-summary">${summary}</div>
      `;

      cell.addEventListener("click", () => {
        selectCalendarDay(key);
      });

      grid.appendChild(cell);
    }

    if (label) {
      label.textContent = prettyDate(new Date(selectedDateKey));
    }
  }

  function selectCalendarDay(key) {
    selectedDateKey = key;
    const data = calendarData[key];
    const d = new Date(key);

    calendarMonth = new Date(d.getFullYear(), d.getMonth(), 1);

    if (data) {
      dayLocked = true;
      workoutMode = data.mode || null;

      if (workoutMode === "gym") {
        mainExercises = [...(data.main || [])];
        extraExercises = [...(data.extra || [])];
        currentDayType = data.dayType || null;

        const gymBuilder = qs("#gymBuilder");
        const cardioBuilder = qs("#cardioBuilder");
        if (gymBuilder)      gymBuilder.style.display = "";
        if (cardioBuilder)   cardioBuilder.style.display = "none";
        qs("#modeGym")?.classList.add("active");
        qs("#modeCardio")?.classList.remove("active");

        renderExercisePool();
        renderDropzones();
      } else if (workoutMode === "cardio") {
        cardioSelection = data.cardio || null;

        const gymBuilder = qs("#gymBuilder");
        const cardioBuilder = qs("#cardioBuilder");
        if (cardioBuilder)   cardioBuilder.style.display = "";
        if (gymBuilder)      gymBuilder.style.display = "none";
        qs("#modeCardio")?.classList.add("active");
        qs("#modeGym")?.classList.remove("active");

        renderCardioList();
      }
    } else {
      // új nap
      dayLocked = false;
      workoutMode = null;
      currentDayType = null;
      mainExercises = [];
      extraExercises = [];
      cardioSelection = null;

      const gymBuilder = qs("#gymBuilder");
      const cardioBuilder = qs("#cardioBuilder");
      if (gymBuilder)      gymBuilder.style.display = "none";
      if (cardioBuilder)   cardioBuilder.style.display = "none";

      qs("#modeCardio")?.classList.remove("active");
      qs("#modeGym")?.classList.remove("active");

      renderExercisePool();
      renderDropzones();
    }

    updateDayTypeLabel();
    renderCalendar();
    updateLockButton();

    const label = qs("#calendarCurrentLabel");
    if (label) {
      label.textContent = prettyDate(new Date(selectedDateKey));
    }
  }

  function setupCalendarNav() {
    const prev = qs("#calendarPrev");
    const next = qs("#calendarNext");

    if (prev) {
      prev.addEventListener("click", () => {
        calendarMonth.setMonth(calendarMonth.getMonth() - 1);
        renderCalendar();
      });
    }
    if (next) {
      next.addEventListener("click", () => {
        calendarMonth.setMonth(calendarMonth.getMonth() + 1);
        renderCalendar();
      });
    }
  }

  // ---------- LOCK GOMB ----------

  function updateLockButton() {
    const btn = qs("#lockDayBtn");
    const info = qs("#lockInfo");
    if (!btn) return;

    if (dayLocked) {
      btn.disabled = true;
      btn.textContent = "Nap lezárva";
      if (info) info.textContent = "Ez a nap lezárva. A naptárból visszanézheted, de nem módosítható.";
      return;
    }

    if (!workoutMode) {
      btn.disabled = true;
      btn.textContent = "Nap lezárása";
      if (info) info.textContent = "Először válaszd ki a módot (kardió vagy edzőtermi).";
      return;
    }

    if (workoutMode === "gym") {
      const total = mainExercises.length + extraExercises.length;
      btn.disabled = mainExercises.length < 3 || total < 3;
      btn.textContent = "Nap lezárása";
      if (info) info.textContent = "Válassz ki legalább 3 fő gyakorlatot a nap lezárásához.";
    } else if (workoutMode === "cardio") {
      btn.disabled = !cardioSelection;
      btn.textContent = "Nap lezárása";
      if (info) info.textContent = "Válassz ki egy kardió aktivitást, majd zárd le a napot.";
    }
  }

  function initLockButton() {
    const btn = qs("#lockDayBtn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      if (dayLocked || !workoutMode) return;

      const key = selectedDateKey || dateKey(new Date());

      if (workoutMode === "gym") {
        // ... validáció ...
        calendarData[key] = {
          mode: "gym",
          dayType: currentDayType,
          main: [...mainExercises],
          extra: [...extraExercises]
        };

        // SZERVERRE MENTÉS (GYM)
        saveWorkoutToServer(
          key, 
          "gym", 
          currentDayType, 
          mainExercises.map(e => e.id), 
          extraExercises.map(e => e.id), 
          null
        );

      } else if (workoutMode === "cardio") {
         // ... validáció ...
        calendarData[key] = {
          mode: "cardio",
          cardio: { ...cardioSelection }
        };

        // SZERVERRE MENTÉS (CARDIO)
        // Feltételezzük, hogy a cardioSelection-nek van 'id'-ja. 
        // Ha nincs, a DB-be importálásnál kell generálni neki, vagy név alapján menteni.
        const cId = cardioSelection.id || null; 
        saveWorkoutToServer(key, "cardio", null, [], [], cId);
      }

      dayLocked = true;
      renderDropzones();
      renderCalendar();
      updateLockButton();

      // TODO: ide jöhet majd a backend POST /api/v1/workouts
    });
  }

  // ---------- INIT ----------

  function setupThemeToggle() {
    const container = qs("#gymThemeToggle");
    if (!container) return;

    const buttons = qsa("button[data-theme]", container);

    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        const theme = btn.dataset.theme;
        if (!theme) return;

        dayTheme = theme;
        buttons.forEach(b => b.classList.toggle("active", b === btn));

        if (workoutMode === "gym") {
          renderExercisePool();
        }
      });
    });
  }

  function setupWorkoutUI() {
    const panel = qs("#workout");
    if (!panel) return;

    if (!selectedDateKey) {
      const today = new Date();
      selectedDateKey = dateKey(today);
      calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    setupCalendarNav();
    renderExercisePool();
    renderDropzones();
    renderCalendar();
    initLockButton();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await fetchLoadLevel();      // először szint
    await loadGymExercises();    // kell a lista
    await loadCardioActivities();

    await fetchUserWorkouts();

    setupModeSelector();
    setupThemeToggle();
    setupWorkoutUI();

    // default: még nincs mód kiválasztva, user nyomja meg a gombot
  });
})();
