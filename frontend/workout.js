// workout.js – csak az edzésterv-összeállító panelhez

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

  // ---------- NAPTÁR ----------

  function renderCalendar() {
    const list = qs('#calendarList');
    const label = qs('#calendarCurrentLabel');
    if (!list) return;

    list.innerHTML = '';

    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 30);

    let start = registrationDate ? new Date(registrationDate) : new Date();
    if (!registrationDate) {
      // fallback: 2 hétre vissza
      start.setDate(start.getDate() - 14);
    }

    if (!selectedDateKey) {
      selectedDateKey = dateKey(today);
    }

    let d = new Date(start);
    while (d <= end) {
      const key = dateKey(d);
      const dayData = calendarData[key];

      const item = document.createElement('div');
      item.className = 'calendar-day';
      if (key === selectedDateKey) item.classList.add('active');
      if (dayData) item.classList.add('filled');

      const summary = dayData
        ? [...dayData.main, ...dayData.extra].map(x => x.name).join(', ')
        : 'Nincs edzés';

      item.dataset.dateKey = key;
      item.innerHTML = `
        <div class="calendar-date">
          <span class="calendar-dayname">${d.toLocaleDateString('hu-HU', { weekday: 'short' })}</span>
          <span class="calendar-datenum">${d.getFullYear()}. ${String(d.getMonth()+1).padStart(2,'0')}. ${String(d.getDate()).padStart(2,'0')}.</span>
        </div>
        <div class="calendar-summary">${summary}</div>
      `;

      item.addEventListener('click', () => {
        selectCalendarDay(key);
      });

      list.appendChild(item);
      d.setDate(d.getDate() + 1);
    }

    if (label) {
      label.textContent = prettyDate(new Date(selectedDateKey));
    }
  }

  function selectCalendarDay(key) {
    selectedDateKey = key;
    const data = calendarData[key];

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
      selectedDateKey = dateKey(new Date());
    }

    renderExercisePool();
    renderDropzones();
    renderCalendar();
    initLockButton();
  }

  document.addEventListener('DOMContentLoaded', setupWorkoutUI);
})();
