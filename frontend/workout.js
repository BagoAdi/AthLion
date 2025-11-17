(function () {
  const qs  = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  let LANG = window.LANG || 'hu';

  // --- STATE ---

  // backendről jövő gyakorlatok (csak edzőterem mód)
  let EXERCISES = [];

  // aktuális mód: 'gym' vagy 'cardio'
  let workoutMode = 'gym';

  // aktuális edzésnap téma: push | pull | legs
  let dayTheme = 'push';

  const TRAINING_SCHEDULES = {
    'Könnyű':  [1, 4],              // H, Cs
    'Közepes': [1, 3, 5],           // H, Sze, P
    'Nehéz':   [1, 2, 4, 5, 6]      // H, K, Cs, P, Szo
  };
  // Push–Pull–Legs ciklus
  const WORKOUT_SPLIT = ['push', 'pull', 'legs'];

  const DIFFICULTY_MAP = {
    'Könnyű': 'beginner',
    'Közepes': 'intermediate',
    'Nehéz': 'expert'
  };

  let loadLevel = null;

  // Aktuális mód: 'gym' | 'cardio' | null
  // Csak gym napokra: 'push' | 'pull' | 'legs'

  // Kardió adatok
  let cardioActivities = [];
  let cardioSelection = null;


  async function fetchLoadLevel() {
    try {
      const res = await fetch("/api/v1/users/me", {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Hiba a load level lekérésénél");

      const data = await res.json();
      loadLevel = data.training_profile?.load_level || "Közepes";
    } catch (err) {
      console.error(err);
      loadLevel = "Közepes";
    }
  }


  // builder state
  let mainExercises = [];    // 3 fő
  let extraExercises = [];   // max +3
  let dayLocked = false;

  // naptár state
  let calendarData = {};     // { 'YYYY-MM-DD': { main:[{id,name}], extra:[...] } }
  let selectedDateKey = null;

  // opcionális: ha auth kódból beállítod:
  // window.AthlionRegistrationDate = "2025-11-10T00:00:00Z";
  let registrationDate = window.AthlionRegistrationDate
    ? new Date(window.AthlionRegistrationDate)
    : null;

  // melyik hónap van épp megjelenítve (első napra állítva)
  let calendarMonth = new Date();
  calendarMonth.setDate(1);

  function dateKey(d) {
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  function prettyDate(d) {
    const dn = d.toLocaleDateString('hu-HU', { weekday: 'short' });
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}. ${m}. ${day}. (${dn})`;
  }

  // ---------- GYAKORLATLISTA ----------

    async function loadGymExercises() {
    try {
      const res = await fetch("/api/v1/exercises", {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Hiba az edzésgyakorlatok lekérésénél");
      EXERCISES = await res.json();
    } catch (err) {
      console.error(err);
      EXERCISES = [];
    }
  }

  async function loadCardioActivities() {
    try {
      const res = await fetch("/api/v1/physical_activities", {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Hiba a kardió aktivitások lekérésénél");
      const data = await res.json();

      // pl. szűrés, hogy lawn/gardening ne legyen
      cardioActivities = data.filter(a => {
        const name = (a.name || a.specific_activity || "").toLowerCase();
        return !name.includes("lawn") && !name.includes("gardening");
      });
    } catch (err) {
      console.error(err);
      cardioActivities = [];
    }
  }

    async function fetchExercisesForTheme() {
    // loadLevel a usertől jön: beginner / intermediate / expert-re konvertálunk
    let level = "all";
    if (loadLevel) {
      const lvlMap = {
        "Könnyű": "beginner",
        "Közepes": "intermediate",
        "Nehéz": "expert"
      };
      level = lvlMap[loadLevel] || "all";
    }

    const params = new URLSearchParams({
      theme: dayTheme,
      level: level,
      limit: "100"
    });

    try {
      const res = await fetch(`/api/v1/exercises?${params.toString()}`, {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Hiba a gyakorlatok lekérésénél");
      const data = await res.json();

      // backend: {id, name, level, force, primary_muscles, ...}
      EXERCISES = data.map(ex => ({
        id: ex.id.toString(),
        name: ex.name,
        tag: ex.primary_muscles || ex.category || ""
      }));

      renderExercisePool();
    } catch (err) {
      console.error(err);
      // fallback: ha elszáll, EXERCISES maradhat üres vagy tehetsz ide pár default gyakszit
    }
  }

  async function fetchCardioActivities() {
    const select = qs('#cardioActivitySelect');
    const meta   = qs('#cardioActivityMeta');
    if (!select) return;

    try {
      const res = await fetch('/api/v1/physical_activities?limit=150', {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Hiba a kardió aktivitások lekérésénél");

      const data = await res.json();
      // data: {id, name, met, major_heading}
      select.innerHTML = '';

      data.forEach(act => {
        const opt = document.createElement('option');
        opt.value = act.id;
        const label = act.major_heading
          ? `${act.name} (${act.major_heading}, ${act.met.toFixed(1)} MET)`
          : `${act.name} (${act.met.toFixed(1)} MET)`;
        opt.textContent = label;
        opt.dataset.met = act.met;
        select.appendChild(opt);
      });

      if (data.length && meta) {
        const first = data[0];
        meta.textContent = `Becsült intenzitás: ${first.met.toFixed(1)} MET`;
      }

      select.addEventListener('change', () => {
        const opt = select.selectedOptions[0];
        if (!opt || !meta) return;
        const met = opt.dataset.met;
        meta.textContent = `Becsült intenzitás: ${Number(met).toFixed(1)} MET`;
      });

    } catch (err) {
      console.error(err);
      if (meta) meta.textContent = "Nem sikerült betölteni a kardió aktivitásokat.";
    }
  }



  function renderExercisePool() {
    if (workoutMode !== 'gym') return;
    const pool = qs('#exercisePool');
    if (!pool) return;
    pool.innerHTML = '';

    const list = filterExercisesForContext();

    list.forEach(ex => {
      const pill = document.createElement('div');
      pill.className = 'exercise-pill';
      pill.draggable = !dayLocked;
      pill.dataset.id = ex.id;

      const tag = getExerciseTag(ex);

      pill.innerHTML = `
        <span>${ex.name}</span>
        <span class="tag">${tag}</span>
      `;

      pill.addEventListener('dragstart', e => {
        if (dayLocked) { e.preventDefault(); return; }
        e.dataTransfer.setData('text/plain', ex.id);
      });

      pill.addEventListener('click', () => {
        if (dayLocked) return;
        addExerciseToBuilder('main', ex.id);
      });

      pool.appendChild(pill);
    });
  }


  function determineDayTypeForNewGymDay() {
    // csak a gym napok számítanak
    const gymDaysSoFar = Object.values(calendarData).filter(d => d.mode === 'gym').length;
    currentDayType = WORKOUT_SPLIT[gymDaysSoFar % WORKOUT_SPLIT.length];
    updateDayTypeLabel();
  }

  function updateDayTypeLabel() {
    const label = qs('#dayTypeLabel');
    if (!label) return;

    if (dayLocked && workoutMode === 'gym' && currentDayType) {
      const mapHu = { push: 'Push day (mell/váll/tricepsz)', pull: 'Pull day (hát/bicepsz)', legs: 'Leg day (láb)' };
      label.textContent = `Mai edzésnap: ${mapHu[currentDayType] || currentDayType}`;
    } else if (!workoutMode) {
      label.textContent = 'Válaszd ki a módot a fenti gombokkal.';
    } else if (workoutMode === 'cardio') {
      label.textContent = 'Kardió nap – válassz egy aktivitást a listából.';
    } else if (workoutMode === 'gym' && currentDayType) {
      const mapHu = { push: 'Push day (mell/váll/tricepsz)', pull: 'Pull day (hát/bicepsz)', legs: 'Leg day (láb)' };
      label.textContent = `Mai edzésnap: ${mapHu[currentDayType] || currentDayType}`;
    }
  }

  function filterExercisesForContext() {
    if (workoutMode !== 'gym') return [];

    const userDiff = DIFFICULTY_MAP[loadLevel] || null;

    return EXERCISES.filter(ex => {
      // nehézség
      if (userDiff && ex.level && ex.level !== userDiff) return false;

      if (!currentDayType) return true;

      const prim = (ex.primaryMuscles && ex.primaryMuscles[0] || "").toLowerCase();

      if (currentDayType === 'push') {
        return ['chest', 'shoulders', 'triceps'].some(m => prim.includes(m));
      }
      if (currentDayType === 'pull') {
        return ['back', 'biceps'].some(m => prim.includes(m));
      }
      if (currentDayType === 'legs') {
        return ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors'].some(m => prim.includes(m));
      }
      return true;
    });
  }

  function getExerciseTag(ex) {
    const level = ex.level || '';
    const prim = ex.primaryMuscles && ex.primaryMuscles[0] ? ex.primaryMuscles[0] : '';
    if (level && prim) return `${prim} · ${level}`;
    if (prim) return prim;
    if (level) return level;
    return '';
  }

  //ui váltás
  function setWorkoutMode(mode) {
    if (dayLocked && selectedDateKey && calendarData[selectedDateKey]) {
      // lezárt napnál ne lehessen módot váltani
      return;
    }

    workoutMode = mode;
    cardioSelection = null;

    const gymBuilder = qs('#gymBuilder');
    const cardioBuilder = qs('#cardioBuilder');
    const btnCardio = qs('#modeCardio');
    const btnGym = qs('#modeGym');

    [btnCardio, btnGym].forEach(btn => btn && btn.classList.remove('active'));

    if (mode === 'gym') {
      btnGym && btnGym.classList.add('active');
      if (gymBuilder) gymBuilder.style.display = '';
      if (cardioBuilder) cardioBuilder.style.display = 'none';

      // új nap → push/pull/legs ciklus
      if (!calendarData[selectedDateKey]) {
        determineDayTypeForNewGymDay();
      }

      renderExercisePool();
      renderDropzones();
    } else if (mode === 'cardio') {
      btnCardio && btnCardio.classList.add('active');
      if (cardioBuilder) cardioBuilder.style.display = '';
      if (gymBuilder) gymBuilder.style.display = 'none';

      renderCardioList();
    } else {
      if (gymBuilder) gymBuilder.style.display = 'none';
      if (cardioBuilder) cardioBuilder.style.display = 'none';
    }

    updateDayTypeLabel();
    updateLockButton();
  }

  function setupModeSelector() {
    const btnCardio = qs('#modeCardio');
    const btnGym = qs('#modeGym');

    if (btnCardio) {
      btnCardio.addEventListener('click', () => {
        if (!cardioActivities.length) {
          loadCardioActivities().then(() => {
            setWorkoutMode('cardio');
          });
        } else {
          setWorkoutMode('cardio');
        }
      });
    }

    if (btnGym) {
      btnGym.addEventListener('click', () => {
        if (!EXERCISES.length) {
          loadGymExercises().then(() => {
            setWorkoutMode('gym');
          });
        } else {
          setWorkoutMode('gym');
        }
      });
    }
  }

  //kardió lista render
  function renderCardioList() {
    const container = qs('#cardioList');
    if (!container) return;

    container.innerHTML = '';

    if (!cardioActivities.length) {
      const p = document.createElement('p');
      p.className = 'muted small';
      p.textContent = 'Nincs elérhető kardió aktivitás.';
      container.appendChild(p);
      return;
    }

    cardioActivities.forEach(act => {
      const div = document.createElement('div');
      div.className = 'cardio-item';

      div.innerHTML = `
        <span>${act.name || act.specific_activity}</span>
        <span class="muted small">${act.mets ? act.mets + ' MET' : ''}</span>
      `;

      div.addEventListener('click', () => {
        cardioSelection = act;
        qsa('.cardio-item', container).forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        updateLockButton();
      });

      container.appendChild(div);
    });
  }


  // ---------- DROPZÓNÁK ----------

  function renderDropzones() {
      if (workoutMode !== 'gym') {
      // gym UI rejtve
      return;
    }

    const mainZone = qs('#mainExercises');
    const extraZone = qs('#extraExercises');
    const info = qs('#lockInfo');

    if (!mainZone || !extraZone) return;

    // fő
    mainZone.innerHTML = '';
    if (!mainExercises.length) {
      const sp = document.createElement('span');
      sp.className = 'dropzone-placeholder';
      sp.textContent = 'Húzd ide a fő gyakorlatokat';
      mainZone.appendChild(sp);
    } else {
      mainExercises.forEach(ex => {
        const pill = document.createElement('div');
        pill.className = 'exercise-pill' + (dayLocked ? ' locked' : '');
        pill.textContent = ex.name;

        if (!dayLocked) {
          pill.addEventListener('click', () => {
            mainExercises = mainExercises.filter(e => e.id !== ex.id);
            renderDropzones();
            updateLockButton();
          });
        }

        mainZone.appendChild(pill);
      });
    }

    // extra
    extraZone.innerHTML = '';
    if (!extraExercises.length) {
      const sp = document.createElement('span');
      sp.className = 'dropzone-placeholder';
      sp.textContent = 'Ajánlott +3 gyakorlat fog ide kerülni';
      extraZone.appendChild(sp);
    } else {
      extraExercises.forEach(ex => {
        const pill = document.createElement('div');
        pill.className = 'exercise-pill' + (dayLocked ? ' locked' : '');
        pill.textContent = ex.name;

        if (!dayLocked) {
          pill.addEventListener('click', () => {
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
      zone.classList.toggle('locked', dayLocked);

      zone.ondragover = e => {
        if (dayLocked) return;
        e.preventDefault();
        zone.classList.add('active');
      };
      zone.ondragleave = () => zone.classList.remove('active');
      zone.ondrop = e => {
        if (dayLocked) return;
        e.preventDefault();
        zone.classList.remove('active');
        const id = e.dataTransfer.getData('text/plain');
        const slot = zone.id === 'mainExercises' ? 'main' : 'extra';
        addExerciseToBuilder(slot, id);
      };
    });

    if (info) {
      info.textContent = dayLocked
        ? 'Ez a nap lezárva. A naptárból visszanézheted, de nem módosítható.'
        : 'Válassz ki legalább 3 gyakorlatot a nap lezárásához.';
    }

    updateLockButton();
  }

  function addExerciseToBuilder(slot, id) {
    const ex = EXERCISES.find(e => e.id === id);
    if (!ex) return;

    const already = [...mainExercises, ...extraExercises].some(e => e.id === id);
    if (already) return;

    if (slot === 'main') {
      if (mainExercises.length >= 3) return;
      mainExercises.push(ex);
    } else {
      if (mainExercises.length + extraExercises.length >= 6) return;
      extraExercises.push(ex);
    }

    // ha épp most lett meg a 3 fő és még nincs extra → ajánlunk +3-at
    if (mainExercises.length === 3 && extraExercises.length === 0) {
      const suggestions = EXERCISES
        .filter(e => !mainExercises.some(m => m.id === e.id))
        .slice(0, 3);
      extraExercises = suggestions;
    }

    renderDropzones();
  }

  // ---------- NAPTÁR (HAVI GRID) ----------

  function renderCalendar() {
    const grid = qs('#calendarList');
    const label = qs('#calendarCurrentLabel');
    const monthLabel = qs('#calendarMonthLabel');
    if (!grid) return;

    grid.innerHTML = '';

    // ha nincs selectedDate, induljunk ma-ról
    const today = new Date();
    if (!selectedDateKey) {
      selectedDateKey = dateKey(today);
    }

    // ha nincs beállítva a hónap, igazítsuk a selectedhez
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

    // Havi cím
    if (monthLabel) {
      monthLabel.textContent = firstOfMonth.toLocaleDateString('hu-HU', {
        year: 'numeric',
        month: 'long'
      });
    }

    // 6 sor * 7 oszlop = 42 cella
    for (let i = 0; i < 42; i++) {
      const cell = document.createElement('div');

      const dayNum = i - offset + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        cell.className = 'calendar-day empty';
        grid.appendChild(cell);
        continue;
      }

      const d = new Date(y, m, dayNum);
      const key = dateKey(d);
      const dayData = calendarData[key];
      const isSelected = key === selectedDateKey;
      const isToday = key === dateKey(today);

      cell.className = 'calendar-day';

      const wd = d.getDay();  // 0=V,1=H,2=K...
      const schedule = TRAINING_SCHEDULES[loadLevel] || [];

      if (schedule.includes(wd)) {
          cell.classList.add('train-day');
      } else {
          cell.classList.add('rest-day');
      }

      if (isSelected) cell.classList.add('active');
      if (dayData) {
        cell.classList.add('filled');
        if (dayData.mode === 'gym') {
          cell.classList.add('gym-day');
        } else if (dayData.mode === 'cardio') {
          cell.classList.add('cardio-day');
        }
      }
      if (isToday) cell.classList.add('today');

      // összegzés: hány gyakorlat
      let summary = '';
      if (dayData) {
        const count = (dayData.main?.length || 0) + (dayData.extra?.length || 0);
        if (count > 0) summary = `${count} gyakorlat`;
      }

      cell.dataset.dateKey = key;
      cell.innerHTML = `
        <div class="calendar-date">
          <span class="calendar-dayname">${d.toLocaleDateString('hu-HU', { weekday: 'short' })}</span>
          <span class="calendar-datenum">${dayNum}</span>
        </div>
        <div class="calendar-summary">${summary}</div>
      `;

      cell.addEventListener('click', () => {
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

      if (workoutMode === 'gym') {
        mainExercises = [...(data.main || [])];
        extraExercises = [...(data.extra || [])];
        currentDayType = data.dayType || null;

        const gymBuilder = qs('#gymBuilder');
        const cardioBuilder = qs('#cardioBuilder');
        if (gymBuilder) gymBuilder.style.display = '';
        if (cardioBuilder) cardioBuilder.style.display = 'none';
        qs('#modeGym')?.classList.add('active');
        qs('#modeCardio')?.classList.remove('active');

        renderExercisePool();
        renderDropzones();
      } else if (workoutMode === 'cardio') {
        cardioSelection = data.cardio || null;

        const gymBuilder = qs('#gymBuilder');
        const cardioBuilder = qs('#cardioBuilder');
        if (cardioBuilder) cardioBuilder.style.display = '';
        if (gymBuilder) gymBuilder.style.display = 'none';
        qs('#modeCardio')?.classList.add('active');
        qs('#modeGym')?.classList.remove('active');

        renderCardioList();
        // jelöljük szelektáltként, ha tudod az ID-t egyeztetni
      }
    } else {
      // új nap
      dayLocked = false;
      workoutMode = null;
      currentDayType = null;
      mainExercises = [];
      extraExercises = [];
      cardioSelection = null;

      const gymBuilder = qs('#gymBuilder');
      const cardioBuilder = qs('#cardioBuilder');
      if (gymBuilder) gymBuilder.style.display = 'none';
      if (cardioBuilder) cardioBuilder.style.display = 'none';

      qs('#modeCardio')?.classList.remove('active');
      qs('#modeGym')?.classList.remove('active');

      renderExercisePool();
      renderDropzones();
    }

    updateDayTypeLabel();
    renderCalendar();
    updateLockButton();

    const label = qs('#calendarCurrentLabel');
    if (label) {
      label.textContent = prettyDate(new Date(selectedDateKey));
    }
  }


  function setupCalendarNav() {
    const prev = qs('#calendarPrev');
    const next = qs('#calendarNext');

    if (prev) {
      prev.addEventListener('click', () => {
        calendarMonth.setMonth(calendarMonth.getMonth() - 1);
        renderCalendar();
      });
    }
    if (next) {
      next.addEventListener('click', () => {
        calendarMonth.setMonth(calendarMonth.getMonth() + 1);
        renderCalendar();
      });
    }
  }

  // ---------- LOCK GOMB ----------

  function updateLockButton() {
    const btn = qs('#lockDayBtn');
    const info = qs('#lockInfo');
    if (!btn) return;

    if (dayLocked) {
      btn.disabled = true;
      btn.textContent = 'Nap lezárva';
      if (info) info.textContent = 'Ez a nap lezárva. A naptárból visszanézheted, de nem módosítható.';
      return;
    }

    if (!workoutMode) {
      btn.disabled = true;
      btn.textContent = 'Nap lezárása';
      if (info) info.textContent = 'Először válaszd ki a módot (kardió vagy edzőtermi).';
      return;
    }

    if (workoutMode === 'gym') {
      const total = mainExercises.length + extraExercises.length;
      btn.disabled = mainExercises.length < 3 || total < 3;
      btn.textContent = 'Nap lezárása';
      if (info) info.textContent = 'Válassz ki legalább 3 fő gyakorlatot a nap lezárásához.';
    } else if (workoutMode === 'cardio') {
      btn.disabled = !cardioSelection;
      btn.textContent = 'Nap lezárása';
      if (info) info.textContent = 'Válassz ki egy kardió aktivitást, majd zárd le a napot.';
    }
  }


  function initLockButton() {
    const btn = qs('#lockDayBtn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      if (dayLocked || !workoutMode) return;

      const key = selectedDateKey || dateKey(new Date());

      if (workoutMode === 'gym') {
        if (mainExercises.length < 3) {
          alert('Legalább 3 fő gyakorlat szükséges a nap lezárásához.');
          return;
        }
        calendarData[key] = {
          mode: 'gym',
          dayType: currentDayType,
          main: [...mainExercises],
          extra: [...extraExercises]
        };
      } else if (workoutMode === 'cardio') {
        if (!cardioSelection) {
          alert('Válassz ki egy kardió aktivitást.');
          return;
        }
        calendarData[key] = {
          mode: 'cardio',
          cardio: { ...cardioSelection }
        };
      }

      dayLocked = true;
      renderDropzones();
      renderCalendar();
      updateLockButton();

      // TODO: ide jöhet majd a backend POST /api/v1/workouts
    });
  }


  // ---------- INIT ----------

  function setupModeToggle() {
    const modeGym   = qs('#modeGym');
    const modeCardio = qs('#modeCardio');
    const gymBuilder = qs('#gymBuilder');
    const cardioBuilder = qs('#cardioBuilder');

    if (!modeGym || !modeCardio || !gymBuilder || !cardioBuilder) return;

    const setMode = (mode) => {
      workoutMode = mode;

      modeGym.classList.toggle('active', mode === 'gym');
      modeCardio.classList.toggle('active', mode === 'cardio');

      gymBuilder.classList.toggle('hidden', mode !== 'gym');
      cardioBuilder.classList.toggle('hidden', mode !== 'cardio');

      if (mode === 'gym') {
        fetchExercisesForTheme();
      } else {
        fetchCardioActivities();
      }
    };

    modeGym.addEventListener('click', () => setMode('gym'));
    modeCardio.addEventListener('click', () => setMode('cardio'));

    // alapértelmezés: edzőterem
    setMode('gym');
  }

  function setupThemeToggle() {
    const container = qs('#gymThemeToggle');
    if (!container) return;

    const buttons = qsa('button[data-theme]', container);

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        if (!theme) return;

        dayTheme = theme;
        buttons.forEach(b => b.classList.toggle('active', b === btn));

        if (workoutMode === 'gym') {
          fetchExercisesForTheme();
        }
      });
    });
  }

  function setupWorkoutUI() {
    const panel = qs('#workout');
    if (!panel) return;

    if (!selectedDateKey) {
      const today = new Date();
      selectedDateKey = dateKey(today);
      calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    renderExercisePool();
    renderDropzones();
    setupCalendarNav();
    renderCalendar();
    initLockButton();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await fetchLoadLevel();
    setupModeToggle();
    setupThemeToggle();
    setupWorkoutUI();
  });
})();
