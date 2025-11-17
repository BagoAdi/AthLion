// workout.js – edzésterv-összeállító + havi naptár

(function () {
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Ha máshol nincs beállítva, default magyar
  let LANG = window.LANG || 'hu';

  // Demo gyakorlatok – backendről / DB-ből később simán cserélhető
  const EXERCISES = [
    { id: 'squat', name: 'Guggolás', tag: 'Láb' },
    { id: 'bench', name: 'Fekvenyomás', tag: 'Mell' },
    { id: 'deadlift', name: 'Felhúzás', tag: 'Hát' },
    { id: 'ohp', name: 'Vállnyomás', tag: 'Váll' },
    { id: 'row', name: 'Evezés döntött törzzsel', tag: 'Hát' },
    { id: 'pullup', name: 'Húzódzkodás', tag: 'Hát' },
    { id: 'dip', name: 'Tolódzkodás', tag: 'Mell/Kar' },
    { id: 'lunge', name: 'Kitörés', tag: 'Láb' },
    { id: 'plank', name: 'Plank', tag: 'Core' },
    { id: 'cardio', name: 'Kardió gép (futópad / ellipszis)', tag: 'Kardió' }
  ];

  const TRAINING_SCHEDULES = {
    'Könnyű':  [1, 4],              // H, Cs
    'Közepes': [1, 3, 5],           // H, Sze, P
    'Nehéz':   [1, 2, 4, 5, 6]      // H, K, Cs, P, Szo
  };

  let loadLevel = null;

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
      loadLevel = "Közepes"; // fallback
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

  function renderExercisePool() {
    const pool = qs('#exercisePool');
    if (!pool) return;
    pool.innerHTML = '';

    EXERCISES.forEach(ex => {
      const pill = document.createElement('div');
      pill.className = 'exercise-pill';
      pill.draggable = !dayLocked;
      pill.dataset.id = ex.id;
      pill.innerHTML = `
        <span>${ex.name}</span>
        <span class="tag">${ex.tag}</span>
      `;

      pill.addEventListener('dragstart', e => {
        if (dayLocked) { e.preventDefault(); return; }
        e.dataTransfer.setData('text/plain', ex.id);
      });

      // Kattintással is hozzáadható
      pill.addEventListener('click', () => {
        if (dayLocked) return;
        addExerciseToBuilder('main', ex.id);
      });

      pool.appendChild(pill);
    });
  }

  // ---------- DROPZÓNÁK ----------

  function renderDropzones() {
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
      if (dayData) cell.classList.add('filled');
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

    // ha másik hónapot kattintottunk, arra a hónapra ugrunk
    calendarMonth = new Date(d.getFullYear(), d.getMonth(), 1);

    if (data) {
      mainExercises = [...data.main];
      extraExercises = [...data.extra];
      dayLocked = true;
    } else {
      mainExercises = [];
      extraExercises = [];
      dayLocked = false;
    }

    renderExercisePool();
    renderDropzones();
    renderCalendar();
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
    if (!btn) return;

    const total = mainExercises.length + extraExercises.length;
    btn.disabled = dayLocked || mainExercises.length < 3 || total < 3;
    btn.textContent = dayLocked ? 'Nap lezárva' : 'Nap lezárása';
  }

  function initLockButton() {
    const btn = qs('#lockDayBtn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      if (dayLocked) return;
      if (mainExercises.length < 3) {
        alert('Legalább 3 fő gyakorlat szükséges a nap lezárásához.');
        return;
      }

      const key = selectedDateKey || dateKey(new Date());
      calendarData[key] = {
        main: [...mainExercises],
        extra: [...extraExercises]
      };
      dayLocked = true;
      renderDropzones();
      renderCalendar();

      // IDE jön majd a backend POST /api/v1/workouts
    });
  }

  // ---------- INIT ----------

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
    setupWorkoutUI();
  });
})();
