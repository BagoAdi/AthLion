let grid = null; 
let isEditMode = false; 

// --- 1. WIDGET DEFINÍCIÓK (MOST MÁR MINDEN BENNE VAN) ---
const WIDGET_TEMPLATES = {
    'water': {
        title: 'Víz Követő',
        content: `
            <div class="widget-content water-container">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h3>💧 Hidratálás</h3>
                    <span id="waterTarget" style="font-size:0.8em; opacity:0.7;">Cél: 2500ml</span>
                </div>
                
                <div class="water-progress-bg">
                    <div id="waterBar" class="water-progress-fill"></div>
                </div>
                
                <h2 id="waterValue" style="margin:0 0 10px 0;">0 ml</h2>
                
                <div class="water-buttons">
                    <button class="btn-water" onclick="addWater(250)">+2.5 dl</button>
                    <button class="btn-water" onclick="addWater(500)">+5 dl</button>
                </div>
            </div>`
    },
    'calories': {
        title: 'Napi Kalória',
        content: `
            <div class="widget-content" style="display:flex; flex-direction:column; justify-content:center; height:100%; padding: 0 10px;">
                <h3 style="margin:0 0 15px 0; text-align:center;">🔥 Mai Kalória</h3>
                
                <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:10px;">
                    <div style="text-align:left;">
                        <div style="font-size:0.85em; opacity:0.7; margin-bottom:2px;">Elhasznált</div>
                        <div id="calBurned" style="font-size:1.6em; font-weight:800; color:#fff;">0</div>
                    </div>
                    
                    <div style="text-align:right;">
                        <div style="font-size:0.85em; opacity:0.7; margin-bottom:2px;">Hátralévő</div>
                        <div id="calLeft" style="font-size:1.6em; font-weight:800; color:var(--gold-1);">0</div>
                    </div>
                </div>

                <div style="background:rgba(255,255,255,0.1); height:6px; border-radius:3px; overflow:hidden; width:100%;">
                    <div id="calRing" style="height:100%; width:0%; background:var(--gold-1); transition:width 0.5s ease-out;"></div>
                </div>
            </div>`
    },
    'bmi': {
        title: 'BMI Kalkulátor',
        content: `
            <div class="widget-content">
                <h3>⚖️ BMI / BMR</h3>
                <div style="display:flex; gap:5px; flex-wrap:wrap;">
                    <input id="w" type="number" placeholder="Súly (kg)" style="width:80px">
                    <input id="h" type="number" placeholder="Magasság" style="width:80px">
                </div>
                <button onclick="calculateBMI()" class="cta-inline" style="margin-top:10px; width:100%">Számol</button>
                <div id="out" style="margin-top:10px; font-weight:bold;"></div>
            </div>`
    },
    'tip': {
        title: 'Napi Tipp',
        content: `
            <div class="widget-content">
                <h3>💡 Napi tipp</h3>
                <p id="dailyTipText" style="font-size:0.9em; opacity:0.8; margin-top:10px;">Betöltés...</p>
            </div>`
    },
    'weekly_streak': {
        title: 'Heti Széria',
        content: `
            <div class="widget-content" style="display:flex; flex-direction:column; justify-content:center; height:100%; padding:5px;">
                <h3 style="margin:0 0 10px 0; text-align:center;">🔥 Heti Széria</h3>
                
                <div id="streakDotsContainer" style="display:flex; justify-content:space-between; padding: 0 10px;">
                    <div class="streak-dot" style="width:25px; height:25px; border-radius:50%; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; font-size:10px;">H</div>
                    <div class="streak-dot" style="width:25px; height:25px; border-radius:50%; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; font-size:10px;">K</div>
                    <div class="streak-dot" style="width:25px; height:25px; border-radius:50%; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; font-size:10px;">Sz</div>
                    <div class="streak-dot" style="width:25px; height:25px; border-radius:50%; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; font-size:10px;">Cs</div>
                    <div class="streak-dot" style="width:25px; height:25px; border-radius:50%; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; font-size:10px;">P</div>
                    <div class="streak-dot" style="width:25px; height:25px; border-radius:50%; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; font-size:10px;">Sz</div>
                    <div class="streak-dot" style="width:25px; height:25px; border-radius:50%; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; font-size:10px;">V</div>
                </div>
                
                <p id="streakCountText" style="text-align:center; font-size:0.8em; opacity:0.7; margin-top:10px;">Adatok betöltése...</p>
            </div>`
    },
    'weight_trend': {
        title: 'Súly Trend',
        content: `
            <div class="widget-content" style="display:flex; flex-direction:column; justify-content:center; height:100%; padding:5px;">
                <h3 style="margin:0 0 10px 0;">📉 Súly Trend</h3>
                
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:5px;">
                    <div style="text-align:left;">
                        <span style="font-size:0.8em; opacity:0.7;">Kezdő</span>
                        <div id="weightStartVal" style="font-weight:bold; font-size:1.1em;">--</div>
                    </div>
                    <div style="font-size:1.5em; color:var(--gold-1);">➝</div>
                    <div style="text-align:right;">
                        <span style="font-size:0.8em; opacity:0.7;">Most</span>
                        <div id="weightCurrentVal" style="font-weight:bold; font-size:1.1em;">--</div>
                    </div>
                </div>

                <div id="weightChangeBadge" style="background:rgba(255,255,255,0.1); padding:4px 8px; border-radius:6px; text-align:center; font-weight:bold; font-size:0.9em; margin-top:5px;">
                    Betöltés...
                </div>
            </div>`
    },
    'login_streak': {
        title: 'Napok',
        content: `
            <div class="widget-content" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:5px;">
                
                <div style="position:relative; margin-bottom:5px;">
                    <div id="flameIcon" style="font-size:3.5em; filter: drop-shadow(0 0 10px rgba(255, 69, 0, 0.6)); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                        🔥
                    </div>
                </div>

                <div style="text-align:center;">
                    <div id="loginStreakCount" style="font-size:2em; font-weight:900; color:var(--gold-1); line-height:1;">
                        0
                    </div>
                    <div style="font-size:0.85em; opacity:0.8; margin-top:5px; font-weight:bold;">
                        NAPOS SZÉRIA
                    </div>
                </div>
                
                <div id="streakMsg" style="font-size:0.75em; color:#aaa; margin-top:8px;">
                    Gyere vissza holnap is!
                </div>
            </div>`
    },
    'xp_level': {
        title: 'Szint',
        content: `
            <div class="widget-content" style="display:flex; flex-direction:column; justify-content:center; height:100%; padding:5px 10px;">
                
                <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:5px;">
                    <div style="text-align:left;">
                        <div id="xpLevelTitle" style="font-size:0.85em; font-weight:bold; color:var(--gold-1); text-transform:uppercase;">Rang betöltése...</div>
                        <div id="xpLevelNum" style="font-size:1.4em; font-weight:900; line-height:1.1;">Lvl ?</div>
                    </div>
                    <div id="xpText" style="font-size:0.8em; opacity:0.7;">0 / 500 XP</div>
                </div>

                <div style="background:rgba(255,255,255,0.1); height:10px; border-radius:5px; overflow:hidden; width:100%; box-shadow:inset 0 1px 3px rgba(0,0,0,0.3);">
                    <div id="xpBar" style="width:0%; height:100%; background:linear-gradient(90deg, var(--gold-1), #FFA500); transition:width 1s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 0 10px rgba(255, 215, 0, 0.4);"></div>
                </div>
                
                <div style="text-align:center; margin-top:8px; font-size:0.75em; opacity:0.6;">
                    Gyűjts XP-t edzéssel és naplózással!
                </div>
            </div>`
    },
};

// --- 2. ALAPÉRTELMEZETT ELRENDEZÉS (MINDEN WIDGETTEL) ---
const DEFAULT_LAYOUT = [
    // Felső sor: Víz és Kalória (Nagyobbak)
    { x: 0, y: 0, w: 4, h: 4, id: 'water' },     
    { x: 4, y: 0, w: 4, h: 4, id: 'calories' },  
    
    // Mellette BMI
    { x: 8, y: 0, w: 4, h: 4, id: 'bmi' },       

    // Alsó sor: Kisebb widgetek
    { x: 0, y: 4, w: 8, h: 2, id: 'tip' },        
    { x: 8, y: 4, w: 4, h: 2, id: 'weekly_streak' },
    { x: 0, y: 6, w: 12, h: 2, id: 'weight_trend' },
    { x: 9, y: 4, w: 3, h: 2, id: 'login_streak' },

    { x: 0, y: 4, w: 8, h: 2, id: 'xp_level' },
];

// --- 3. INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    grid = GridStack.init({
        cellHeight: 70, 
        margin: 10,     
        column: 12,     
        animate: true,  
        float: true,
        staticGrid: true, 
    });

    await loadUserLayout();
    
    // Adatok betöltése
    refreshWidgetData();

    grid.on('change', function(event, items) {
        saveUserLayout();
    });
    
    if(typeof setRandomTip === 'function') setRandomTip();
});

// --- ADAT FRISSÍTŐ KÖZPONT (REAL-TIME VERZIÓ) ---
async function refreshWidgetData() {
    const token = localStorage.getItem("token");
    if(!token) return;

    // 1. VÍZ ADATOK LEKÉRÉSE (BACKEND HÍVÁS)
    if (document.getElementById('waterValue')) {
        try {
            const res = await fetch('/api/v1/water/today', {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                // A backend visszaadja: { current: 1200, target: 2500 }
                updateWaterUI(data.current, data.target);
            }
        } catch (e) { console.error("Víz lekérési hiba", e); }
    }

    // 2. KALÓRIA ADATOK LEKÉRÉSE
    if (document.getElementById('calBurned')) {
        try {
            // A: Lekérjük a CÉLT (a kalkulátortól)
            const resTarget = await fetch("/api/v1/diet/calculate", {
                method: "POST", 
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
            });
            
            // B: Lekérjük a FOGYASZTÁST (az új summary végponttól)
            const resSummary = await fetch("/api/v1/diet/dashboard-summary", {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if(resTarget.ok && resSummary.ok) {
                const dataTarget = await resTarget.json();
                const dataSummary = await resSummary.json();
                
                const target = dataTarget.calories || 2000; 
                const consumed = dataSummary.consumed || 0; 
                
                updateCalorieUI(consumed, target);
            }
        } catch (e) { console.error("Kalória lekérési hiba", e); }
    }

    // 3. HETI SZÉRIA LEKÉRÉSE (ÚJ!)
    if (document.getElementById('streakDotsContainer')) {
        try {
            const res = await fetch('/api/v1/workouts/weekly_streak', {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                updateStreakUI(data);
            }
        } catch (e) { console.error("Streak hiba", e); }
    }
    // 4. SÚLY TREND LEKÉRÉSE
    if (document.getElementById('weightStartVal')) {
        try {
            const res = await fetch('/api/v1/weight/trend', {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                updateWeightTrendUI(data);
            }
        } catch (e) { console.error("Súly trend hiba", e); }
    }
    // 5. LOGIN STREAK LEKÉRÉSE (ÚJ!)
    if (document.getElementById('loginStreakCount')) {
        try {
            // Itt a users/streak végpontot hívjuk
            const res = await fetch('/api/v1/users/streak', {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                updateLoginStreakUI(data);
            }
        } catch (e) { console.error("Streak hiba", e); }
    }
    // 6. XP STATUS LEKÉRÉSE (ÚJ!)
    if (document.getElementById('xpLevelNum')) {
        try {
            const res = await fetch('/api/v1/users/xp_status', {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                updateXpUI(data);
            }
        } catch (e) { console.error("XP hiba", e); }
    }
}

// --- VÍZ LOGIKA (OKOS) ---
let currentWater = 0; // Globális változó a kliens oldali állapothoz
let currentWaterTarget = 2500;

function updateWaterUI(val, target) {
    currentWater = val; // Frissítjük a globális állapotot
    currentWaterTarget = target;

    const elVal = document.getElementById('waterValue');
    const elBar = document.getElementById('waterBar');
    const elTarget = document.getElementById('waterTarget');
    
    if(elVal) elVal.textContent = `${val} ml`;
    if(elTarget) elTarget.textContent = `Cél: ${target}ml`;
    
    if(elBar) {
        const pct = Math.min((val / target) * 100, 100);
        elBar.style.width = `${pct}%`;
    }
}

async function addWater(amount) {
    const token = localStorage.getItem("token");
    if(!token) return;

    // 1. Optimista UI frissítés (hogy gyorsnak tűnjön)
    const oldVal = currentWater;
    updateWaterUI(currentWater + amount, currentWaterTarget);

    try {
        // 2. Beküldés a szervernek
        const res = await fetch("/api/v1/water/add", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify({ amount_ml: amount }) // Figyelj: amount_ml a neve a backendben!
        });

        if (!res.ok) throw new Error("Hiba a mentésnél");
        
        // Ha minden oké, nem kell semmit tenni, az UI már frissült.
        console.log(`Sikeresen hozzáadva: ${amount}ml`);

    } catch (err) {
        console.error("Víz mentési hiba:", err);
        // Hiba esetén visszavonjuk az UI változást
        updateWaterUI(oldVal, currentWaterTarget);
        alert("Nem sikerült elmenteni a vizet! Ellenőrizd a kapcsolatot.");
    }
}

// --- KALÓRIA UI FRISSÍTŐ (Neve átírva updateCalorieUI-ra) ---
function updateCalorieUI(consumed, target) {
    // A régi ID-kat keressük meg
    const elBurned = document.getElementById('calBurned'); 
    const elLeft = document.getElementById('calLeft');     
    const elRing = document.getElementById('calRing'); // Ez most a sáv lesz

    // 1. Elhasznált (calBurned)
    if(elBurned) {
        elBurned.textContent = Math.round(consumed);
    }
    
    // 2. Hátralévő (calLeft)
    if(elLeft) {
        const left = Math.round(target - consumed);
        elLeft.textContent = left; // Csak a számot írjuk ki
        
        // Színezés
        if (left < 0) {
            elLeft.style.color = "var(--err, #ff4d4d)"; 
        } else {
            elLeft.style.color = "var(--gold-1, #ffd700)";
        }
    }

    // 3. Csík (calRing újrahasznosítva)
    if(elRing) {
        // Fontos: Töröljük a régi kördiagram stílust (background image)
        elRing.style.backgroundImage = 'none'; 
        
        const pct = Math.min((consumed / target) * 100, 100);
        elRing.style.width = `${pct}%`;
        
        if (consumed > target) {
            elRing.style.backgroundColor = "var(--err, #ff4d4d)";
        } else {
            elRing.style.backgroundColor = "var(--gold-1, #ffd700)";
        }
    }
}

// --- SZERKESZTÉS, MENTÉS, LOAD (A JAVÍTOTT VERZIÓK) ---
function toggleEditMode() {
    isEditMode = !isEditMode; 
    const editBtn = document.getElementById('editBtn');
    const resetBtn = document.getElementById('resetBtn');
    const gridEl = document.querySelector('.grid-stack');

    if (isEditMode) {
        grid.setStatic(false); 
        gridEl.classList.add('editing-mode'); 
        editBtn.innerHTML = "<span>💾</span> Kész";
        editBtn.classList.replace('ghost', 'cta'); 
        resetBtn.style.display = "inline-block"; 
    } else {
        grid.setStatic(true); 
        gridEl.classList.remove('editing-mode');
        editBtn.innerHTML = "<span>✏️</span> Elrendezés";
        editBtn.classList.replace('cta', 'ghost'); 
        resetBtn.style.display = "none"; 
        saveUserLayout();
    }
}

async function loadUserLayout() {
    const token = localStorage.getItem("token");
    if (!token) return; 

    try {
        const res = await fetch("/api/v1/users/me", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Load failed");
        const user = await res.json();
        
        let layout = user.dashboard_config;
        if (!layout || layout.length === 0) {
            layout = DEFAULT_LAYOUT;
        }
        renderWidgets(layout);
    } catch (err) {
        console.error("Hiba:", err);
        renderWidgets(DEFAULT_LAYOUT); 
    }
}

function renderWidgets(layoutItems) {
    grid.removeAll(); 
    layoutItems.forEach(node => {
        const template = WIDGET_TEMPLATES[node.id];
        if (!template) return; // Ha véletlenül olyan ID van mentve, ami már nincs, átugorjuk
        const widgetHtml = `
            <div class="grid-stack-item" gs-id="${node.id}" gs-x="${node.x}" gs-y="${node.y}" gs-w="${node.w}" gs-h="${node.h}">
                <div class="grid-stack-item-content card glass" style="overflow: hidden; padding: 10px; display:flex; flex-direction:column;">
                    ${template.content}
                </div>
            </div>`;
        grid.addWidget(widgetHtml);
    });
    grid.setStatic(!isEditMode);
}

async function saveUserLayout() {
    const token = localStorage.getItem("token");
    if (!token) return;

    const gridItems = grid.getGridItems();
    const cleanLayout = gridItems.map(el => {
        const node = el.gridstackNode;
        return {
            id: node.id || el.getAttribute('gs-id'), 
            x: node.x, y: node.y, w: node.w, h: node.h
        };
    });

    try {
        const res = await fetch("/api/v1/users/me", {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ dashboard_config: cleanLayout })
        });
        if (res.ok) {
            console.log("Layout mentve! ✅");
        }
    } catch (err) {
        console.error("Mentési hiba:", err);
    }
}

function calculateBMI() {
    const wInput = document.querySelector('.grid-stack-item #w');
    const hInput = document.querySelector('.grid-stack-item #h');
    const out = document.querySelector('.grid-stack-item #out');
    if(!wInput || !hInput) return;
    const w = parseFloat(wInput.value);
    const h = parseFloat(hInput.value);
    if (w && h) {
        const bmi = w / ((h/100) * (h/100));
        out.innerHTML = `BMI: ${bmi.toFixed(1)}`;
    } else {
        out.innerHTML = "Add meg az adatokat!";
    }
}

function resetDashboard() {
    if(confirm("Visszaállítod az alapértelmezést?")) {
        renderWidgets(DEFAULT_LAYOUT);
        saveUserLayout();
        refreshWidgetData(); 
    }
}

function updateStreakUI(data) {
    const container = document.getElementById('streakDotsContainer');
    const textInfo = document.getElementById('streakCountText');
    if (!container || !data) return;

    // Töröljük a "loading" pöttyöket
    container.innerHTML = '';

    data.days.forEach(day => {
        const dot = document.createElement('div');
        
        // Stílusok beállítása
        dot.style.width = '25px';
        dot.style.height = '25px';
        dot.style.borderRadius = '50%';
        dot.style.display = 'flex';
        dot.style.alignItems = 'center';
        dot.style.justifyContent = 'center';
        dot.style.fontSize = '10px';
        dot.textContent = day.label;
        
        if (day.is_active) {
            // Ha volt edzés: ARANY szín és fekete betű
            dot.style.background = 'var(--gold-1)';
            dot.style.color = '#000';
            dot.style.fontWeight = 'bold';
            dot.title = "Edzés nap!";
        } else {
            // Ha nem volt: Halvány
            dot.style.background = 'rgba(255,255,255,0.1)';
            dot.style.color = '#fff';
        }

        // Ha ez a mai nap, tegyünk rá egy kis keretet vagy effektet
        if (day.is_today) {
            dot.style.border = '1px solid rgba(255,255,255,0.5)';
        }

        container.appendChild(dot);
    });

    if (textInfo) {
        textInfo.textContent = `${data.count} edzés ezen a héten`;
    }
}

function updateWeightTrendUI(data) {
    const elStart = document.getElementById('weightStartVal');
    const elCurr = document.getElementById('weightCurrentVal');
    const elBadge = document.getElementById('weightChangeBadge');

    if (elStart) elStart.textContent = `${data.start} kg`;
    if (elCurr) elCurr.textContent = `${data.current} kg`;

    if (elBadge) {
        // Formázás: "+1.5 kg" vagy "-2.0 kg"
        const sign = data.change > 0 ? "+" : "";
        const formattedChange = `${sign}${data.change.toFixed(1)} kg`;
        
        // Ha nincs, vagy nagyon pici a változás
        if (Math.abs(data.change) < 0.1) {
             elBadge.textContent = "Nincs változás";
             elBadge.style.background = "rgba(255,255,255,0.1)";
             elBadge.style.color = "#fff";
             elBadge.style.border = "none";
        } else {
             elBadge.textContent = `${formattedChange} összesen`;
             
             // Színezés: Fogyás = Zöld, Hízás = Piros (általános cél)
             if (data.change <= 0) {
                 // Fogyás -> Zöld
                 elBadge.style.background = "rgba(50,205,50,0.2)";
                 elBadge.style.color = "#90ee90"; 
                 elBadge.style.border = "1px solid rgba(50,205,50,0.3)";
             } else {
                 // Hízás -> Pirosas
                 elBadge.style.background = "rgba(255,99,71,0.2)";
                 elBadge.style.color = "#ffcccb"; 
                 elBadge.style.border = "1px solid rgba(255,99,71,0.3)";
             }
        }
    }
}

function updateLoginStreakUI(data) {
    const elCount = document.getElementById('loginStreakCount');
    const elIcon = document.getElementById('flameIcon');
    const elMsg = document.getElementById('streakMsg');

    if (elCount) {
        // Pörgős számláló effekt (opcionális, de menő)
        elCount.textContent = data.streak;
        
        // Ha nagy a széria, legyen pirosabb/aranyabb a szín
        if (data.streak >= 7) elCount.style.color = "#FF4500"; // OrangeRed
        else elCount.style.color = "var(--gold-1)";
    }

    if (elIcon) {
        // Kicsi "pulzálás" animáció, hogy éljen a láng
        elIcon.animate([
            { transform: 'scale(1)' },
            { transform: 'scale(1.2)' },
            { transform: 'scale(1)' }
        ], {
            duration: 800,
            iterations: 1
        });
        
        // Ha ma megvan a streak, "izzik"
        if (data.saved_today) {
             elIcon.style.filter = "drop-shadow(0 0 15px rgba(255, 69, 0, 0.9))";
        }
    }
    
    if (elMsg) {
        if (data.streak > 2) elMsg.textContent = "Ne törd meg a láncot!";
        else elMsg.textContent = "Jó kezdés, így tovább!";
    }
}

function updateXpUI(data) {
    const elTitle = document.getElementById('xpLevelTitle');
    const elNum = document.getElementById('xpLevelNum');
    const elBar = document.getElementById('xpBar');
    const elText = document.getElementById('xpText');

    if (elTitle) elTitle.textContent = data.title;
    if (elNum) elNum.textContent = `Lvl ${data.level}`;
    
    if (elBar) elBar.style.width = `${data.progress_percent}%`;
    
    if (elText) elText.textContent = `${data.xp_in_level} / ${data.required_xp} XP`;
}