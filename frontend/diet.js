// =================================================
// DIET.HTML SPECIFIKUS LOGIKA
// =================================================

// --- ÁLLAPOT (State) ---
const token = localStorage.getItem("token"); // Token a hitelesítéshez
let selectedDate = new Date(); // A naptárban kiválasztott nap
let selectedDateKey = dateToISO(selectedDate); // YYYY-MM-DD
let activeMealType = 'breakfast'; // 'breakfast', 'lunch', 'dinner', 'snacks'
let dailyLog = {}; // Eltárolja az adott nap API-ból betöltött log bejegyzéseit
const mealTitles = { breakfast: 'Reggeli', lunch: 'Ebéd', dinner: 'Vacsora', snacks: 'Nasi' };

// Segédfüggvény a YYYY-MM-DD formátumhoz
function dateToISO(d) {
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

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
    selectedDateKey = dateToISO(selectedDate); // Frissítjük a key-t is
    
    if (selectedDateKey === dateToISO(today)) {
        dayLabel.textContent = "Mai nap";
    } else {
        dayLabel.textContent = selectedDate.toLocaleDateString('hu-HU', {
            month: 'short',
            day: 'numeric',
            weekday: 'short'
        });
    }

    fetchDailyLog();
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
 * Étel hozzáadása a loghoz (API-val)
 * @param {object} item - Az étel teljes objektuma a /foods/search válaszából (benne food_id, food_name stb.)
 */
async function addFoodToLog(item) {
    if (!token) {
        alert("A bejegyzés mentéséhez bejelentkezés szükséges.");
        modal.style.display = 'none';
        return;
    }
    
    // 1. Megoldjuk az "undefined ételből" hibát
    const itemName = item.food_name || item.name || "Ismeretlen étel";
    
    // 2. Kérjük a mennyiséget
    const quantityStr = prompt(`Hány grammot fogyasztottál a(z) ${itemName} ételből? (grammban)`);
    if (!quantityStr) {
        modal.style.display = 'none';
        return;
    }
    
    // 3. Tisztítjuk és validáljuk a bevitelt (pl. "100(g)" -> 100)
    const cleanedQuantityStr = quantityStr.replace(/[^\d.]/g, ''); // Csak számokat és pontot tart meg
    const quantity_grams = parseFloat(cleanedQuantityStr);

    if (isNaN(quantity_grams) || quantity_grams <= 0) {
        alert(`❌ Érvénytelen mennyiség: ${quantityStr}. Kérlek, pozitív számot adj meg grammban.`);
        modal.style.display = 'none';
        return;
    }

    // 4. Payload összeállítása (item.food_id most már a teljes objektumból jön)
    const payload = {
        food_id: item.food_id, // <--- Ez már helyesen, a teljes objektumból töltődik be
        meal_type: activeMealType,
        quantity_grams: quantity_grams,
        date: selectedDateKey 
    };
    
    try {
        const res = await fetch("/api/v1/food_log/", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            // Megpróbáljuk JSON-ként olvasni a hibaüzenetet
            const errBody = await res.text();
            try {
                const errJson = JSON.parse(errBody);
                throw new Error(errJson.detail || `HTTP ${res.status} hiba a mentéskor.`);
            } catch (parseError) {
                 // Ha a válasz nem JSON (pl. a szerver belső hibája)
                throw new Error(`Hiba a mentéskor (${res.status}). Részletek: ${errBody.substring(0, 50)}...`);
            }
        }
        
        // Sikeres mentés után frissítjük a teljes napi nézetet
        await fetchDailyLog();
        modal.style.display = 'none';
        
    } catch (err) {
        console.error(err);
        // Itt már az Error objektummal dolgozunk
        alert(`❌ Hiba: ${err.message || String(err)}`); 
        modal.style.display = 'none';
    }
}

function renderDailyFoodList() {
    if (!dailyFoodList) return;
    dailyFoodList.innerHTML = '';
    let totalItems = 0;
    
    // A hivatkozott mealTitles most már az új scope-ban elérhető.

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
                // Fontos: a kcal már a helyes mennyiségre van számítva a fetchDailyLog-ban
                row.innerHTML = `
                    <span>${item.name} <small class="muted">(${item.quantity}g)</small></span>
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
 * 4. MAKRÓ SZÁMÍTÁS (az új, statikus nagy kör + 3 kicsi dizájnhoz)
 */
function updateMacroDisplays() {
    // A célmakrók a globális targetMacros-ból jönnek (script.js tölti be)

    // --- 1. ÖSSZES FOGYASZTÁS KISZÁMÍTÁSA (grammban) ---
    let pConsumed = 0, cConsumed = 0, fConsumed = 0, calConsumed = 0;

    for (const mealType in dailyLog) {
        dailyLog[mealType].forEach(item => {
            // A fetchDailyLog már kiszámolta a tényleges fogyasztott grammokat (item.p, item.c, item.f)
            pConsumed += (item.p || 0);
            cConsumed += (item.c || 0);
            fConsumed += (item.f || 0);
            calConsumed += (item.kcal || 0);
        });
    }

    // --- 2. CÉL MAKRÓK (a globális 'targetMacros'-ból) ---
    // A 0-val való osztás elkerülése érdekében 1 a minimum, ha a cél nincs beállítva.
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
        // A progress a HÁTRALÉVŐ százalékot mutatja (max. 100%)
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
 * Adott nap (selectedDateKey) étel logjának lekérése az API-ból.
 */
async function fetchDailyLog() {
    if (!token) return;
    
    selectedDateKey = dateToISO(selectedDate);
    
    try {
        const res = await fetch(`/api/v1/food_log/?date_str=${selectedDateKey}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (res.status === 404 || res.status === 200) {
            // A 404 OK, ha nincs még bejegyzés.
            const logData = (res.status === 200) ? await res.json() : [];
            
            // Csoportosítjuk az adatokat étkezéstípus szerint a könnyebb rendereléshez
            dailyLog = logData.reduce((acc, entry) => {
                const q = entry.quantity_grams / 100;
                const item = {
                    log_id: entry.log_id,
                    food_id: entry.food_id,
                    name: entry.food_name,
                    // Makrók kiszámítása 100g-ból a tényleges mennyiségre
                    kcal: Math.round(entry.kcal_100g * q),
                    p: Math.round(entry.protein_100g * q),
                    c: Math.round(entry.carbs_100g * q),
                    f: Math.round(entry.fat_100g * q),
                    quantity: entry.quantity_grams,
                };
                acc[entry.meal_type] = acc[entry.meal_type] || [];
                acc[entry.meal_type].push(item);
                return acc;
            }, {});
            
            renderDailyFoodList();
            updateMacroDisplays();
            
        } else {
            throw new Error(`HTTP ${res.status}`);
        }

    } catch (err) {
        console.error("Hiba a napi log lekérésekor:", err);
        // Itt beállíthatunk egy hibaüzenetet a felhasználónak, ha van megfelelő UI elem
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
            row.querySelector('button').addEventListener('click', () => addFoodToLog(item));
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
        
        // Hívás indítása a kezdeti adatok betöltéséhez
        if (token) {
             fetchDailyLog();
        } else {
             renderDailyFoodList(); // Ha nincs token, csak üres listát mutatunk.
        }
       
    }
});