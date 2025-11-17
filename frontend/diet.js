// =================================================
// DIET.HTML SPECIFIKUS LOGIKA
// =================================================

// --- ÁLLAPOT (State) ---
let selectedDate = new Date(); // A naptárban kiválasztott nap
let activeMealType = 'breakfast'; // 'breakfast', 'lunch', 'dinner', 'snacks'
let dailyLog = { // A kiválasztott nap ételei
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: []
};

// --- Elemek ---
// A $ és $$ segédfüggvényeket a globális script.js-ből kapjuk
const dayLabel = $('#dayLabel');
const modal = $('#foodSearchModal');
const modalTitle = $('#modalTitle');
const modalQueryInput = $('#modalFoodQuery');
const modalResults = $('#modalFoodResults');
const dailyFoodList = $('#dailyFoodList');
const emptyListMsg = $('#emptyListMsg');

/**
 * 1. NAPVÁLASZTÓ KEZELÉSE
 */
function initDayNavigator() {
    const prevBtn = $('#dayPrev');
    const nextBtn = $('#dayNext');
    const todayBtn = $('#dayToday');

    if (!prevBtn) return; // Csak akkor fut, ha léteznek az elemek

    prevBtn.addEventListener('click', () => {
        selectedDate.setDate(selectedDate.getDate() - 1);
        updateDayView();
    });
    nextBtn.addEventListener('click', () => {
        selectedDate.setDate(selectedDate.getDate() + 1);
        updateDayView();
    });
    todayBtn.addEventListener('click', () => {
        selectedDate = new Date();
        updateDayView();
    });

    updateDayView(); // Kezdő nézet beállítása
}

function updateDayView() {
    if (!dayLabel) return;
    
    const today = new Date();
    if (selectedDate.toDateString() === today.toDateString()) {
        dayLabel.textContent = "Mai nap";
    } else {
        dayLabel.textContent = selectedDate.toLocaleDateString('hu-HU', {
            month: 'short',
            day: 'numeric',
            weekday: 'short'
        });
    }

    // TODO: Adatbázisból betöltés
    dailyLog = { breakfast: [], lunch: [], dinner: [], snacks: [] };
    
    renderDailyFoodList();
    updateMacroDisplays(); // Frissítjük a diagramot is
}

/**
 * 2. ÉTKEZÉS FÜLEK ÉS MODAL KEZELÉSE
 */
function initMealTabs() {
    const tabs = $$('#mealTabs .meal-tab');
    const closeBtn = $('#modalCloseBtn');

    if (!tabs.length || !modal || !closeBtn) return;

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            activeMealType = tab.dataset.meal;
            modalTitle.textContent = `Étel keresése: ${tab.textContent}`;
            
            modal.style.display = 'grid';
            modalQueryInput.value = '';
            modalResults.innerHTML = `<p class="muted" style="padding: 10px 0;">Írj be legalább 3 karaktert a kereséshez.</p>`;
            modalQueryInput.focus();
        });
    });

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    modalQueryInput.addEventListener('input', () => doFoodSearch(true));
}

/**
 * 3. ÉTEL HOZZÁADÁSA ÉS LISTÁZÁSA
 */
function addFoodToLog(foodItem) {
    dailyLog[activeMealType].push(foodItem);
    renderDailyFoodList();
    updateMacroDisplays();
    modal.style.display = 'none';
}

function renderDailyFoodList() {
    if (!dailyFoodList) return;
    dailyFoodList.innerHTML = '';
    let totalItems = 0;
    const mealTitles = { breakfast: 'Reggeli', lunch: 'Ebéd', dinner: 'Vacsora', snacks: 'Nasi' };

    for (const mealType in dailyLog) {
        const items = dailyLog[mealType];
        if (items.length > 0) {
            totalItems += items.length;
            const title = document.createElement('h4');
            title.textContent = mealTitles[mealType];
            dailyFoodList.appendChild(title);

            items.forEach(item => {
                const row = document.createElement('div');
                row.className = 'meal-item';
                row.innerHTML = `
                    <span>${item.name} <small class="muted">(100g)</small></span>
                    <span class="kcal">${Math.round(item.kcal)} kcal</span>
                `;
                dailyFoodList.appendChild(row);
            });
        }
    }

    if (totalItems === 0) {
        if (emptyListMsg) emptyListMsg.style.display = 'block';
    } else {
        if (emptyListMsg) emptyListMsg.style.display = 'none';
    }
}

/**
 * 4. MAKRÓ SZÁMÍTÁS (Felülírja a script.js-ben lévő üres függvényt)
 * EZ A VERZIÓ KÜLÖN KEZELI A KALÓRIÁT (KÖR) ÉS A MAKRÓKAT (SÁVOK)
 * JAVÍTVA A 0% RENDERELÉSI HIBÁVAL
 */
/**
 * 4. MAKRÓ SZÁMÍTÁS (az új körös dizájnhoz igazítva)
 */
/**
 * 4. MAKRÓ SZÁMÍTÁS (az új, statikus nagy kör + 3 kicsi dizájnhoz)
 */
function updateMacroDisplays() {
    // --- 1. ÖSSZES FOGYASZTÁS KISZÁMÍTÁSA (grammban) ---
    let pConsumed = 0, cConsumed = 0, fConsumed = 0, calConsumed = 0;

    for (const mealType in dailyLog) {
        dailyLog[mealType].forEach(item => {
            pConsumed += (item.p || 0);
            cConsumed += (item.c || 0);
            fConsumed += (item.f || 0);
            calConsumed += (item.kcal || 0);
        });
    }

    // --- 2. CÉL MAKRÓK (a globális 'targetMacros'-ból) ---
    const pGoal = targetMacros.p > 0 ? targetMacros.p : 1;
    const cGoal = targetMacros.c > 0 ? targetMacros.c : 1;
    const fGoal = targetMacros.f > 0 ? targetMacros.f : 1;
    const calGoal = targetMacros.cal > 0 ? targetMacros.cal : 1;

    // --- 3. FŐ KALÓRIA KÖR FRISSÍTÉSE (CSAK A SZÁM) ---
    const calorieCircle = $('#calorieCircle');
    const remainingKcalValue = $('#remainingKcalValue');

    if (calorieCircle && remainingKcalValue) {
        const calRemaining = Math.round(targetMacros.cal - calConsumed);
        remainingKcalValue.textContent = calRemaining;

        // Szín frissítése túllépés esetén
        if (calRemaining < 0) {
            calorieCircle.classList.add('over-limit');
        } else {
            calorieCircle.classList.remove('over-limit');
        }
    }

    // --- 4. KIS MAKRÓ KÖRÖK FRISSÍTÉSE (SZÁM + PROGRESS) ---

    // FEHÉRJE
    const proteinCircle = $('#proteinCircle');
    const proteinValue = $('#proteinValue');
    if (proteinCircle && proteinValue) {
        const pRemaining = Math.round(targetMacros.p - pConsumed);
        // A progress a HÁTRALÉVŐ százalékot mutatja
        const pProgressPercent = Math.max(0, Math.min(100, (pRemaining / pGoal) * 100));

        proteinValue.textContent = pRemaining;
        proteinCircle.style.setProperty('--progress-percent', `${pProgressPercent}%`);

        if (pRemaining < 0) {
            proteinCircle.classList.add('over-limit');
        } else {
            proteinCircle.classList.remove('over-limit');
        }
    }

    // SZÉNHIDRÁT
    const carbsCircle = $('#carbsCircle');
    const carbsValue = $('#carbsValue');
    if (carbsCircle && carbsValue) {
        const cRemaining = Math.round(targetMacros.c - cConsumed);
        const cProgressPercent = Math.max(0, Math.min(100, (cRemaining / cGoal) * 100));

        carbsValue.textContent = cRemaining;
        carbsCircle.style.setProperty('--progress-percent', `${cProgressPercent}%`);

        if (cRemaining < 0) {
            carbsCircle.classList.add('over-limit');
        } else {
            carbsCircle.classList.remove('over-limit');
        }
    }

    // ZSÍR
    const fatCircle = $('#fatCircle');
    const fatValue = $('#fatValue');
    if (fatCircle && fatValue) {
        const fRemaining = Math.round(targetMacros.f - fConsumed);
        const fProgressPercent = Math.max(0, Math.min(100, (fRemaining / fGoal) * 100));

        fatValue.textContent = fRemaining;
        fatCircle.style.setProperty('--progress-percent', `${fProgressPercent}%`);

        if (fRemaining < 0) {
            fatCircle.classList.add('over-limit');
        } else {
            fatCircle.classList.remove('over-limit');
        }
    }
}


/**
 * 5. ÉTEL KERESŐ (Csak a modal-ban fut)
 */
async function doFoodSearch(isModal = false) {
    if (!isModal) return;
    
    const q = (modalQueryInput.value || '').toLowerCase().trim();
    if (q.length < 3) {
        modalResults.innerHTML = `<p class="muted" style="padding: 10px 0;">Írj be legalább 3 karaktert a kereséshez.</p>`;
        return;
    }

    modalResults.innerHTML = `<div style="padding:10px;color:var(--muted)">${LANG === 'hu' ? 'Keresés...' : 'Searching...'}</div>`;

    try {
        const res = await fetch(`/api/v1/foods/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error((await res.json()).detail || 'Hálózati hiba');
        
        const list = await res.json();
        modalResults.innerHTML = '';
        if (!list.length) {
            modalResults.innerHTML = `<div style="padding:10px;color:var(--muted)">${LANG === 'hu' ? 'Nincs találat.' : 'No results.'}</div>`;
            return;
        }

        list.forEach(item => {
            const row = document.createElement('div');
            row.className = 'result';
            const kcal = Math.round(item.kcal_100g || 0);
            const p = Math.round(item.protein_100g || 0);
            const c = Math.round(item.carbs_100g || 0);
            const f = Math.round(item.fat_100g || 0);

            row.innerHTML = `<span>${item.food_name} <small class="muted">(${kcal} kcal • P${p}/C${c}/F${f})</small></span><button>${(LANG === 'hu') ? 'Hozzáad' : 'Add'}</button>`;
            row.querySelector('button').addEventListener('click', () => addFoodToLog({ name: item.food_name, kcal: kcal, p: p, c: c, f: f }));
            modalResults.appendChild(row);
        });

    } catch (err) {
        console.error(err);
        modalResults.innerHTML = `<div style="padding:10px;color:var(--err)">${LANG === 'hu' ? 'Hiba a keresés közben.' : 'Error during search.'}</div>`;
    }
}

// --- INDÍTÁS (csak a diet.html oldalon) ---
document.addEventListener('DOMContentLoaded', () => {
    // Ellenőrizzük, hogy biztosan a diéta oldalon vagyunk-e
    if ($('#diet-panel-top')) {
        initDayNavigator();
        initMealTabs();
        // A makrókat a globális script.js fogja frissíteni bejelentkezés után,
        // de mi lefuttatjuk, hogy 0-ról induljon.
        updateMacroDisplays();
    }
});