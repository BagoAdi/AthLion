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

// --- TOAST SEGÉDFÜGGVÉNY ---
function showToast(message, type = 'success') {
    // Létrehozzuk az elemet
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    toast.textContent = message;
    
    // Hozzáadjuk az oldalhoz
    document.body.appendChild(toast);

    // Megjelenítjük (kis késleltetéssel az animáció miatt)
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // 3 másodperc múlva eltüntetjük
    setTimeout(() => {
        toast.classList.remove('show');
        // Miután halványodott, töröljük a DOM-ból
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

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

function initWeightControl() {
    const wInput = $('#weightInput');
    const wDec = $('#weightDec');
    const wInc = $('#weightInc');
    const wStatus = $('#weightSaveStatus');
    
    if (!wInput || !token) return;

    // 1. Jelenlegi súly betöltése indításkor
    fetch("/api/v1/weight/latest", {
        headers: { "Authorization": `Bearer ${token}` }
    })
    .then(res => res.ok ? res.json() : null)
    .then(data => {
        if (data && data.weight_kg) {
            wInput.value = data.weight_kg;
        }
    })
    .catch(console.error);

    // Segédfüggvény a mentéshez
    const saveWeight = async (newVal) => {
        if (!newVal || newVal <= 0) return;
        
        wInput.style.opacity = "0.7";

        try {
            const todayISO = new Date().toISOString().slice(0, 10);
            
            const res = await fetch("/api/v1/weight/", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}` 
                },
                body: JSON.stringify({
                    weight_kg: parseFloat(newVal),
                    date: todayISO
                })
            });

            if (res.ok) {
                // Visszajelzés és makró frissítés
                wStatus.style.opacity = '1';
                setTimeout(() => { wStatus.style.opacity = '0'; }, 2000);
                
                // HA létezik a függvény, meghívjuk
                if (typeof fetchUserGoals === 'function') {
                    await fetchUserGoals(); 
                }
            }

        } catch (err) {
            console.error(err);
        } finally {
            wInput.style.opacity = "1";
        }
    };

    // Gombok kezelése
    wDec.addEventListener('click', () => {
        let val = parseFloat(wInput.value) || 0;
        val = Math.max(0, val - 0.5);
        wInput.value = val.toFixed(1);
        saveWeight(val);
    });

    wInc.addEventListener('click', () => {
        let val = parseFloat(wInput.value) || 0;
        val += 0.5;
        wInput.value = val.toFixed(1);
        saveWeight(val);
    });

    wInput.addEventListener('change', () => {
        saveWeight(parseFloat(wInput.value));
    });
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
async function selectFoodInModal(item) {
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
        const r = (val) => Math.round(val || 0);
        selBaseMacros.textContent = `${r(item.kcal_100g)}kcal | Feh:${r(item.protein_100g)} SzH:${r(item.carbs_100g)} Zs:${r(item.fat_100g)}`;
    }
    
    // Reset mennyiség 100g-ra
    if(selQuantity) selQuantity.value = 100;
    updatePreviewCalculation();

    // --- ÚJ: BIZTONSÁGI ELLENŐRZÉS ---
    // Megkeressük (vagy létrehozzuk) a figyelmeztető dobozt
    let warningBox = document.getElementById('foodWarningBox');
    if (!warningBox) {
        warningBox = document.createElement('div');
        warningBox.id = 'foodWarningBox';
        warningBox.style.padding = '10px';
        warningBox.style.marginTop = '15px';
        warningBox.style.borderRadius = '8px';
        warningBox.style.fontSize = '13px';
        warningBox.style.display = 'none'; // Alapból rejtve
        // Beszúrjuk a gomb elé
        if (btnAddSelection) btnAddSelection.parentNode.insertBefore(warningBox, btnAddSelection);
    }
    
    // Reseteljük a dobozt
    warningBox.style.display = 'none';
    warningBox.innerHTML = '';

    if (token) {
        try {
            const res = await fetch(`/api/v1/foods/${item.food_id}/check`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const checkData = await res.json();
                
                if (checkData.warnings && checkData.warnings.length > 0) {
                    // Van figyelmeztetés!
                    warningBox.style.display = 'block';
                    
                    // Ha nem biztonságos (allergia), akkor piros, amúgy sárga
                    const isDanger = !checkData.is_safe;
                    warningBox.style.backgroundColor = isDanger ? 'rgba(255, 0, 0, 0.2)' : 'rgba(255, 200, 0, 0.2)';
                    warningBox.style.border = isDanger ? '1px solid var(--err)' : '1px solid #ffcc00';
                    warningBox.style.color = isDanger ? '#ffcccc' : '#ffdd99';

                    // Üzenetek felsorolása
                    warningBox.innerHTML = checkData.warnings.map(w => 
                        `<div>${isDanger ? '⚠️' : 'ℹ️'} <strong>${w}</strong></div>`
                    ).join('');
                }
            }
        } catch (err) {
            console.error("Hiba az étel ellenőrzésekor:", err);
        }
    }
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
 * 7. MAKRÓ CÉLOK ÉS SÚLY LEKÉRÉSE
 */
async function fetchUserGoals() {
    if (!token) return;

    try {
        const res = await fetch("/api/v1/diet/calculate", {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            
            // 1. Súly mező kitöltése (EZ A JAVÍTÁS LÉNYEGE)
            const wInput = $('#weightInput');
            if (wInput && data.current_weight) {
                // Csak akkor írjuk felül, ha a felhasználó épp nem gépel bele
                if (document.activeElement !== wInput) {
                    wInput.value = data.current_weight;
                }
            }

            // 2. Makrók frissítése
            targetMacros = {
                cal: data.calories,
                p: data.protein,
                c: data.carbs,
                f: data.fat
            };
            updateMacroDisplays(); 
        }
    } catch (err) {
        console.error("Hiba a célok frissítésekor:", err);
    }
}

/**
 * 8. SÚLY ÁLLÍTÁS (STEPPER)
 */
function initWeightControl() {
    const wInput = $('#weightInput');
    const wDec = $('#weightDec');
    const wInc = $('#weightInc');
    const wStatus = $('#weightSaveStatus');
    
    if (!wInput || !token) return;


    // 2. Mentés és Frissítés logika
    const saveWeight = async (newVal) => {
        if (!newVal || newVal <= 0) return;
        
        wInput.style.opacity = "0.7";

        try {
            const todayISO = new Date().toISOString().slice(0, 10);
            
            // Elküldjük az új súlyt
            const res = await fetch("/api/v1/weight/", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json", 
                    "Authorization": `Bearer ${token}` 
                },
                body: JSON.stringify({
                    weight_kg: parseFloat(newVal),
                    date: todayISO
                })
            });

            if (res.ok) {
                // Siker! Pipa felvillan
                wStatus.style.opacity = '1';
                setTimeout(() => { wStatus.style.opacity = '0'; }, 2000);
                
                // ITT A LÉNYEG: Azonnal frissítjük a kördiagramokat!
                await fetchUserGoals(); 
            }

        } catch (err) {
            console.error(err);
        } finally {
            wInput.style.opacity = "1";
        }
    };

    // Gombok eseményei
    wDec.addEventListener('click', () => {
        let val = parseFloat(wInput.value) || 0;
        val = Math.max(0, val - 0.5);
        wInput.value = val.toFixed(1);
        saveWeight(val);
    });

    wInc.addEventListener('click', () => {
        let val = parseFloat(wInput.value) || 0;
        val += 0.5;
        wInput.value = val.toFixed(1);
        saveWeight(val);
    });

    wInput.addEventListener('change', () => {
        saveWeight(parseFloat(wInput.value));
    });
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
        initWeightControl();
        
        if (token) {
            fetchDailyLog();
            fetchUserGoals();
        } else {
             renderDailyFoodList();
        }
    }
});

// =================================================
// ÚJ AI AJÁNLÓ FLOW (Gomb -> Választó -> Szerkesztő)
// =================================================

const btnOpenAiModal = document.getElementById('btnOpenAiModal');
const aiChoiceModal = document.getElementById('aiChoiceModal');
const closeAiModal = document.getElementById('closeAiModal');
const aiMealButtons = document.querySelectorAll('.ai-meal-btn');

// 1. Választó ablak megnyitása
if (btnOpenAiModal) {
    btnOpenAiModal.addEventListener('click', () => {
        aiChoiceModal.style.display = 'grid';
    });
}

// 2. Választó ablak bezárása
if (closeAiModal) {
    closeAiModal.addEventListener('click', () => {
        aiChoiceModal.style.display = 'none';
    });
}

// 3. A 4 gomb kezelése
aiMealButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
        const mealType = btn.dataset.meal; // 'breakfast', 'lunch'...
        
        // Bezárjuk a választót, és jelzünk, hogy dolgozunk
        aiChoiceModal.style.display = 'none';
        showToast("⏳ Keresem a legjobb ajánlatot...", "info");

        try {
            if (!token) throw new Error("Jelentkezz be!");

            const res = await fetch(`/api/v1/diet/recommendation/suggest/${mealType}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Nem találtam megfelelő ételt.");
            const suggestion = await res.json();

            // SIKER!
            // Most "becsapjuk" a rendszert, és úgy teszünk, mintha a user kézzel választotta volna ki ezt az ételt.
            
            // 1. Beállítjuk az aktív étkezés típust a háttérben
            activeMealType = mealType;
            
            // 2. Megnyitjuk a SZERKESZTŐ modalt (foodSearchModal)
            const foodModal = document.getElementById('foodSearchModal');
            if (foodModal) {
                foodModal.style.display = 'grid';
                
                // Frissítjük a címet
                const labels = { breakfast: 'Reggeli', lunch: 'Ebéd', dinner: 'Vacsora', snacks: 'Nasi' };
                const modalTitle = document.getElementById('modalTitle');
                if(modalTitle) modalTitle.textContent = labels[mealType] + " (Ajánlat)";

                // 3. Betöltjük az adatokat (ez a meglévő függvényed!)
                selectFoodInModal(suggestion); 

                // 4. Felülírjuk a mennyiséget az ajánlottra
                const qtyInput = document.getElementById('selQuantity');
                if (qtyInput) {
                    qtyInput.value = suggestion.suggested_quantity;
                    // Trigger input event, hogy a makrók frissüljenek
                    qtyInput.dispatchEvent(new Event('input'));
                }
                
                showToast(`💡 Megvan! Mit szólsz ehhez: ${suggestion.food_name}?`);
            }

        } catch (err) {
            console.error(err);
            showToast("❌ Nem sikerült ajánlani. Próbáld újra!", "error");
        }
    });
});