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

// --- ÚJ VÁLTOZÓ A KIVÁLASZTOTT ÉTELHEZ (MODALBAN) ---
let currentSelectedFood = null;

// Segédfüggvény a YYYY-MM-DD formátumhoz
function dateToISO(d) {
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// --- Elemek ---
const dayLabel = $('#dayLabel');
const modal = $('#foodSearchModal');
const modalTitle = $('#modalTitle');
const modalQueryInput = $('#modalFoodQuery');
const modalResults = $('#modalFoodResults');
const dailyFoodList = $('#dailyFoodList');
const emptyListMsg = $('#emptyListMsg');

// ÚJ ELEMEK A MODALHOZ (Split View)
const foodPlaceholder = $('#foodSelectionPlaceholder');
const foodDetails = $('#foodSelectionDetails');
const selFoodName = $('#selFoodName');
const selBaseMacros = $('#selBaseMacros');
const selQuantity = $('#selQuantity');
const btnAddSelection = $('#btnAddSelection');

// Preview elemek (kicsi számok a modal jobb oldalán)
const prevKcal = $('#prevKcal');
const prevP = $('#prevP');
const prevC = $('#prevC');
const prevF = $('#prevF');

/**
 * Saját megerősítő ablak Promise alapon.
 * Használat: if (await showConfirm()) { ... }
 */
function showConfirm() {
    return new Promise((resolve) => {
        confirmModal.style.display = 'grid'; // Megjelenítés

        // Eseménykezelők (egyszeri lefutás)
        confirmYes.onclick = () => {
            confirmModal.style.display = 'none';
            resolve(true);
        };

        confirmNo.onclick = () => {
            confirmModal.style.display = 'none';
            resolve(false);
        };
    });
}


/**
 * 1. NAPVÁLASZTÓ KEZELÉSE
 */
function initDayNavigator() {
    const prevBtn = $('#dayPrev');
    const nextBtn = $('#dayNext');
    const todayBtn = $('#dayToday');

    if (!prevBtn) return;

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
    selectedDateKey = dateToISO(selectedDate);
    
    if (selectedDateKey === dateToISO(today)) {
        dayLabel.textContent = "Mai nap";
    } else {
        dayLabel.textContent = selectedDate.toLocaleDateString('hu-HU', {
            month: 'short', day: 'numeric', weekday: 'short'
        });
    }

    if (token) {
        fetchDailyLog();
    } else {
        renderDailyFoodList();
    }
}

/**
 * 2. ÉTKEZÉS FÜLEK ÉS MODAL KEZELÉSE (INIT)
 */
function initMealTabs() {
    const tabs = $$('#mealTabs .meal-tab');
    const closeBtn = $('#modalCloseBtn');

    if (!tabs.length || !modal || !closeBtn) return;

    // Modal megnyitása fülre kattintáskor
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            activeMealType = tab.dataset.meal;
            
            // Cím beállítása (pl. "Vacsora")
            modalTitle.textContent = tab.textContent;
            
            // Reseteljük a modal állapotát megnyitáskor
            resetModalRightSide();
            modalQueryInput.value = '';
            modalResults.innerHTML = `<p class="muted small" style="padding: 10px 0;">Írj be legalább 3 karaktert.</p>`;
            
            modal.style.display = 'grid'; // Megjelenítjük a modalt
            modalQueryInput.focus();
        });
    });

    // Bezárás logika
    const closeModal = () => {
        modal.style.display = 'none';
        resetModalRightSide();
    };

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // --- ÚJ: Billentyűzet vezérlés (ESC és Enter) ---
    document.addEventListener('keydown', (e) => {
        // Csak akkor figyelünk, ha a modal éppen nyitva van
        if (modal.style.display === 'none') return;

        // ESC gomb -> Bezárás
        if (e.key === 'Escape') {
            e.preventDefault();
            closeModal();
        }

        // Enter gomb -> Hozzáadás
        if (e.key === 'Enter') {
            // Ha épp a keresőben gépelünk, ne adja hozzá véletlenül a korábbi kiválasztást
            if (document.activeElement === modalQueryInput) return;

            // Ha van kiválasztott étel, hívjuk meg a mentést
            if (currentSelectedFood) {
                e.preventDefault();
                handleAddSelectionClick();
            }
        }
    });

    // Keresés input figyelése
    modalQueryInput.addEventListener('input', () => doFoodSearch(true));

    // Mennyiség változás figyelése (Valós idejű számolás a jobb oldalon)
    if (selQuantity) {
        selQuantity.addEventListener('input', updatePreviewCalculation);
    }

    // "Hozzáadás" gomb esemény (API hívás)
    if (btnAddSelection) {
        btnAddSelection.addEventListener('click', handleAddSelectionClick);
    }
}

/**
 * 3. KERESÉS ÉS MEGJELENÍTÉS (Split View Bal oldal)
 */
async function doFoodSearch(isModal = false) {
    if (!isModal) return;
    
    const q = (modalQueryInput.value || '').toLowerCase().trim();
    if (q.length < 3) {
        modalResults.innerHTML = `<p class="muted small" style="padding: 10px 0;">Írj be legalább 3 karaktert.</p>`;
        return;
    }

    modalResults.innerHTML = `<div class="muted small">Keresés...</div>`;

    try {
        const res = await fetch(`/api/v1/foods/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error('Hiba');
        
        const list = await res.json();
        modalResults.innerHTML = '';
        
        if (!list.length) {
            modalResults.innerHTML = `<div class="muted small">Nincs találat.</div>`;
            return;
        }

        list.forEach(item => {
            // Létrehozzuk a listaelemeket
            const div = document.createElement('div');
            div.className = 'result';
            
            div.innerHTML = `
                <div style="font-weight:600; color:#fff; font-size:14px; padding-block: 2px;">
                    ${item.food_name}
                </div>
            `;
            
            // KATTINTÁS ESEMÉNY: Ez tölti be a jobb oldalt
            div.addEventListener('click', () => {
                // Aktív stílus a listában
                const allResults = modalResults.querySelectorAll('.result');
                allResults.forEach(r => r.classList.remove('active'));
                div.classList.add('active');
                
                selectFoodInModal(item);
            });

            modalResults.appendChild(div);
        });

    } catch (err) {
        console.error(err);
        modalResults.innerHTML = `<div style="color:var(--err)">Hiba történt a kereséskor.</div>`;
    }
}

/**
 * 4. MODAL JOBB OLDAL KEZELÉSE (Kiválasztás, Preview)
 */
function selectFoodInModal(item) {
    currentSelectedFood = item;

    // UI váltás: Placeholder elrejtése, Részletek megjelenítése
    if(foodPlaceholder) foodPlaceholder.style.display = 'none';
    if(foodDetails) {
        foodDetails.style.display = 'flex';
        foodDetails.style.flexDirection = 'column';
    }

    // Adatok kiírása
    if(selFoodName) selFoodName.textContent = item.food_name;
    if(selBaseMacros) {
        // Helper a biztonságos kerekítéshez (ha esetleg null lenne az adat)
        const r = (val) => Math.round(val || 0);
        selBaseMacros.textContent = `${r(item.kcal_100g)}kcal | Feh:${r(item.protein_100g)} SzH:${r(item.carbs_100g)} Zs:${r(item.fat_100g)}`;
    }
    
    // Reset mennyiség 100g-ra
    if(selQuantity) selQuantity.value = 100;
    
    // Számolás frissítése
    updatePreviewCalculation();
}

function updatePreviewCalculation() {
    if (!currentSelectedFood || !prevKcal) return;

    const qty = parseFloat(selQuantity.value);
    if (isNaN(qty) || qty < 0) {
        prevKcal.textContent = "-";
        prevP.textContent = "-";
        prevC.textContent = "-";
        prevF.textContent = "-";
        return;
    }

    const ratio = qty / 100;

    prevKcal.textContent = Math.round(currentSelectedFood.kcal_100g * ratio);
    prevP.textContent = Math.round(currentSelectedFood.protein_100g * ratio);
    prevC.textContent = Math.round(currentSelectedFood.carbs_100g * ratio);
    prevF.textContent = Math.round(currentSelectedFood.fat_100g * ratio);
}

function resetModalRightSide() {
    currentSelectedFood = null;
    if(foodPlaceholder) foodPlaceholder.style.display = 'block';
    if(foodDetails) foodDetails.style.display = 'none';
    
    const activeItems = modalResults ? modalResults.querySelectorAll('.active') : [];
    activeItems.forEach(el => el.classList.remove('active'));
}

/**
 * 5. MENTÉS KEZELÉSE (A "Hozzáadás" gomb)
 */
async function handleAddSelectionClick() {
    if (!currentSelectedFood) return;
    if (!token) {
        alert("Jelentkezz be a mentéshez!");
        return;
    }

    const qty = parseFloat(selQuantity.value);
    if (!qty || qty <= 0) {
        alert("Adj meg egy érvényes mennyiséget!");
        return;
    }

    // API Payload
    const payload = {
        food_id: currentSelectedFood.food_id,
        meal_type: activeMealType,
        quantity_grams: qty,
        date: selectedDateKey
    };

    // Gomb letiltása, amíg tölt
    const originalBtnText = btnAddSelection.textContent;
    btnAddSelection.textContent = "Mentés...";
    btnAddSelection.disabled = true;

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
            const errBody = await res.text();
            try {
                const errJson = JSON.parse(errBody);
                throw new Error(errJson.detail || "Hiba a mentéskor");
            } catch (e) {
                throw new Error(`Szerver hiba (${res.status})`);
            }
        }

        // Siker!
        await fetchDailyLog(); // Lista és diagramok frissítése
        
        // Modal bezárása
        modal.style.display = 'none';
        resetModalRightSide();

    } catch (err) {
        console.error(err);
        alert(`Hiba történt: ${err.message}`);
    } finally {
        btnAddSelection.textContent = originalBtnText;
        btnAddSelection.disabled = false;
    }
}


/**
 * 6. ADATLEKÉRÉS ÉS LISTÁZÁS (Napi nézet)
 */
async function fetchDailyLog() {
    if (!token) return;
    
    selectedDateKey = dateToISO(selectedDate);
    
    try {
        const res = await fetch(`/api/v1/food_log/?date_str=${selectedDateKey}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (res.status === 404 || res.status === 200) {
            const logData = (res.status === 200) ? await res.json() : [];
            
            dailyLog = logData.reduce((acc, entry) => {
                const q = entry.quantity_grams / 100;
                const item = {
                    log_id: entry.log_id,
                    food_id: entry.food_id,
                    name: entry.food_name,
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
    }
}

function renderDailyFoodList() {
    if (!dailyFoodList) return;
    dailyFoodList.innerHTML = '';
    let totalItems = 0;
    
    for (const mealType in dailyLog) {
        const items = dailyLog[mealType];
        if (items.length > 0) {
            totalItems += items.length;
            const title = document.createElement('h4');
            title.textContent = mealTitles[mealType] || mealType;
            dailyFoodList.appendChild(title);

            items.forEach(item => {
                const row = document.createElement('div');
                row.className = 'meal-item';
                
                // Itt módosítottuk a HTML szerkezetet: meal-info + gomb
                row.innerHTML = `
                    <div class="meal-info">
                        <span>${item.name} <small class="muted">(${item.quantity}g)</small></span>
                        <span class="kcal">${Math.round(item.kcal)} kcal</span>
                    </div>
                    <button class="btn-delete-log" title="Törlés">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:16px;height:16px;">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                    </button>
                `;
                
                // Törlés esemény bekötése
                const btnDelete = row.querySelector('.btn-delete-log');
                btnDelete.addEventListener('click', () => deleteFoodLogEntry(item.log_id));

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

// ÚJ FÜGGVÉNY: Törlés logika (Custom Modallal)
async function deleteFoodLogEntry(logId) {
    // Itt hívjuk meg a saját ablakunkat
    const confirmed = await showConfirm();
    
    if (!confirmed) return; // Ha a Mégse-re nyomott, kilépünk

    try {
        const res = await fetch(`/api/v1/food_log/${logId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) {
            throw new Error(`Hiba a törléskor (${res.status})`);
        }

        // Siker esetén újratöltjük a listát és a makrókat
        await fetchDailyLog();

    } catch (err) {
        console.error(err);
        alert("Nem sikerült törölni a bejegyzést.");
    }
}

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

    // --- 2. CÉL MAKRÓK ---
    const pGoal = targetMacros.p > 0 ? targetMacros.p : 1;
    const cGoal = targetMacros.c > 0 ? targetMacros.c : 1;
    const fGoal = targetMacros.f > 0 ? targetMacros.f : 1;
    const calGoal = targetMacros.cal > 0 ? targetMacros.cal : 1;

    // --- 3. FŐ KALÓRIA KÖR FRISSÍTÉSE ---
    const calorieCircle = $('#calorieCircle');
    const remainingKcalValue = $('#remainingKcalValue');

    if (calorieCircle && remainingKcalValue) {
        const calRemaining = Math.round(targetMacros.cal - calConsumed);
        remainingKcalValue.textContent = calRemaining;

        if (calRemaining < 0) {
            calorieCircle.classList.add('over-limit');
        } else {
            calorieCircle.classList.remove('over-limit');
        }
    }

    // --- 4. KIS MAKRÓ KÖRÖK FRISSÍTÉSE ---
    const updateCircle = (circleId, valueId, consumed, goal) => {
        const circle = $(circleId);
        const valSpan = $(valueId);
        if (circle && valSpan) {
            const remaining = Math.round(goal - consumed);
            // Progress = hátralévő % (0 és 100 között)
            const progress = Math.max(0, Math.min(100, (remaining / goal) * 100));
            
            valSpan.textContent = remaining;
            circle.style.setProperty('--progress-percent', `${progress}%`);

            if (remaining < 0) circle.classList.add('over-limit');
            else circle.classList.remove('over-limit');
        }
    };

    updateCircle('#proteinCircle', '#proteinValue', pConsumed, pGoal);
    updateCircle('#carbsCircle', '#carbsValue', cConsumed, cGoal);
    updateCircle('#fatCircle', '#fatValue', fConsumed, fGoal);
}


// --- INDÍTÁS (csak a diet.html oldalon) ---
document.addEventListener('DOMContentLoaded', () => {
    if ($('#diet-panel-top')) {
        initDayNavigator();
        initMealTabs();
        
        if (token) {
             fetchDailyLog();
        } else {
             renderDailyFoodList();
        }
    }
});