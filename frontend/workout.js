(function () {
  // ---------- HELPERS ----------
  const qs  = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  let LANG = window.LANG || "hu";

  // ---------- ÁLLAPOT ----------
  let EXERCISES = [];
  let CARDIO_ACTIVITIES = [];
  let workoutMode = null;
  let currentDayType = null;
  let selectedSplit = "mixed";

  // Naptárhoz
  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth();
  let selectedDay = null;
  let calendarData = {};
  let dayLocked = false;

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
    const token = localStorage.getItem("access_token");
    const headers = { ...extra };
    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }
    return headers;
}


  // ---------- ADATBETÖLTÉS ----------

  async function fetchLoadLevel() {
    // TODO: user training_profile.load_level lekérés
  }

  async function loadGymExercises() {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/exercises/", {
        headers: authHeaders()
      });
      if (!res.ok) throw new Error("Exercise fetch error");
      EXERCISES = await res.json();
      console.log("Exercises loaded:", EXERCISES.length);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadCardioActivities() {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/physical_activities/", {
        headers: authHeaders()
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
      const res = await fetch("http://127.0.0.1:8000/api/v1/workouts/", {
        headers: authHeaders()
      });
      if (res.ok) {
        const logs = await res.json();
        logs.forEach(log => {
          const d = log.date;
          if (log.mode === "gym") {
            calendarData[d] = {
              mode: "gym",
              split: log.day_type,
              data: log.data,
              saved: true
            };
          } else {
            calendarData[d] = {
              mode: "cardio",
              data: log.data,
              saved: true
            };
          }
        });
        renderCalendar();
        updateDashboard();
      }
    } catch (err) {
      console.error("Nem sikerült betölteni az edzéseket", err);
    }
  }

  // ---------- NAPTÁR LOGIKA ----------

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

    for (let i = 1; i < firstDayIndex; i++) {
      const empty = document.createElement("div");
      empty.classList.add("day-cell", "empty");
      grid.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement("div");
      cell.classList.add("day-cell");
      cell.textContent = d;

      const key = getCalendarKey(currentYear, currentMonth, d);
      const todayKey = new Date().toISOString().split("T")[0];
      if (key === todayKey) cell.classList.add("today");

      if (calendarData[key]) {
        cell.classList.add("active");
        const dot = document.createElement("div");
        dot.style.width = "6px";
        dot.style.height = "6px";
        dot.style.borderRadius = "50%";
        dot.style.marginTop = "4px";
        dot.style.backgroundColor =
          calendarData[key].mode === "gym" ? "#d4af37" : "#00d4ff";
        cell.appendChild(dot);
      }

      cell.addEventListener("click", () => openDayPopup(d));
      grid.appendChild(cell);
    }
  }

  function handleMonthChange(delta) {
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
  }

  // ---------- POPUP ----------

  function openDayPopup(day) {
    selectedDay = day;
    const key = getCalendarKey(currentYear, currentMonth, day);
    const data = calendarData[key];

    const popup = qs("#dayPopup");
    qs("#popupDate").textContent = key;

    const contentDiv = qs("#popupContent");
    contentDiv.innerHTML = "";

    const startBtn = qs("#startWorkoutBtn");

    if (data) {
      let html = "";
      if (data.mode === "gym") {
        html += `<p style="color:#d4af37;font-weight:bold;">GYM EDZÉS</p>`;
        if (data.split) html += `<p>Típus: ${data.split.toUpperCase()}</p>`;
        const d = data.data || {};
        if (d.duration) html += `<p>Időtartam: ${d.duration} perc</p>`;
        if (d.calories_burned)
          html += `<p>Elégetett kalória: <strong>${d.calories_burned.toFixed(
            0
          )} kcal</strong></p>`;
      } else {
        html += `<p style="color:#00d4ff;font-weight:bold;">KARDIÓ</p>`;
        const d = data.data || {};
        if (d.duration) html += `<p>Idő: ${d.duration} perc</p>`;
        if (d.calories_burned)
          html += `<p>Kalória: <strong>${d.calories_burned.toFixed(
            0
          )} kcal</strong></p>`;
      }
      contentDiv.innerHTML = html;
      startBtn.textContent = "Szerkesztés";
    } else {
      contentDiv.innerHTML = "<p>Nincs rögzített edzés.</p>";
      startBtn.textContent = "Edzés hozzáadása";
    }

    popup.classList.remove("hidden");
  }

  function hideSummaryPopup() {
    qs("#dayPopup").classList.add("hidden");
  }

  // ---------- NÉZETVÁLTÁS ----------

  function switchView(viewName) {
    if (viewName === "calendar") {
      qs("#calendarView").style.display = "block";
      qs("#workoutBuilderView").style.display = "none";
    } else {
      qs("#calendarView").style.display = "none";
      qs("#workoutBuilderView").style.display = "block";
    }
  }

  qs("#startWorkoutBtn").addEventListener("click", () => {
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

    const key = getCalendarKey(currentYear, currentMonth, selectedDay);
    const existing = calendarData[key];

    qs("#builderDate").textContent = key;

    if (existing) {
      if (existing.mode === "gym") {
        setWorkoutMode("gym");
      } else {
        setWorkoutMode("cardio");
      }
    }
  });

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
    } else {
      qs("#gymBuilder").style.display = "none";
      qs("#cardioBuilder").style.display = "block";
      qs("#modeGym").classList.remove("active");
      qs("#modeCardio").classList.add("active");
    }
  }

  function setupSplitSelector() {
    const sel = qs("#dayTypeSelect");
    if (!sel) return;
    sel.addEventListener("change", e => {
      selectedSplit = e.target.value;
      renderPool();
    });
  }

  // ---------- GYM LOGIKA ----------

  function renderPool() {
    const container = qs("#exercisePool");
    container.innerHTML = "";

    const searchInput = qs("#exerciseSearch");
    const searchVal = searchInput ? searchInput.value.toLowerCase() : "";

    let filtered = EXERCISES.filter(ex => {
      const name = (ex.name || "").toLowerCase();
      if (searchVal && !name.includes(searchVal)) return false;

      if (selectedSplit === "mixed") return true;

      const targets = SPLIT_TARGETS[selectedSplit];
      if (!targets) return true;

      let pMuscles = ex.primary_muscles;
      if (typeof pMuscles === "string" && pMuscles.startsWith("[")) {
        try {
          pMuscles = JSON.parse(pMuscles);
        } catch (e) {}
      }
      if (typeof pMuscles === "string") pMuscles = [pMuscles];
      if (!pMuscles) return false;

      return pMuscles.some(m =>
        targets.includes(String(m).toLowerCase())
      );
    });

    filtered.forEach(ex => {
      const card = createExerciseCard(ex);
      container.appendChild(card);
    });
  }

  function createExerciseCard(ex) {
    const div = document.createElement("div");
    div.className = "exercise-card";
    div.draggable = true;
    div.textContent = ex.name;
    div.dataset.id = ex.id;

    div.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", JSON.stringify(ex));
    });

    div.addEventListener("click", () => {
      addToZone(ex, "#mainExercises");
    });

    return div;
  }

  ["#mainExercises", "#extraExercises"].forEach(sel => {
    const zone = qs(sel);
    zone.addEventListener("dragover", e => e.preventDefault());
    zone.addEventListener("drop", e => {
      e.preventDefault();
      const data = e.dataTransfer.getData("text/plain");
      if (data) {
        const ex = JSON.parse(data);
        addToZone(ex, sel);
      }
    });
  });

  function addToZone(ex, zoneSel) {
    const zone = qs(zoneSel);
    if (zone.querySelector(`[data-id="${ex.id}"]`)) return;

    const item = document.createElement("div");
    item.className = "exercise-item-in-list";
    item.innerHTML = `
      <span>${ex.name}</span>
      <button class="remove-btn">&times;</button>
    `;
    item.dataset.id = ex.id;
    item.dataset.obj = JSON.stringify(ex);

    item.querySelector(".remove-btn").addEventListener("click", () => {
      item.remove();
    });

    zone.appendChild(item);
  }

  const exerciseSearch = qs("#exerciseSearch");
  if (exerciseSearch) {
    exerciseSearch.addEventListener("input", renderPool);
  }

  // ---------- CARDIO LOGIKA ----------

  let selectedCardioId = null;

  function renderCardioList() {
    const container = qs("#cardioList");
    if (!container) return;
    container.innerHTML = "";

    CARDIO_ACTIVITIES.forEach(act => {
      const div = document.createElement("div");
      div.className = "cardio-item";
      div.textContent = `${act.name} (MET: ${act.met})`;
      div.dataset.id = act.id;

      div.addEventListener("click", () => {
        qsa(".cardio-item", container).forEach(el =>
          el.classList.remove("selected")
        );
        div.classList.add("selected");
        selectedCardioId = act.id;
        showCardioDurationInput(div);
      });

      container.appendChild(div);
    });
  }

  function showCardioDurationInput(parentDiv) {
    const old = qs("#cardioDurationInputWrapper");
    if (old) old.remove();

    const wrapper = document.createElement("div");
    wrapper.id = "cardioDurationInputWrapper";
    wrapper.style.marginTop = "10px";
    wrapper.innerHTML = `
      <label>Időtartam (perc): </label>
      <input type="number" id="cardioDurationVal" value="30" min="5" style="width:60px; padding:5px;">
    `;
    wrapper.addEventListener("click", e => e.stopPropagation());
    parentDiv.appendChild(wrapper);
  }

  // ---------- MENTÉS ----------

  qs("#lockDayBtn").addEventListener("click", async () => {
    const key = getCalendarKey(currentYear, currentMonth, selectedDay);

    if (workoutMode === "gym") {
      const mainItems = qsa("#mainExercises .exercise-item-in-list");
      const extraItems = qsa("#extraExercises .exercise-item-in-list");

      const mainIds = mainItems.map(el => parseInt(el.dataset.id));
      const extraIds = extraItems.map(el => parseInt(el.dataset.id));

      if (mainIds.length === 0 && extraIds.length === 0) {
        alert("Válassz legalább egy gyakorlatot!");
        return;
      }

      const durationInput = qs("#gymDurationInput");
      const durationVal = durationInput
        ? parseInt(durationInput.value)
        : 60;

      const payloadData = {
        duration: durationVal,
        main_ids: mainIds,
        extra_ids: extraIds
      };

      await saveWorkoutToServer(key, "gym", selectedSplit, payloadData);

      calendarData[key] = {
        mode: "gym",
        split: selectedSplit,
        data: payloadData,
        saved: true
      };
    } else {
      if (!selectedCardioId) {
        alert("Válassz kardió mozgást!");
        return;
      }

      const durInput = qs("#cardioDurationVal");
      const durationVal = durInput ? parseInt(durInput.value) : 30;

      const payloadData = {
        cardio_id: selectedCardioId,
        duration: durationVal
      };

      await saveWorkoutToServer(key, "cardio", null, payloadData);

      calendarData[key] = {
        mode: "cardio",
        data: payloadData,
        saved: true
      };
    }

    dayLocked = true;
    renderCalendar();
    switchView("calendar");
  });

  async function saveWorkoutToServer(dateStr, mode, dayType, dataObj) {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/workouts/", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          date: dateStr,
          mode: mode,
          day_type: dayType,
          data: dataObj
        })
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error("Hiba a mentésnél:", txt);
        alert("Hiba történt a mentés során!");
      } else {
        console.log("Sikeres mentés!");
      }
    } catch (err) {
      console.error(err);
      alert("Hálózati hiba!");
    }
  }

  function updateDashboard() {
    // ide majd jöhet regeneráció / fókusz logika
  }

  // ---------- INIT ----------

  document.addEventListener("DOMContentLoaded", async () => {
    qs("#backToCalendarBtn")?.addEventListener("click", () => {
      switchView("calendar");
    });
    qs("#calendarPrev")?.addEventListener("click", () => {
      handleMonthChange(-1);
    });
    qs("#calendarNext")?.addEventListener("click", () => {
      handleMonthChange(1);
    });
    qs("#closePopupBtn")?.addEventListener("click", hideSummaryPopup);
    qs("#dayPopup")?.addEventListener("click", e => {
      if (e.target === qs("#dayPopup")) hideSummaryPopup();
    });

    qs("#modeGym")?.addEventListener("click", () => !dayLocked && setWorkoutMode("gym"));
    qs("#modeCardio")?.addEventListener("click", () => !dayLocked && setWorkoutMode("cardio"));

    await fetchLoadLevel();
    await loadGymExercises();
    await loadCardioActivities();
    await fetchUserWorkouts();
    setupSplitSelector();
  });
})();
