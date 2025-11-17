/* --- Globális segédfüggvények --- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

// --- Globális állapotok ---
let targetMacros = { cal: 0, p: 0, c: 0, f: 0 };
let LANG = 'hu';

// =================================================
// TARTALOM FORDÍTÁS (i18n)
// =================================================
const TXT = {
    hu: { navDiet: 'Étrend', navWorkout: 'Edzésterv', navSignin: 'Bejelentkezés', cta: 'Kezdjük el', homeTitle: 'Edzésterv + Étrend – egyben, egyszerűen.', homeSubtitle: 'Az ATHLION a céljaidhoz igazítja az edzést és az étrendet.', goDiet: '← Étrend kezelő', goWorkout: 'Edzésterv →', dietTitle: 'Étrend kezelő', dietSubtitle: 'Makró-célok, heti terv, bevásárlólista.', macroTitle: 'Makró Célok', calLabel: 'Napi kalória', foodSearchTitle: 'Étel keresése', weeklyDietTitle: 'Heti étrend', bmiTitle: 'BMI / BMR', tipTitle: 'Napi tipp', tipCopy: 'Aludj 7–9 órát. A fejlődés 50%-a a pihenőn múlik.', qsTitle: 'Gyorsindító', qsCopy: 'Válaszd ki a célod és indulhat a tervgenerálás.', workoutTitle: 'Edzésterv-összeállító', workoutSubtitle: 'Fogd-és-vidd gyakorlatsorrend, heti bontás.', weekPlanTitle: 'Heti terv', dMon: 'Hétfő:', dWed: 'Szerda:', dFri: 'Péntek:' },
    en: { navDiet: 'Diet', navWorkout: 'Workout', navSignin: 'Sign in', cta: 'Get Started', homeTitle: 'Training + Diet — together, simply.', homeSubtitle: 'ATHLION adapts training and nutrition to your goals.', goDiet: '← Diet Manager', goWorkout: 'Workout →', dietTitle: 'Diet Manager', dietSubtitle: 'Macro targets, weekly plan, shopping list.', macroTitle: 'Macro goals', calLabel: 'Daily calories', foodSearchTitle: 'Food Search', weeklyDietTitle: 'Weekly diet', bmiTitle: 'BMI / BMR', tipTitle: 'Daily tip', tipCopy: 'Sleep 7–9 hours. Half of progress comes from rest.', qsTitle: 'Quickstart', qsCopy: 'Pick your goal and generate a plan.', workoutTitle: 'Plan Builder', workoutSubtitle: 'Drag & drop ordering, weekly layout.', weekPlanTitle: 'Weekly plan', dMon: 'Monday:', dWed: 'Wednesday:', dFri: 'Friday:' }
};

function t() {
    const S = TXT[LANG];
    const setText = (id, value) => {
        const el = $('#' + id);
        if (el) el.textContent = value;
    };

    // Navigáció
    const navDiet = $('#navDiet');
    if (navDiet) navDiet.textContent = S.navDiet;
    const navWorkout = $('#navWorkout');
    if (navWorkout) navWorkout.textContent = S.navWorkout;

    // index.html
    const homeTitle = $('#homeTitle');
    if (homeTitle && (homeTitle.textContent === TXT.en.homeTitle || homeTitle.textContent === TXT.hu.homeTitle)) {
        homeTitle.textContent = S.homeTitle;
    }
    setText('homeSubtitle', S.homeSubtitle);
    setText('bmiTitle', S.bmiTitle);
    setText('tipTitle', S.tipTitle);
    setText('tipCopy', S.tipCopy);
    setText('qsTitle', S.qsTitle);
    setText('qsCopy', S.qsCopy);

    // diet.html
    setText('dietTitle', S.dietTitle);
    setText('macroTitle', S.macroTitle);
    setText('modalTitle', S.foodSearchTitle); // Modal cím
    setText('dayLabel', 'Mai nap'); // Napválasztó alaphelyzet

    // workout.html
    setText('workoutTitle', S.workoutTitle);
    setText('workoutSubtitle', S.workoutSubtitle);

    // Nyelvváltó gomb
    const langBtn = $('#langToggle');
    if (langBtn) {
        langBtn.textContent = (LANG === 'hu') ? 'Magyar' : 'English';
    }
}

// Nyelvváltó gomb eseménykezelője
const langToggleBtn = $('#langToggle');
if (langToggleBtn) {
    langToggleBtn.addEventListener('click', () => {
        LANG = (LANG === 'hu') ? 'en' : 'hu';
        t();
        langToggleBtn.blur();
    });
}

// =================================================
// INDEX.HTML - BMI KALKULÁTOR
// =================================================
const calcBtn = $('#calc');
if (calcBtn) {
    calcBtn.addEventListener('click', () => {
        const w = parseFloat($('#w').value), h = parseFloat($('#h').value), age = parseFloat($('#age').value), sex = $('#sex').value;
        const out = $('#out'); if (!w || !h || !age) { out.textContent = (LANG === 'hu') ? 'Kérlek töltsd ki mindhárom mezőt.' : 'Please fill all three fields.'; return; }
        const m = h / 100, bmi = w / (m * m), bmr = (sex === 'male') ? (10 * w + 6.25 * h - 5 * age + 5) : (10 * w + 6.25 * h - 5 * age - 161); out.innerHTML = `BMI: <strong>${bmi.toFixed(1)}</strong> • BMR: <strong>${Math.round(bmr)}</strong> kcal/nap`;
    });
}

// =================================================
// HELYŐRZŐ FÜGGVÉNYEK (hogy az auth ne hibázzon)
// =================================================

/**
 * Ez egy üres "placeholder" függvény.
 * A diet.js felülírja ezt a saját logikájával, de más oldalakon
 * az auth-kezelő (fetchMacros) hívása nem fog hibát dobni.
 */
function updateMacroDisplays() {
    // console.log("Placeholder updateMacroDisplays (nem a diéta oldalon)");
}

// =================================================
// AUTHENTIKÁCIÓ ÉS GLOBÁLIS INDÍTÁS
// =================================================

/**
 * 1. Auth UI frissítése (Gombok elrejtése/megjelenítése)
 */
function updateAuthUI() {
    const token = localStorage.getItem('token');
    const navRegister = $('#navRegister');
    const navSignin = $('#navSignin');
    const navLogout = $('#navLogout');
    const welcome = $('#welcomeText');
    const navProfile = $('#navProfile');
    const heroRegister = $('#heroRegister');
    const heroLogin = $('#heroLogin');

    // A hero gombok csak az index.html-en vannak
    const isIndexPage = !!heroRegister;

    if (token) {
        // --- BEJELENTKEZVE ---
        const name = localStorage.getItem('user_name');
        const email = localStorage.getItem('user_email');
        let label = 'Szia!';
        if (name) {
            label = `Szia, ${name}!`;
        } else if (email) {
            label = `Szia, ${email.split('@')[0]}!`;
        }

        if (welcome) {
            welcome.textContent = label;
            welcome.style.display = 'none'; // Üdvözlő szöveg elrejtve
        }
        if (navRegister) navRegister.style.display = 'none';
        if (navSignin) navSignin.style.display = 'none';
        if (navLogout) navLogout.style.display = 'inline-flex';
        if (navProfile) navProfile.style.display = 'inline-flex';
        if (isIndexPage) {
            heroRegister.style.display = 'none';
            heroLogin.style.display = 'none';
        }

    } else {
        // --- KIJELENTKEZVE (VENDÉG) ---
        if (welcome) welcome.style.display = 'none';
        if (navRegister) navRegister.style.display = 'inline-flex';
        if (navSignin) navSignin.style.display = 'inline-flex';
        if (navLogout) navLogout.style.display = 'none';
        if (navProfile) navProfile.style.display = 'none';
        if (isIndexPage) {
            heroRegister.style.display = 'inline-flex';
            heroLogin.style.display = 'inline-flex';
        }
    }
}

/**
 * 2. Kijelentkezés gomb
 */
function initLogout() {
    const navLogout = $('#navLogout');
    if (navLogout) {
        navLogout.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user_name');
            localStorage.removeItem('user_email');
            updateAuthUI();
            window.location.href = 'index.html';
        });
    }
}

/**
 * 3. Makrók betöltése (ha be van jelentkezve)
 */
function fetchMacros(token) {
    fetch("/api/v1/diet/calculate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        }
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(err => { 
                throw new Error(err.detail || `HTTP ${res.status} hiba`); 
            });
        }
        return res.json();
    })
    .then(data => {
        // 1. Adatok mentése a globális CÉL állapotba
        targetMacros = {
            cal: data.calories,
            p: data.protein,
            c: data.carbs,
            f: data.fat
        };
        
        // 2. Kijelzők frissítése
        // Ez meghívja a diet.js-ben lévő igazi függvényt (ha ott vagyunk),
        // vagy az itteni üres placeholder-t (ha máshol).
        updateMacroDisplays(); 
    })
    .catch(err => {
        console.error("Macro calculation error:", err.message);
        const msg = $('#macroMsg'); // A diagram alatti üzenet
        if(msg) {
            msg.style.color = 'var(--err)';
            // Csak akkor írjuk ki, ha a diet.html-en vagyunk (ahol van #macroMsg)
            msg.textContent = `❌ Hiba a makrók betöltésekor: ${err.message}`;
        }
    });
}

/**
 * 4. Felhasználói adatok betöltése (ha be van jelentkezve)
 */
function fetchUser(token) {
    fetch("/api/v1/auth/users/me", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}` 
        }
    })
    .then(res => {
        if (res.ok) return res.json();
        throw new Error("Invalid token");
    })
    .then(user => {
        // Sikeres bejelentkezés, üdvözlő szöveg beállítása
        const homeTitle = $('#homeTitle');
        if (homeTitle) {
            homeTitle.textContent = `Üdvözlünk, ${user.user_name}!`;
        }
        // És a makrók lekérése
        fetchMacros(token);
    })
    .catch(err => {
        console.error("Auth error:", err.message);
        localStorage.removeItem("token");
        updateAuthUI(); // Visszaállítás vendég nézetre
    });
}

/**
 * 5. MINDENT INDÍTÓ FŐ FÜGGVÉNY
 */
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Lefuttatjuk a fordítást
    t();
    
    // 2. Frissítjük az Auth UI-t (gombok elrejtése/mutatása)
    updateAuthUI();
    
    // 3. Bekötjük a Kijelentkezés gombot
    initLogout();

    // 4. Ellenőrizzük, be van-e jelentkezve
    const token = localStorage.getItem("token");
    if (token) {
        // Ha igen, lekérjük a felhasználó adatait (ami betölti a makrókat is)
        fetchUser(token);
    }
    
    // 5. A diet.js és workout.js saját 'DOMContentLoaded'
    // eseménykezelői itt fognak lefutni, miután ez a közös script lefutott.
});