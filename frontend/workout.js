(function () {
  // ---------- HELPERS ----------
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  let LANG = window.LANG || "hu";

  // ---------- KONSTANSOK & CONFIG ----------

  const API_BASE = "http://127.0.0.1:8000/api/v1";

  // Izomcsoportok normalizálása
  const MUSCLE_ALIAS = {
    // Kar
    triceps: "tricep",
    "triceps brachii": "tricep",
    biceps: "bicep",
    "biceps brachii": "bicep",
    forearms: "forearm",
    forearm: "forearm",
    brachioradialis: "forearm",
    // Láb
    quadriceps: "quadricep",
    quadricep: "quadricep",
    quads: "quadricep",
    "rectus femoris": "quadricep",
    hamstrings: "hamstring",
    hamstring: "hamstring",
    "biceps femoris": "hamstring",
    glutes: "glute",
    glute: "glute",
    butt: "glute",
    "gluteus maximus": "glute",
    calves: "calf",
    calf: "calf",
    gastrocnemius: "calf",
    soleus: "calf",
    // Hát/Váll
    traps: "trap",
    trap: "trap",
    trapezius: "trap",
    "upper back": "trap",
    lats: "lat",
    lat: "lat",
    "latissimus dorsi": "lat",
    back: "back",
    "lower back": "back",
    "middle back": "back",
    "erector spinae": "back",
    shoulder: "shoulder",
    shoulders: "shoulder",
    delts: "shoulder",
    deltoids: "shoulder",
    // Mell/Has
    chest: "chest",
    pectorals: "chest",
    pecs: "chest",
    "pectoralis major": "chest",
    abs: "abs",
    abdominals: "abs",
    core: "abs",
    "rectus abdominis": "abs",
    obliques: "abs",
  };

  const SPLIT_TARGETS = {
    push: ["chest", "shoulder", "tricep"],
    pull: ["back", "bicep", "trap", "lat"],
    legs: ["quadricep", "hamstring", "glute", "calf"],
    mixed: [],
  };

  // Rotációs sorrend (PPL)
  const SPLIT_ORDER = ["push", "pull", "legs"];

  // Nehézségi szintek (0: Kezdő .. 2: Profi)
  const LEVEL_VALUES = {
    // Kezdő
    beginner: 0,
    "kezdő": 0,
    "könnyű": 0,
    konnyu: 0,
    "0": 0,
    0: 0,
    // Közepes / Haladó
    intermediate: 1,
    "közepes": 1,
    "haladó": 1,
    "1": 1,
    1: 1,
    // Profi / Nehéz
    expert: 2,
    advanced: 2,
    profi: 2,
    "nehéz": 2,
    nehez: 2,
    "2": 2,
    2: 2,
  };

  const LEVEL_DISPLAY = {
    beginner: "Kezdő",
    "kezdő": "Kezdő",
    "könnyű": "Kezdő",
    "0": "Kezdő",

    intermediate: "Haladó",
    "közepes": "Haladó",
    "haladó": "Haladó",
    "1": "Haladó",

    expert: "Profi",
    advanced: "Profi",
    profi: "Profi",
    "nehéz": "Profi",
    "2": "Profi",
  };

  const TRAINING_SCHEDULES = {
    Könnyű: [1, 4], // Hétfő, Csütörtök
    Közepes: [1, 3, 5], // Hétfő, Szerda, Péntek
    Nehéz: [1, 2, 4, 5, 6], // Hétfő, Kedd, Csüt, Pén, Szom
  };

  // ---------- ÁLLAPOT ----------
  let EXERCISES = [];
  let EXERCISES_BY_ID = new Map();
  let CARDIO_ACTIVITIES = [];
  let workoutMode = null;
  let selectedSplit = "mixed";

  // Felhasználó szint
  let userScheduleLevel = "Közepes";
  let userLevelValue = 1; // Default: intermediate (közepes)

  // Naptár
  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth();
  let selectedDay = null;
  let calendarData = {};
  let dayLocked = false;

  // Toast timer
  let toastTimeout = null;

  // ---------- AUTH ----------
  function authHeaders(extra = {}) {
    const token =
      localStorage.getItem("access_token") || localStorage.getItem("token");
    const headers = { ...extra };
    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }
    return headers;
  }

  // ---------- TOAST ----------
  function showToast(message, type = "info") {
    let toast = qs(".custom-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "custom-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.remove("error");
    if (type === "error") toast.classList.add("error");

    // kicsi pop animáció
    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove("show");
    }, 2600);
  }

  // ---------- ADATBETÖLTÉS ----------

  async function fetchUserProfile() {
    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        headers: authHeaders(),
      });

      let rawLevel = null;

      if (res.ok) {
        const data = await res.json();

        if (data.load_level) rawLevel = data.load_level;
        else if (data.loadLevel) rawLevel = data.loadLevel;

        if (
          !rawLevel &&
          data.training_profiles &&
          Array.isArray(data.training_profiles) &&
          data.training_profiles.length > 0
        ) {
          const activeProfile = data.training_profiles.find(
            (p) => p.is_active === true
          );
          const profile =
            activeProfile ||
            data.training_profiles[data.training_profiles.length - 1];
          if (profile && profile.load_level) {
            rawLevel = profile.load_level;
          }
        }
      }

      // Fallback: localStorage-ben eltárolt szint (ha van)
      if (!rawLevel) {
        rawLevel =
          localStorage.getItem("athlion_load_level") ||
          localStorage.getItem("athlon_load_level") ||
          null;
      }

      if (rawLevel) {
        userScheduleLevel = rawLevel;
        const normalizedLevel = String(rawLevel).toLowerCase().trim();
        if (LEVEL_VALUES.hasOwnProperty(normalizedLevel)) {
          userLevelValue = LEVEL_VALUES[normalizedLevel];
        }
        console.log(
          `[Athlion] Felhasználói load_level: "${rawLevel}" → belső szint: ${userLevelValue}`
        );
      } else {
        console.warn(
          "[Athlion] Nem találtam load_level értéket, marad a Közepes / Haladó default."
        );
      }
    } catch (e) {
      console.error("[Athlion] Profil hiba:", e);
    }
  }

  async function loadGymExercises() {
    try {
      const res = await fetch(`${API_BASE}/exercises/`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Gyakorlatok letöltési hiba");
      EXERCISES = await res.json();
      EXERCISES_BY_ID = new Map(
        EXERCISES.map((ex) => [String(ex.id), ex])
      );
      renderPool();
    } catch (err) {
      console.error(err);
      alert("Hiba: Nem sikerült betölteni a gyakorlatokat a szerverről!");
    }
  }

  async function loadCardioActivities() {
    try {
      const res = await fetch(`${API_BASE}/physical_activities/`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Cardio fetch error");
      CARDIO_ACTIVITIES = await res.json();
      renderCardioList();
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchUserWorkouts() {
    try {
      const res = await fetch(`${API_BASE}/workouts/`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const logs = await res.json();
        logs.forEach((log) => {
          const d = log.date;
          if (log.mode === "gym") {
            calendarData[d] = {
              mode: "gym",
              split: log.day_type || "mixed",
              data: log.data,
              saved: true,
            };
          } else {
            calendarData[d] = {
              mode: "cardio",
              data: log.data,
              saved: true,
            };
          }
        });
        renderCalendar();
        updateDashboard();
      }
    } catch (err) {
      console.error("Hiba az edzések betöltésekor", err);
    }
  }

  // ---------- IZOM & TÖRTÉNET LOGIKA ----------

  // normalizált izomlista (kezeli snake_case + camelCase-t is)
  function getNormalizedMuscles(ex) {
    let raw = ex.primary_muscles || ex.primaryMuscles;

    if (!raw) return [];
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch (e) {
        raw = [raw];
      }
    }
    if (!Array.isArray(raw)) return [];

    return raw.map((m) => {
      const lower = String(m).toLowerCase().trim();
      return MUSCLE_ALIAS[lower] || lower;
    });
  }

  // Az elmúlt N nap edzés-története izomcsoportonként
  function computeMuscleHistory(windowDays = 14) {
    const history = {};
    const today = new Date();

    Object.entries(calendarData).forEach(([dateStr, entry]) => {
      if (!entry || entry.mode !== "gym" || !entry.data || !entry.data.main_ids) return;

      const entryDate = new Date(dateStr);
      const diffMs = today - entryDate;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays < 0 || diffDays > windowDays) return;

      // friss edzés többet számít
      const weight = 1 - diffDays / (windowDays + 1);

      (entry.data.main_ids || []).forEach((id) => {
        const ex = EXERCISES_BY_ID.get(String(id));
        if (!ex) return;
        const muscles = getNormalizedMuscles(ex);
        muscles.forEach((m) => {
          history[m] = (history[m] || 0) + weight;
        });
      });
    });

    return history;
  }

  function getMissingMuscleGroups() {
    if (selectedSplit === "mixed") return [];

    const targetMuscles = SPLIT_TARGETS[selectedSplit] || [];
    const mainZone = qs("#mainExercises");
    if (!mainZone) return [];

    const selectedItems = Array.from(mainZone.children);
    const coveredMuscles = new Set();

    selectedItems.forEach((item) => {
      if (!item.dataset.obj) return;
      try {
        const ex = JSON.parse(item.dataset.obj);
        const muscles = getNormalizedMuscles(ex);
        muscles.forEach((m) => coveredMuscles.add(m));
      } catch (e) {
        console.error("Hibás dataset.obj", e);
      }
    });

    return targetMuscles.filter((m) => !coveredMuscles.has(m));
  }

  function getUndertrainedMuscles(history) {
    // Ha van split -> azon belül rendezzük a targeteket történet szerint
    if (selectedSplit !== "mixed") {
      const targets = SPLIT_TARGETS[selectedSplit] || [];
      const arr = targets.map((m) => [m, history[m] || 0]);
      arr.sort((a, b) => a[1] - b[1]); // kevesebbet dolgoztatott előre
      return arr.slice(0, 3).map(([m]) => m);
    }
    // ha vegyes → összes ismert izmot nézzük
    const all = Object.entries(history);
    all.sort((a, b) => a[1] - b[1]);
    return all.slice(0, 3).map(([m]) => m);
  }

  // ---------- EXTRA LOGIKA SZÖVEG ----------

  function ensureExtraLogicElement() {
    let el = qs("#extraLogicText");
    if (el) return el;
    const extraSection = qs("#extraExercises")?.closest(".builder-section");
    if (!extraSection) return null;
    el = document.createElement("p");
    el.id = "extraLogicText";
    el.className = "muted small extra-logic-text";
    extraSection.appendChild(el);
    return el;
  }

  function humanizeMuscleList(list) {
    if (!list || list.length === 0) return "";
    const pretty = list
      .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
      .join(", ");
    return pretty;
  }

  function updateExtraLogicText(missingMuscles, undertrainedMuscles, mainCount) {
    const el = ensureExtraLogicElement();
    if (!el) return;

    if (mainCount === 0) {
      el.textContent =
        "Az okos ajánló akkor aktiválódik, ha legalább 3 fő gyakorlatot kiválasztasz.";
      return;
    }
    if (mainCount < 3) {
      el.textContent = `Még ${3 - mainCount} fő gyakorlat hiányzik – utána az ajánló automatikusan kiegészíti a napot.`;
      return;
    }

    const parts = [];

    if (missingMuscles && missingMuscles.length > 0) {
      parts.push(
        `Hiányzó izomcsoport(ok): ${humanizeMuscleList(missingMuscles)}.`
      );
    }

    if (undertrainedMuscles && undertrainedMuscles.length > 0) {
      parts.push(
        `Az elmúlt 14 napban viszonylag keveset edzett területek: ${humanizeMuscleList(
          undertrainedMuscles
        )}.`
      );
    }

    if (parts.length === 0) {
      el.textContent =
        "Az ajánló most kiegyensúlyozott kiegészítőket javasol a választott splithez.";
    } else {
      el.textContent = parts.join(" ");
    }
  }

  // ---------- AJÁNLÓ & GYAKORLATLISTA ----------

  function predictNextSplit() {
    let lastDate = null;
    let lastSplit = null;

    Object.keys(calendarData).forEach((dateStr) => {
      const entry = calendarData[dateStr];
      if (
        entry.mode === "gym" &&
        entry.split &&
        SPLIT_ORDER.includes(entry.split)
      ) {
        if (!lastDate || new Date(dateStr) > new Date(lastDate)) {
          lastDate = dateStr;
          lastSplit = entry.split;
        }
      }
    });

    if (!lastSplit) return "push";
    const idx = SPLIT_ORDER.indexOf(lastSplit);
    const nextIdx = (idx + 1) % SPLIT_ORDER.length;
    return SPLIT_ORDER[nextIdx];
  }

  function renderPool() {
    const container = qs("#exercisePool");
    if (!container) return;
    container.innerHTML = "";

    const searchInput = qs("#exerciseSearch");
    const searchVal = searchInput ? searchInput.value.toLowerCase() : "";

    const mainZone = qs("#mainExercises");
    const mainCount = mainZone
      ? mainZone.querySelectorAll(".exercise-pill").length
      : 0;

    const missingMuscles = getMissingMuscleGroups();
    const isRecommendationsActive =
      selectedSplit !== "mixed" && missingMuscles.length > 0;

    let filtered = EXERCISES.filter((ex) => {
      // 1. Keresés
      const name = (ex.name || "").toLowerCase();
      if (searchVal && !name.includes(searchVal)) return false;

      // 2. Szint szűrés (user load_level alapján)
      if (ex.level) {
        const exLevelStr = String(ex.level).toLowerCase().trim();
        const exLevelVal = LEVEL_VALUES.hasOwnProperty(exLevelStr)
          ? LEVEL_VALUES[exLevelStr]
          : 1; // default: 1 (közepes)
        if (exLevelVal > userLevelValue) return false;
      }

      // 3. Split szűrés
      if (selectedSplit === "mixed") return true;
      const targets = SPLIT_TARGETS[selectedSplit];
      if (!targets) return true;

      const exMuscles = getNormalizedMuscles(ex);
      return exMuscles.some((m) => targets.includes(m));
    });

    // 4. Rendezés – ajánlottak előre (ha mainCount >= 3 van értelme)
    if (isRecommendationsActive && mainCount >= 3) {
      filtered.sort((a, b) => {
        const aMuscles = getNormalizedMuscles(a);
        const bMuscles = getNormalizedMuscles(b);
        const aHit = aMuscles.some((m) => missingMuscles.includes(m));
        const bHit = bMuscles.some((m) => missingMuscles.includes(m));
        if (aHit && !bHit) return -1;
        if (!aHit && bHit) return 1;
        return 0;
      });
    }

    filtered.forEach((ex) => {
      const isRecommended = checkRecommendation(ex, missingMuscles);
      const card = createExerciseCard(ex, isRecommended);
      container.appendChild(card);
    });
  }

  function checkRecommendation(ex, missingArr) {
    if (!missingArr || missingArr.length === 0) return false;
    const m = getNormalizedMuscles(ex);
    return m.some((mus) => missingArr.includes(mus));
  }

  // *** OKOS AJÁNLÓ – max 3 extra, izom hiány + history + user szint ***
  function autoFillExtraRecommendations() {
    const mainZone = qs("#mainExercises");
    const extraZone = qs("#extraExercises");
    if (!mainZone || !extraZone) return;

    const mainItems = Array.from(mainZone.children);
    const mainCount = mainItems.length;

    const missingMuscles = getMissingMuscleGroups();
    const history = computeMuscleHistory(14);
    const undertrained = getUndertrainedMuscles(history);

    updateExtraLogicText(missingMuscles, undertrained, mainCount);

    // Csak akkor ajánljunk automatikusan, ha megvan a 3 fő gyakorlat
    if (mainCount < 3) return;

    const currentExtraItems = Array.from(extraZone.children);
    const slotsLeft = 3 - currentExtraItems.length;
    if (slotsLeft <= 0) return;

    const usedIds = new Set([
      ...mainItems.map((el) => String(el.dataset.id)),
      ...currentExtraItems.map((el) => String(el.dataset.id)),
    ]);

    const targets = SPLIT_TARGETS[selectedSplit] || [];

    let candidates = EXERCISES.filter((ex) => {
      const exId = String(ex.id);
      if (usedIds.has(exId)) return false;

      if (ex.level) {
        const exLevelStr = String(ex.level).toLowerCase().trim();
        const exLevelVal = LEVEL_VALUES.hasOwnProperty(exLevelStr)
          ? LEVEL_VALUES[exLevelStr]
          : 1;
        if (exLevelVal > userLevelValue) return false;
      }

      const muscles = getNormalizedMuscles(ex);
      if (muscles.length === 0) return false;

      if (selectedSplit !== "mixed") {
        if (!muscles.some((m) => targets.includes(m))) return false;
      }
      return true;
    }).map((ex) => {
      const muscles = getNormalizedMuscles(ex);

      let score = 0;

      // 1) hiányzó izomcsoport erős súllyal
      muscles.forEach((m) => {
        if (missingMuscles.includes(m)) score += 3;
      });

      // 2) undertrained (keveset edzett) izmok
      muscles.forEach((m) => {
        const histVal = history[m] || 0;
        const need = 1 / (1 + histVal); // 0 edzés → 1 pont, sok edzés → kevesebb
        score += need;
      });

      // 3) split illeszkedés
      if (selectedSplit !== "mixed" && targets.length > 0) {
        const hits = muscles.filter((m) => targets.includes(m)).length;
        score += (hits / targets.length) * 0.5;
      }

      // 4) szint közelség (kicsi bonusz, hogy ne full beginner/pro legyen)
      if (ex.level) {
        const exLevelStr = String(ex.level).toLowerCase().trim();
        const exLevelVal = LEVEL_VALUES.hasOwnProperty(exLevelStr)
          ? LEVEL_VALUES[exLevelStr]
          : 1;
        const diff = Math.abs(userLevelValue - exLevelVal);
        score += (2 - diff) * 0.1; // minél közelebb, annál jobb
      }

      // pici random, hogy ne legyen mindig ugyanaz a sorrend
      score += Math.random() * 0.01;

      return { ex, score };
    });

    // Fallback, ha valamiért üres lett a jelölt lista
    if (candidates.length === 0) {
      candidates = EXERCISES.filter((ex) => {
        const exId = String(ex.id);
        if (usedIds.has(exId)) return false;
        if (ex.level) {
          const exLevelStr = String(ex.level).toLowerCase().trim();
          const exLevelVal = LEVEL_VALUES.hasOwnProperty(exLevelStr)
            ? LEVEL_VALUES[exLevelStr]
            : 1;
          if (exLevelVal > userLevelValue) return false;
        }
        const muscles = getNormalizedMuscles(ex);
        if (selectedSplit !== "mixed") {
          const t = SPLIT_TARGETS[selectedSplit] || [];
          return muscles.some((m) => t.includes(m));
        }
        return true;
      }).map((ex) => ({ ex, score: Math.random() }));
    }

    candidates.sort((a, b) => b.score - a.score);

    const newItems = [];
    for (let i = 0; i < slotsLeft && i < candidates.length; i++) {
      const el = addToZone(candidates[i].ex, "#extraExercises", {
        fromReco: true,
      });
      if (el) newItems.push(el);
    }

    if (newItems.length > 0) {
      extraZone.classList.add("reco-highlight");
      setTimeout(() => extraZone.classList.remove("reco-highlight"), 900);

      newItems.forEach((el, idx) => {
        el.classList.add("reco-enter");
        setTimeout(() => el.classList.remove("reco-enter"), 600 + idx * 80);
      });
    }
  }

  function createExerciseCard(ex, isRecommended = false) {
    const div = document.createElement("div");
    div.className = "exercise-pill";
    div.draggable = true;

    if (isRecommended) {
      div.style.borderColor = "var(--gold-1)";
      div.style.boxShadow = "0 0 10px rgba(62,142,222,0.4)";
      div.style.backgroundColor = "rgba(62,142,222,0.1)";
    }

    let muscleTag = "";
    const mArr = getNormalizedMuscles(ex);
    if (mArr.length > 0) {
      const mName = mArr[0].charAt(0).toUpperCase() + mArr[0].slice(1);
      muscleTag = `<span class="tag">${mName}</span>`;
    }

    let levelTag = "";
    if (ex.level) {
      const rawLvl = String(ex.level).toLowerCase().trim();
      const huLevel = LEVEL_DISPLAY[rawLvl] || ex.level;
      levelTag = `<span class="tag level-tag" style="color:var(--muted); opacity:0.8;">${huLevel}</span>`;
    }

    div.innerHTML = `
        <span style="font-weight:600;">${ex.name}</span>
        <div style="display:flex;gap:4px;">
          ${muscleTag}
          ${levelTag}
        </div>
      `;
    div.dataset.id = ex.id;

    div.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", JSON.stringify(ex));
    });

    div.addEventListener("click", () => {
      addToZone(ex, "#mainExercises");
    });

    return div;
  }

  // Dropzone handling
  ["#mainExercises", "#extraExercises"].forEach((sel) => {
    const zone = qs(sel);
    if (!zone) return;
    zone.addEventListener("dragover", (e) => e.preventDefault());
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      const data = e.dataTransfer.getData("text/plain");
      if (data) {
        const ex = JSON.parse(data);
        addToZone(ex, sel);
      }
    });
  });

  function addToZone(ex, zoneSel, opts = {}) {
    const zone = qs(zoneSel);
    if (!zone) return null;

    // Max 3 fő gyakorlat – ne engedjük túl
    if (zoneSel === "#mainExercises" && !opts.allowOverflow) {
      const currentCount = zone.querySelectorAll(".exercise-pill").length;
      const already = zone.querySelector(`[data-id="${ex.id}"]`);
      if (currentCount >= 3 && !already) {
        showToast(
          "Max. 3 fő gyakorlatot választhatsz. Törölj egyet, ha cserélni szeretnél."
        );
        return null;
      }
    }

    if (zone.querySelector(`[data-id="${ex.id}"]`)) return null;

    const item = document.createElement("div");
    item.className = "exercise-pill";
    item.style.cursor = "default";
    item.style.marginRight = "6px";

    item.innerHTML = `
      <span>${ex.name}</span>
      <button class="remove-btn"
        style="background:none;border:none;color:#ff6b6b;cursor:pointer;font-weight:bold;margin-left:8px;">
        &times;
      </button>
    `;
    item.dataset.id = ex.id;
    item.dataset.obj = JSON.stringify(ex);

    item
      .querySelector(".remove-btn")
      .addEventListener("click", () => {
        item.remove();
        if (zoneSel === "#mainExercises") {
          renderPool();
          autoFillExtraRecommendations();
        } else if (zoneSel === "#extraExercises") {
          autoFillExtraRecommendations(); // frissítjük a logika szöveget
        }
      });

    zone.appendChild(item);

    if (zoneSel === "#mainExercises") {
      renderPool();
      autoFillExtraRecommendations();
    }

    // ha ajánlóból jött → animáció
    if (opts.fromReco) {
      item.classList.add("reco-enter");
      setTimeout(() => item.classList.remove("reco-enter"), 650);
    }

    return item;
  }

  // ---------- MENTÉS ----------

  qs("#lockDayBtn").addEventListener("click", async () => {
    const key = getCalendarKey(currentYear, currentMonth, selectedDay);
    const token =
      localStorage.getItem("access_token") || localStorage.getItem("token");

    if (!token) {
      alert("HIBA: Nem vagy bejelentkezve! Kérlek lépj be újra.");
      window.location.href = "login.html";
      return;
    }

    let payloadData = {};
    let finalMode = workoutMode;
    let finalDayType = selectedSplit;

    if (workoutMode === "gym") {
      const mainItems = qsa("#mainExercises .exercise-pill");
      const extraItems = qsa("#extraExercises .exercise-pill");
      const mainIds = mainItems.map((el) => el.dataset.id);
      const extraIds = extraItems.map((el) => el.dataset.id);

      if (mainIds.length === 0 && extraIds.length === 0) {
        alert("Válassz legalább egy gyakorlatot a mentéshez!");
        return;
      }

      const durationInput = qs("#gymDurationInput");
      const durationVal = durationInput ? parseInt(durationInput.value) : 60;

      payloadData = {
        duration: durationVal,
        main_ids: mainIds,
        extra_ids: extraIds,
      };
    } else {
      if (!selectedCardioId) {
        alert("Válassz kardió mozgást!");
        return;
      }
      const durInput = qs("#cardioDurationVal");
      const durationVal = durInput ? parseInt(durInput.value) : 30;

      payloadData = {
        cardio_id: selectedCardioId,
        duration: durationVal,
      };
      finalDayType = null;
    }

    try {
      const saveBtn = qs("#lockDayBtn");
      saveBtn.textContent = "Mentés…";
      saveBtn.disabled = true;

      const res = await fetch(`${API_BASE}/workouts/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          date: key,
          mode: finalMode,
          day_type: finalDayType,
          data: payloadData,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Backend hiba:", errorText);
        throw new Error(`Szerver hiba (${res.status}): ${errorText}`);
      }

      alert("Sikeres mentés!");

      calendarData[key] = {
        mode: finalMode,
        split: finalDayType || "mixed",
        data: payloadData,
        saved: true,
      };

      dayLocked = true;
      renderCalendar();
      updateDashboard();
      switchView("calendar");
    } catch (err) {
      alert("NEM SIKERÜLT A MENTÉS!\n" + err.message);
    } finally {
      const saveBtn = qs("#lockDayBtn");
      saveBtn.textContent = "Nap lezárása";
      if (!dayLocked) saveBtn.disabled = false;
    }
  });

  // ---------- NAPTÁR & UI ----------

  function getCalendarKey(y, m, d) {
    const mm = String(m + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  function renderCalendar() {
    const grid = qs("#calendarGrid");
    if (!grid) return;
    grid.innerHTML = "";

    const monthLabel = qs("#currentMonthLabel");
    const dateObj = new Date(currentYear, currentMonth, 1);
    const monthName = dateObj.toLocaleString(LANG, { month: "long" });
    monthLabel.textContent = `${currentYear} ${monthName}`;

    let firstDayIndex = dateObj.getDay();
    if (firstDayIndex === 0) firstDayIndex = 7;
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // üres cellák elejére (hétfő kezdés)
    for (let i = 1; i < firstDayIndex; i++) {
      const empty = document.createElement("div");
      empty.classList.add("cal-day", "empty");
      grid.appendChild(empty);
    }

    const scheduledDays = TRAINING_SCHEDULES[userScheduleLevel] || [];

    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement("div");
      cell.classList.add("cal-day");

      const span = document.createElement("span");
      span.textContent = d;
      span.style.zIndex = "2";
      cell.appendChild(span);

      const key = getCalendarKey(currentYear, currentMonth, d);
      const todayKey = new Date().toISOString().split("T")[0];

      if (key === todayKey) cell.classList.add("today");

      const currentDayOfWeek = new Date(currentYear, currentMonth, d).getDay();
      const formattedDayOfWeek = currentDayOfWeek === 0 ? 7 : currentDayOfWeek;
      if (scheduledDays.includes(formattedDayOfWeek)) {
        cell.classList.add("scheduled-train-day");
      }

      if (calendarData[key]) {
        cell.classList.add("has-data");
        const dot = document.createElement("div");
        dot.className = "dot-indicator";
        dot.style.backgroundColor =
          calendarData[key].mode === "gym" ? "#d4af37" : "#00d4ff";
        cell.appendChild(dot);
      }

      cell.addEventListener("click", () => {
        if (calendarData[key]) {
          openDayPopup(d);
        } else {
          selectedDay = d;
          startWorkoutCreation(d);
        }
      });

      grid.appendChild(cell);
    }
  }

  function handleMonthChange(delta) {
    const grid = qs("#calendarGrid");
    if (!grid) return;

    if (delta > 0) grid.classList.add("anim-slide-out-left");
    else grid.classList.add("anim-slide-out-right");

    setTimeout(() => {
      currentMonth += delta;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      renderCalendar();
      if (delta > 0) {
        grid.classList.remove("anim-slide-out-left");
        grid.classList.add("anim-slide-in-right");
      } else {
        grid.classList.remove("anim-slide-out-right");
        grid.classList.add("anim-slide-in-left");
      }
      setTimeout(
        () =>
          grid.classList.remove("anim-slide-in-right", "anim-slide-in-left"),
        300
      );
    }, 200);
  }

  function startWorkoutCreation(day) {
    selectedDay = day;
    hideSummaryPopup();
    switchView("builder");

    qs("#gymBuilder").style.display = "none";
    qs("#cardioBuilder").style.display = "none";
    qs("#modeGym").classList.remove("active");
    qs("#modeCardio").classList.remove("active");
    qs("#lockDayBtn").disabled = true;
    qs("#lockInfo").style.display = "block";
    dayLocked = false;
    qs("#mainExercises").innerHTML = "";
    qs("#extraExercises").innerHTML = "";
    updateExtraLogicText([], [], 0);

    const key = getCalendarKey(currentYear, currentMonth, selectedDay);
    qs("#builderDate").textContent = key;

    const existing = calendarData[key];
    if (existing) {
      if (existing.mode === "gym") {
        selectedSplit = existing.split || "mixed";
        qsa(".split-btn").forEach((b) => {
          b.classList.toggle("active", b.dataset.type === selectedSplit);
        });
        setWorkoutMode("gym");
      } else {
        setWorkoutMode("cardio");
      }
    } else {
      const nextSuggested = predictNextSplit();
      selectedSplit = nextSuggested;

      qsa(".split-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.type === selectedSplit);
      });
      const sel = qs("#dayTypeSelect");
      if (sel) sel.value = selectedSplit;
    }
  }

  function switchView(viewName) {
    const calendarView = qs("#calendarView");
    const builderView = qs("#workoutBuilderView");
    calendarView.style.display = "";
    builderView.style.display = "";

    if (viewName === "calendar") {
      calendarView.classList.remove("view-hidden");
      calendarView.classList.add("active");
      builderView.classList.remove("active");
      builderView.classList.add("view-hidden");
      updateDashboard();
    } else {
      calendarView.classList.remove("active");
      calendarView.classList.add("view-hidden");
      builderView.classList.remove("view-hidden");
      builderView.classList.add("active");
    }
  }

  function setWorkoutMode(mode) {
    workoutMode = mode;
    qs("#lockDayBtn").disabled = false;
    qs("#lockInfo").style.display = "none";
    if (mode === "gym") {
      qs("#gymBuilder").style.display = "block";
      qs("#cardioBuilder").style.display = "none";
      qs("#modeGym").classList.add("active");
      qs("#modeCardio").classList.remove("active");
      renderPool();
      autoFillExtraRecommendations();
    } else {
      qs("#gymBuilder").style.display = "none";
      qs("#cardioBuilder").style.display = "block";
      qs("#modeGym").classList.remove("active");
      qs("#modeCardio").classList.add("active");
    }
  }

  function updateDashboard() {
    const muscleCounts = {};
    Object.values(calendarData).forEach((entry) => {
      if (entry.mode === "gym" && entry.data && entry.data.main_ids) {
        if (entry.split && entry.split !== "mixed") {
          SPLIT_TARGETS[entry.split].forEach((m) => {
            muscleCounts[m] = (muscleCounts[m] || 0) + 1;
          });
        }
      }
    });

    const focusText = qs("#focusText");
    if (focusText) {
      const count = Object.keys(muscleCounts).length;
      focusText.textContent =
        count > 0
          ? `${count} izomcsoport edzve ebben a hónapban.`
          : "Még nincs adat erre a hónapra.";
    }

    // Regeneráció widget
    const recoveryList = qs("#recoveryList");
    if (recoveryList) {
      recoveryList.innerHTML = "";
      const lastTrained = { push: null, pull: null, legs: null };

      Object.keys(calendarData)
        .sort()
        .forEach((dateStr) => {
          const entry = calendarData[dateStr];
          if (
            entry.mode === "gym" &&
            entry.split &&
            entry.split !== "mixed"
          ) {
            lastTrained[entry.split] = new Date(dateStr);
          }
        });

      const today = new Date();
      ["push", "pull", "legs"].forEach((split) => {
        let percent = 100;
        let colorClass = "rec-high";

        if (lastTrained[split]) {
          const diffTime = Math.abs(today - lastTrained[split]);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays <= 1) {
            percent = 20;
            colorClass = "rec-low";
          } else if (diffDays === 2) {
            percent = 60;
            colorClass = "rec-mid";
          }
        }

        const row = document.createElement("div");
        row.className = "recovery-item";
        row.innerHTML = `
            <div class="recovery-label">
              <span>${split.toUpperCase()}</span>
              <span>${percent}%</span>
            </div>
            <div class="rec-bar-bg">
              <div class="rec-bar-fill ${colorClass}" style="width: ${percent}%"></div>
            </div>
          `;
        recoveryList.appendChild(row);
      });
    }

    // Body map (torzó / kar / láb)
    const torsoEl = qs("#bm-torso");
    const armsEl = qs("#bm-arms");
    const legsEl = qs("#bm-legs");

    let torsoCount = 0;
    let armsCount = 0;
    let legsCount = 0;

    Object.values(calendarData).forEach((entry) => {
      if (entry.mode !== "gym" || !entry.split) return;
      switch (entry.split) {
        case "push":
        case "pull":
          torsoCount++;
          armsCount++;
          break;
        case "legs":
          legsCount++;
          break;
      }
    });

    const applyLvl = (el, count) => {
      if (!el) return;
      el.classList.remove("lvl-1", "lvl-2", "lvl-3");
      let lvl = 0;
      if (count >= 1 && count <= 2) lvl = 1;
      else if (count >= 3 && count <= 4) lvl = 2;
      else if (count >= 5) lvl = 3;
      if (lvl > 0) el.classList.add(`lvl-${lvl}`);
    };

    applyLvl(torsoEl, torsoCount);
    applyLvl(armsEl, armsCount);
    applyLvl(legsEl, legsCount);
  }

  // ---------- CARDIO, POPUP ----------

  let selectedCardioId = null;

  function renderCardioList() {
    const container = qs("#cardioList");
    if (!container) return;
    container.innerHTML = "";
    CARDIO_ACTIVITIES.forEach((act) => {
      const div = document.createElement("div");
      div.className = "cardio-item";
      div.textContent = `${act.name} (MET: ${act.met})`;
      div.dataset.id = act.id;
      div.addEventListener("click", () => {
        qsa(".cardio-item", container).forEach((el) =>
          el.classList.remove("selected")
        );
        div.classList.add("selected");
        selectedCardioId = act.id;

        const old = qs("#cardioDurationInputWrapper");
        if (old) old.remove();
        const w = document.createElement("div");
        w.id = "cardioDurationInputWrapper";
        w.style.marginTop = "10px";
        w.innerHTML = `<label>Idő (perc): </label><input type="number" id="cardioDurationVal" value="30" style="width:60px;">`;
        w.addEventListener("click", (e) => e.stopPropagation());
        div.appendChild(w);
      });
      container.appendChild(div);
    });
  }

  function hideSummaryPopup() {
    const p = qs("#dayPopup");
    if (p) p.classList.add("hidden");
  }

  function openDayPopup(day) {
    selectedDay = day;
    const key = getCalendarKey(currentYear, currentMonth, day);
    const data = calendarData[key];
    if (!data) {
      startWorkoutCreation(day);
      return;
    }

    const popup = qs("#dayPopup");
    if (!popup) return;
    qs("#popupDate").textContent = key;
    const content = qs("#popupContent");
    content.innerHTML =
      data.mode === "gym"
        ? `<p style="color:#d4af37">GYM: ${
            data.split ? data.split.toUpperCase() : "Vegyes"
          }</p>`
        : `<p style="color:#00d4ff">KARDIÓ</p>`;
    qs("#startWorkoutBtn").textContent = "Szerkesztés";
    popup.classList.remove("hidden");
  }

  // ---------- INIT ----------

  document.addEventListener("DOMContentLoaded", async () => {
    qs("#backToCalendarBtn")?.addEventListener("click", () =>
      switchView("calendar")
    );
    qs("#calendarPrev")?.addEventListener("click", () =>
      handleMonthChange(-1)
    );
    qs("#calendarNext")?.addEventListener("click", () =>
      handleMonthChange(1)
    );
    qs("#closePopupBtn")?.addEventListener("click", hideSummaryPopup);
    qs("#dayPopup")?.addEventListener("click", (e) => {
      if (e.target === qs("#dayPopup")) hideSummaryPopup();
    });
    qs("#startWorkoutBtn")?.addEventListener("click", () =>
      startWorkoutCreation(selectedDay)
    );

    qs("#modeGym")?.addEventListener("click", () => {
      if (!dayLocked) setWorkoutMode("gym");
    });
    qs("#modeCardio")?.addEventListener("click", () => {
      if (!dayLocked) setWorkoutMode("cardio");
    });

    const splitContainer = qs("#splitSelectorContainer");
    if (splitContainer) {
      const btns = qsa(".split-btn", splitContainer);
      btns.forEach((btn) => {
        btn.addEventListener("click", () => {
          btns.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          selectedSplit = btn.dataset.type || "mixed";
          const sel = qs("#dayTypeSelect");
          if (sel) sel.value = selectedSplit;
          renderPool();
          autoFillExtraRecommendations();
        });
      });
    }

    const searchInput = qs("#exerciseSearch");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        renderPool();
      });
    }

    // adatok betöltése
    await fetchUserProfile();
    await loadGymExercises();
    await loadCardioActivities();
    renderCalendar();
    await fetchUserWorkouts();

    switchView("calendar");
  });
})();
