// =================================================
// DIET.HTML LOGIKA (VÉGLEGES JAVÍTOTT VERZIÓ)
// =================================================

// --- ÁLLAPOT (State) ---
const token = localStorage.getItem("token");
let selectedDate = new Date();
// DÁTUM JAVÍTÁS: Kezdeti érték beállítása a javított függvénnyel
let selectedDateKey = getLocalISODate(selectedDate); 

let activeMealType = 'breakfast'; 
let dailyLog = {}; 
let currentWaterState = 0; 
const mealTitles = { breakfast: 'Reggeli', lunch: 'Ebéd', dinner: 'Vacsora', snacks: 'Nasi' };
let currentSelectedFood = null;

// --- JAVÍTOTT DÁTUM FÜGGVÉNY (Időzóna hiba ellen) ---
// Ez biztosan a helyi (magyar) napot adja vissza, nem az UTC-t.
function getLocalISODate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Elemek
const dayLabel = document.querySelector('#dayLabel');
const modal = document.querySelector('#foodSearchModal');
const modalTitle = document.querySelector('#modalTitle');
const modalQueryInput = document.querySelector('#modalFoodQuery');
const modalResults = document.querySelector('#modalFoodResults');
const dailyFoodList = document.querySelector('#dailyFoodList');
const emptyListMsg = document.querySelector('#emptyListMsg');

// Modal elemek
const foodPlaceholder = document.querySelector('#foodSelectionPlaceholder');
const foodDetails = document.querySelector('#foodSelectionDetails');
const selFoodName = document.querySelector('#selFoodName');
const selBaseMacros = document.querySelector('#selBaseMacros');
const selQuantity = document.querySelector('#selQuantity');
const btnAddSelection = document.querySelector('#btnAddSelection');

// Preview elemek
const prevKcal = document.querySelector('#prevKcal');
const prevP = document.querySelector('#prevP');
const prevC = document.querySelector('#prevC');
const prevF = document.querySelector('#prevF');

// --- TOAST ---
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
}

// --- CONFIRM ---
function showConfirm() {
    const confirmModal = document.getElementById('confirmModal');
    const confirmYes = document.getElementById('confirmYes');
    const confirmNo = document.getElementById('confirmNo');

    return new Promise((resolve) => {
        confirmModal.style.display = 'grid';
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

// =================================================
// 1. NAPVÁLASZTÓ
// =================================================
function initDayNavigator() {
    const prevBtn = document.getElementById('dayPrev');
    const nextBtn = document.getElementById('dayNext');
    const todayBtn = document.getElementById('dayToday');

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

    updateDayView();
}

function updateDayView() {
    if (!dayLabel) return;
    
    const today = new Date();
    selectedDateKey = getLocalISODate(selectedDate); // Használjuk a javított függvényt
    
    if (getLocalISODate(today) === selectedDateKey) {
        dayLabel.textContent = "Mai nap";
    } else {
        dayLabel.textContent = selectedDate.toLocaleDateString('hu-HU', {
            month: 'short', day: 'numeric', weekday: 'short'
        });
    }

    if (token) {
        fetchDailyLog();    
        fetchDailyWater();  
    } else {
        renderDailyFoodList();
    }
}

// =================================================
// 2. SÚLY KEZELÉS
// =================================================
function initWeightControl() {
    const wInput = document.getElementById('weightInput');
    const wDec = document.getElementById('weightDec');
    const wInc = document.getElementById('weightInc');
    const wStatus = document.getElementById('weightSaveStatus');
    
    if (!wInput || !token) return;

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

    const saveWeight = async (newVal) => {
        if (!newVal || newVal <= 0) return;
        wInput.style.opacity = "0.7";

        try {
            const todayISO = getLocalISODate(new Date());
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
                wStatus.style.opacity = '1';
                setTimeout(() => { wStatus.style.opacity = '0'; }, 2000);
                if (typeof fetchUserGoals === 'function') await fetchUserGoals(); 
            }
        } catch (err) { console.error(err); } 
        finally { wInput.style.opacity = "1"; }
    };

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

    wInput.addEventListener('change', () => saveWeight(parseFloat(wInput.value)));
}

// =================================================
// 3. VÍZ KEZELÉS (JAVÍTOTT LEKÉRDEZÉSSEL)
// =================================================
function initWaterControl() {
    const btnDec = document.getElementById('waterDec');
    const btnInc = document.getElementById('waterInc');
    
    if (btnDec && btnInc) {
        btnDec.addEventListener('click', () => changeWater(-250));
        btnInc.addEventListener('click', () => changeWater(250));
    }
}

async function fetchDailyWater() {
    if (!token) return;
    
    // 1. Azonnali reset (hogy ne ragadjon be a régi szám)
    currentWaterState = 0;
    updateWaterDisplay();
    
    const dateKey = getLocalISODate(selectedDate);
    
    try {
        // 2. KÉNYSZERÍTETT FRISSÍTÉS (?temp=...)
        // Minden kérés egyedi lesz, így a böngésző nem tudja cache-ből kiszolgálni.
        const url = `/api/v1/water/daily_sum?date_str=${dateKey}&temp=${Date.now()}`;
        
        const res = await fetch(url, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            console.log(`Víz (${dateKey}):`, data.total_ml); // Ellenőrzés a konzolon
            
            currentWaterState = data.total_ml;
            updateWaterDisplay();
        } else {
            console.error("Szerver hiba:", res.status);
        }
    } catch (err) {
        console.error("Hálózati hiba:", err);
    }
}

async function changeWater(amount) {
    if (!token) return;
    
    const originalState = currentWaterState;
    currentWaterState = Math.max(0, currentWaterState + amount);
    updateWaterDisplay();

    const dateKey = getLocalISODate(selectedDate); // Itt is a javított dátumot küldjük

    try {
        const res = await fetch("/api/v1/water/", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify({
                amount_ml: amount,
                date: dateKey
            })
        });

        if (!res.ok) throw new Error("Hiba a mentéskor");
        
    } catch (err) {
        console.error(err);
        currentWaterState = originalState;
        updateWaterDisplay();
        showToast("Hiba a víz mentésekor!", "error");
    }
}

function updateWaterDisplay() {
    const disp = document.getElementById('waterValueDisplay');
    const bar = document.getElementById('waterProgressBarSmall');
    
    if (disp) disp.textContent = currentWaterState;
    
    if (bar) {
        const pct = Math.min(100, (currentWaterState / 2500) * 100);
        bar.style.width = `${pct}%`;
    }
}

// =================================================
// 4. ÉTKEZÉS MODAL
// =================================================
function initMealTabs() {
    const tabs = document.querySelectorAll('#mealTabs .meal-tab');
    const closeBtn = document.getElementById('modalCloseBtn');

    if (!tabs.length || !modal || !closeBtn) return;

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            activeMealType = tab.dataset.meal;
            modalTitle.textContent = tab.textContent;
            resetModalRightSide();
            modalQueryInput.value = '';
            modalResults.innerHTML = `<p class="muted small" style="padding: 10px 0;">Írj be legalább 3 karaktert.</p>`;
            modal.style.display = 'grid';
            modalQueryInput.focus();
        });
    });

    const closeModal = () => {
        modal.style.display = 'none';
        resetModalRightSide();
    };

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    document.addEventListener('keydown', (e) => {
        if (modal.style.display === 'none') return;
        if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
        if (e.key === 'Enter') {
            if (document.activeElement === modalQueryInput) return;
            if (currentSelectedFood) { e.preventDefault(); handleAddSelectionClick(); }
        }
    });

    modalQueryInput.addEventListener('input', () => doFoodSearch(true));
    if (selQuantity) selQuantity.addEventListener('input', updatePreviewCalculation);
    if (btnAddSelection) btnAddSelection.addEventListener('click', handleAddSelectionClick);
}

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
        if (!list.length) { modalResults.innerHTML = `<div class="muted small">Nincs találat.</div>`; return; }

        list.forEach(item => {
            const div = document.createElement('div');
            div.className = 'result';
            div.innerHTML = `<div style="font-weight:600; color:#fff; font-size:14px; padding-block: 2px;">${item.food_name}</div>`;
            div.addEventListener('click', () => {
                modalResults.querySelectorAll('.result').forEach(r => r.classList.remove('active'));
                div.classList.add('active');
                selectFoodInModal(item);
            });
            modalResults.appendChild(div);
        });
    } catch (err) {
        console.error(err);
        modalResults.innerHTML = `<div style="color:var(--err)">Hiba történt.</div>`;
    }
}

async function selectFoodInModal(item) {
    currentSelectedFood = item;
    if(foodPlaceholder) foodPlaceholder.style.display = 'none';
    if(foodDetails) { foodDetails.style.display = 'flex'; foodDetails.style.flexDirection = 'column'; }
    if(selFoodName) selFoodName.textContent = item.food_name;
    if(selBaseMacros) {
        const r = (val) => Math.round(val || 0);
        selBaseMacros.textContent = `${r(item.kcal_100g)}kcal | Feh:${r(item.protein_100g)} SzH:${r(item.carbs_100g)} Zs:${r(item.fat_100g)}`;
    }
    if(selQuantity) selQuantity.value = 100;
    updatePreviewCalculation();

    let warningBox = document.getElementById('foodWarningBox');
    if (!warningBox) {
        warningBox = document.createElement('div');
        warningBox.id = 'foodWarningBox';
        warningBox.style.padding = '10px'; warningBox.style.marginTop = '15px'; warningBox.style.borderRadius = '8px'; warningBox.style.fontSize = '13px'; warningBox.style.display = 'none';
        if (btnAddSelection) btnAddSelection.parentNode.insertBefore(warningBox, btnAddSelection);
    }
    warningBox.style.display = 'none'; warningBox.innerHTML = '';

    if (token) {
        try {
            const res = await fetch(`/api/v1/foods/${item.food_id}/check`, { headers: { "Authorization": `Bearer ${token}` } });
            if (res.ok) {
                const checkData = await res.json();
                if (checkData.warnings && checkData.warnings.length > 0) {
                    warningBox.style.display = 'block';
                    const isDanger = !checkData.is_safe;
                    warningBox.style.backgroundColor = isDanger ? 'rgba(255, 0, 0, 0.2)' : 'rgba(255, 200, 0, 0.2)';
                    warningBox.style.border = isDanger ? '1px solid var(--err)' : '1px solid #ffcc00';
                    warningBox.style.color = isDanger ? '#ffcccc' : '#ffdd99';
                    warningBox.innerHTML = checkData.warnings.map(w => `<div>${isDanger ? '⚠️' : 'ℹ️'} <strong>${w}</strong></div>`).join('');
                }
            }
        } catch (err) { console.error(err); }
    }
}

function updatePreviewCalculation() {
    if (!currentSelectedFood || !prevKcal) return;
    const qty = parseFloat(selQuantity.value);
    if (isNaN(qty) || qty < 0) return;
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

async function handleAddSelectionClick() {
    if (!currentSelectedFood) return;
    if (!token) return alert("Jelentkezz be!");

    const qty = parseFloat(selQuantity.value);
    if (!qty || qty <= 0) return alert("Érvényes mennyiséget adj meg!");

    const payload = {
        food_id: currentSelectedFood.food_id,
        meal_type: activeMealType,
        quantity_grams: qty,
        date: selectedDateKey
    };

    btnAddSelection.textContent = "Mentés...";
    btnAddSelection.disabled = true;

    try {
        const res = await fetch("/api/v1/food_log/", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error("Hiba a mentéskor");

        await fetchDailyLog();
        modal.style.display = 'none';
        resetModalRightSide();
        showToast("Étel hozzáadva! 🍎");

    } catch (err) {
        console.error(err);
        alert(`Hiba: ${err.message}`);
    } finally {
        btnAddSelection.textContent = "Hozzáadás a naplóhoz";
        btnAddSelection.disabled = false;
    }
}

// =================================================
// 5. CÉLOK ÉS MAKRÓK
// =================================================
async function fetchUserGoals() {
    if (!token) return;
    try {
        const res = await fetch("/api/v1/diet/calculate", {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            const wInput = document.getElementById('weightInput');
            if (wInput && data.current_weight && document.activeElement !== wInput) {
                wInput.value = data.current_weight;
            }
            targetMacros = { cal: data.calories, p: data.protein, c: data.carbs, f: data.fat };
            updateMacroDisplays(); 
        }
    } catch (err) { console.error(err); }
}

async function fetchDailyLog() {
    if (!token) return;
    selectedDateKey = getLocalISODate(selectedDate); // Javított dátum
    
    try {
        const res = await fetch(`/api/v1/food_log/?date_str=${selectedDateKey}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok || res.status === 404) {
            const logData = (res.ok) ? await res.json() : [];
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
        }
    } catch (err) { console.error(err); }
}

function renderDailyFoodList() {
    if (!dailyFoodList) return;
    dailyFoodList.innerHTML = '';
    let totalItems = 0;
    
    for (const mealType in dailyLog) {
        const items = dailyLog[mealType];
        if (items.length > 0) {
            totalItems += items.length;
            const header = document.createElement('div');
            header.className = 'meal-header-row';
            header.innerHTML = `
                <h4 style="margin:0">${mealTitles[mealType] || mealType}</h4>
                <button class="btn-icon-small danger" title="Törlés" onclick="deleteMealGroup('${mealType}')">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:18px;height:18px;"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                </button>
            `;
            dailyFoodList.appendChild(header);

            items.forEach(item => {
                const row = document.createElement('div');
                row.className = 'meal-item';
                row.innerHTML = `
                    <div class="meal-info"><span>${item.name} <small class="muted">(${item.quantity}g)</small></span><span class="kcal">${item.kcal} kcal</span></div>
                    <button class="btn-delete-log" onclick="deleteFoodLogEntry(${item.log_id})"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:16px;height:16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                `;
                dailyFoodList.appendChild(row);
            });
        }
    }
    if (emptyListMsg) emptyListMsg.style.display = totalItems === 0 ? 'block' : 'none';
}

window.deleteMealGroup = async (mealType) => {
    if (!(await showConfirm())) return;
    try {
        const res = await fetch(`/api/v1/food_log/meal?date_str=${selectedDateKey}&meal_type=${mealType}`, {
            method: "DELETE", headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) { showToast("Étkezés törölve!"); fetchDailyLog(); }
    } catch (err) { console.error(err); }
};

window.deleteFoodLogEntry = async (logId) => {
    if (!(await showConfirm())) return;
    try {
        const res = await fetch(`/api/v1/food_log/${logId}`, {
            method: "DELETE", headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) fetchDailyLog();
    } catch (err) { console.error(err); }
};

function updateMacroDisplays() {
    let pConsumed = 0, cConsumed = 0, fConsumed = 0, calConsumed = 0;
    for (const mealType in dailyLog) {
        dailyLog[mealType].forEach(item => {
            pConsumed += (item.p || 0); cConsumed += (item.c || 0); fConsumed += (item.f || 0); calConsumed += (item.kcal || 0);
        });
    }

    const pGoal = targetMacros.p || 1;
    const cGoal = targetMacros.c || 1;
    const fGoal = targetMacros.f || 1;
    
    const calRemaining = Math.round(targetMacros.cal - calConsumed);
    const remKcalVal = document.getElementById('remainingKcalValue');
    const calCirc = document.getElementById('calorieCircle');
    if(remKcalVal) remKcalVal.textContent = calRemaining;
    if(calCirc) calCirc.classList.toggle('over-limit', calRemaining < 0);

    const updateCircle = (cid, vid, cons, goal) => {
        const el = document.getElementById(cid);
        const val = document.getElementById(vid);
        if (el && val) {
            const rem = Math.round(goal - cons);
            const pct = Math.max(0, Math.min(100, (rem / goal) * 100));
            val.textContent = rem;
            el.style.setProperty('--progress-percent', `${pct}%`);
            el.classList.toggle('over-limit', rem < 0);
        }
    };
    updateCircle('proteinCircle', 'proteinValue', pConsumed, pGoal);
    updateCircle('carbsCircle', 'carbsValue', cConsumed, cGoal);
    updateCircle('fatCircle', 'fatValue', fConsumed, fGoal);
}

// =================================================
// 6. INITIALIZATION
// =================================================
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('diet-panel-top')) {
        initDayNavigator();
        initMealTabs();
        initWeightControl();
        initWaterControl();
        
        if (token) {
            fetchDailyLog();
            fetchUserGoals();
        } else {
             renderDailyFoodList();
        }
    }

    const btnOpenAi = document.getElementById('btnOpenAiModal');
    const modalAi = document.getElementById('aiChoiceModal');
    const closeAi = document.getElementById('closeAiModal');
    const aiBtns = document.querySelectorAll('.ai-meal-btn');

    if (btnOpenAi && modalAi) {
        btnOpenAi.addEventListener('click', () => modalAi.style.display = 'grid');
        if(closeAi) closeAi.addEventListener('click', () => modalAi.style.display = 'none');

        aiBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const mealType = btn.dataset.meal;
                modalAi.style.display = 'none';
                showToast("⏳ AI dolgozik...", "info");
                try {
                    const res = await fetch(`/api/v1/diet/recommendation/suggest/${mealType}`, {
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    if (!res.ok) throw new Error("Hiba");
                    const suggestion = await res.json();
                    activeMealType = mealType;
                    modalTitle.textContent = (mealTitles[mealType] || mealType) + " (Ajánlat)";
                    modal.style.display = 'grid';
                    selectFoodInModal(suggestion);
                    const qInput = document.getElementById('selQuantity');
                    if (qInput) {
                        qInput.value = suggestion.suggested_quantity;
                        qInput.dispatchEvent(new Event('input'));
                    }
                    showToast("💡 Ajánlat betöltve!");
                } catch (e) { showToast("Nem sikerült ajánlani.", "error"); }
            });
        });
    }
});