/* --- (1) AUTH GUARD TÖRÖLVE --- */
// Töröltük az "oldalvédőt", hogy a vendégek is láthassák az index.html-t.
/* --- VÉGE --- */


/******************* app.js (kimenet) *******************/
const $ = (s, r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

// Slider
const track = $('#track');
if (track) { // Csak akkor fut, ha az elem létezik (nem a login oldalon van)
    const setIndex = (i)=>{ track.dataset.index=i; track.style.transform = `translateX(${-33.333*i}%)`; };
    $('#leftBtn').addEventListener('click',()=>setIndex(0));
    $('#rightBtn').addEventListener('click',()=>setIndex(2));
    $('#homeBtn').addEventListener('click',()=>setIndex(1));
    $('#getStarted').addEventListener('click',()=>setIndex(2));
    $$('#home .chip').forEach(b=>b.addEventListener('click',e=>{ const dir=e.currentTarget.dataset.go; if(dir==='left') setIndex(0); if(dir==='right') setIndex(2);}));
    window.addEventListener('keydown',(e)=>{ const i=+track.dataset.index; if(e.key==='ArrowLeft') setIndex(Math.max(0,i-1)); if(e.key==='ArrowRight') setIndex(Math.min(2,i+1)); });
    let sx=null; window.addEventListener('touchstart',e=>{sx=e.touches[0].clientX},{passive:true});
    window.addEventListener('touchend',e=>{ if(sx===null) return; const dx=e.changedTouches[0].clientX - sx; const i=+track.dataset.index; if(dx>50)setIndex(Math.max(0,i-1)); if(dx<-50)setIndex(Math.min(2,i+1)); sx=null; },{passive:true});
}

// BMI/BMR
const calcBtn = $('#calc');
if (calcBtn) {
    calcBtn.addEventListener('click',()=>{
      const w=parseFloat($('#w').value), h=parseFloat($('#h').value), age=parseFloat($('#age').value), sex=$('#sex').value;
      const out=$('#out'); if(!w||!h||!age){ out.textContent = (LANG==='hu')? 'Kérlek töltsd ki mindhárom mezőt.' : 'Please fill all three fields.'; return; }
      const m=h/100, bmi=w/(m*m), bmr=(sex==='male')?(10*w+6.25*h-5*age+5):(10*w+6.25*h-5*age-161); out.innerHTML=`BMI: <strong>${bmi.toFixed(1)}</strong> • BMR: <strong>${Math.round(bmr)}</strong> kcal/nap`;
    });
}

// Makró mentés (DEMO MÓD)
const saveMacrosBtn = $('#saveMacros');
if (saveMacrosBtn) {
    saveMacrosBtn.addEventListener('click',()=>{ const msg=$('#macroMsg'); msg.style.color='var(--ok)'; msg.textContent=(LANG==='hu')?'✅ Mentve (demo)':'✅ Saved (demo)'; setTimeout(()=>{ msg.style.color='var(--muted)'; msg.textContent=''; },1800); });
}

// i18n (egyszerű HU/EN)
let LANG='hu';
let registrationDate = null; // backendből jön majd (user.created_at), fallback ha nincs
const TXT={
  hu:{navDiet:'Étrend',navWorkout:'Edzésterv',navSignin:'Bejelentkezés',cta:'Kezdjük el',homeTitle:'Edzésterv + Étrend – egyben, egyszerűen.',homeSubtitle:'Az ATHLION a céljaidhoz igazítja az edzést és az étrendet.',goDiet:'← Étrend kezelő',goWorkout:'Edzésterv →',dietTitle:'Étrend kezelő',dietSubtitle:'Makró-célok, heti terv, bevásárlólista.',macroTitle:'Makró célok',calLabel:'Napi kalória',foodSearchTitle:'Étel kereső',weeklyDietTitle:'Heti étrend',bmiTitle:'BMI / BMR',tipTitle:'Napi tipp',tipCopy:'Aludj 7–9 órát. A fejlődés 50%-a a pihenőn múlik.',qsTitle:'Gyorsindító',qsCopy:'Válaszd ki a célod és indulhat a tervgenerálás.',workoutTitle:'Edzésterv-összeállító',workoutSubtitle:'Fogd-és-vidd gyakorlatsorrend, heti bontás.',weekPlanTitle:'Heti terv',dMon:'Hétfő:',dWed:'Szerda:',dFri:'Péntek:'},
  en:{navDiet:'Diet',navWorkout:'Workout',navSignin:'Sign in',cta:'Get Started',homeTitle:'Training + Diet — together, simply.',homeSubtitle:'ATHLION adapts training and nutrition to your goals.',goDiet:'← Diet Manager',goWorkout:'Workout →',dietTitle:'Diet Manager',dietSubtitle:'Macro targets, weekly plan, shopping list.',macroTitle:'Macro goals',calLabel:'Daily calories',foodSearchTitle:'Food Search',weeklyDietTitle:'Weekly diet',bmiTitle:'BMI / BMR',tipTitle:'Daily tip',tipCopy:'Sleep 7–9 hours. Half of progress comes from rest.',qsTitle:'Quickstart',qsCopy:'Pick your goal and generate a plan.',workoutTitle:'Plan Builder',workoutSubtitle:'Drag & drop ordering, weekly layout.',weekPlanTitle:'Weekly plan',dMon:'Monday:',dWed:'Wednesday:',dFri:'Friday:'}
};
function t(){ 
    const navDiet = $('#navDiet');
    if (!navDiet) return;           // ha nincs nav, nincs mit fordítani

    const S = TXT[LANG];
    const setText = (id, value) => {
      const el = $('#'+id);
      if (el) el.textContent = value;
    };

    navDiet.textContent = S.navDiet;
    const navWorkout = $('#navWorkout');
    if (navWorkout) navWorkout.textContent = S.navWorkout;

    const getStartedBtn = $('#getStarted');
    if (getStartedBtn) getStartedBtn.textContent = S.cta;

    const homeTitle = $('#homeTitle');
    if (homeTitle && (homeTitle.textContent === TXT.en.homeTitle || homeTitle.textContent === TXT.hu.homeTitle)) {
        homeTitle.textContent = S.homeTitle; 
    }

    setText('homeSubtitle', S.homeSubtitle);
    setText('goDiet', S.goDiet);
    setText('goWorkout', S.goWorkout);

    setText('dietTitle', S.dietTitle);
    setText('dietSubtitle', S.dietSubtitle);
    setText('macroTitle', S.macroTitle);
    setText('calLabel', S.calLabel);
    setText('foodSearchTitle', S.foodSearchTitle);
    setText('weeklyDietTitle', S.weeklyDietTitle);

    setText('bmiTitle', S.bmiTitle);
    setText('tipTitle', S.tipTitle);
    setText('tipCopy', S.tipCopy);
    setText('qsTitle', S.qsTitle);
    setText('qsCopy', S.qsCopy);

    setText('workoutTitle', S.workoutTitle);
    setText('workoutSubtitle', S.workoutSubtitle);
    setText('weekPlanTitle', S.weekPlanTitle);
    setText('dMon', S.dMon);
    setText('dWed', S.dWed);
    setText('dFri', S.dFri);

    // Diet funkciók csak akkor fognak csinálni bármit, ha az elemek léteznek
    buildDietTabs(); 
    renderDayMeals(); 
    doFoodSearch();
}

const langToggleBtn = $('#langToggle');
if(langToggleBtn){
    langToggleBtn.addEventListener('click',()=>{ LANG=(LANG==='hu')?'en':'hu'; t(); });
}



    async function doFoodSearch() {
      const q = ($('#foodQuery').value || '').toLowerCase().trim();
      const box = $('#foodResults');
      
      // Kezdeti állapot vagy túl rövid keresés
      if (q.length < 3) {
        box.innerHTML = `<div style="padding:10px;color:var(--muted)">${LANG==='hu'?'Írj be legalább 3 karaktert a kereséshez.':'Type at least 3 characters to search.'}</div>`;
        return;
      }

      box.innerHTML = `<div style="padding:10px;color:var(--muted)">${LANG==='hu'?'Keresés...':'Searching...'}</div>`;

      try {
        // --- API HÍVÁS ---
        const res = await fetch(`/api/v1/foods/search?q=${encodeURIComponent(q)}`);
        
        if (!res.ok) {
            // Hiba esetén a szerver válaszának kiírása
            const errData = await res.json();
            throw new Error(errData.detail || 'Hálózati hiba');
        }
        
        const list = await res.json();
        
        // --- Eredmények megjelenítése ---
        box.innerHTML = ''; // Lista kiürítése
        
        if (!list.length) {
          box.innerHTML = `<div style="padding:10px;color:var(--muted)">${LANG==='hu'?'Nincs találat.':'No results.'}</div>`;
          return;
        }

        // Találatok beillesztése a listába
        list.forEach(item => {
          const row = document.createElement('div');
          row.className = 'result';
          
          // API válasz (item.kcal_100g stb.) alapján építjük a HTML-t
          // A Math.round() kerekíti a számokat, ha törtek lennének
          const kcal = Math.round(item.kcal_100g || 0);
          const p = Math.round(item.protein_100g || 0);
          const c = Math.round(item.carbs_100g || 0);
          const f = Math.round(item.fat_100g || 0);

          row.innerHTML = `<span>${item.food_name} <small style="opacity:.7">(${kcal} kcal • P${p}/C${c}/F${f})</small></span><button>${(LANG==='hu')?'Hozzáad':'Add'}</button>`;
          
          // Gomb eseménykezelője: hozzáadás a napi listához
          row.querySelector('button').addEventListener('click', () => addMealToDay(activeDayIndex, { name: item.food_name, kcal: kcal }));
          
          box.appendChild(row);
        });

      } catch (err) {
        console.error(err);
        box.innerHTML = `<div style="padding:10px;color:var(--err)">${LANG==='hu'?'Hiba a keresés közben.':'Error during search.'}</div>`;
      }
    }


// Weekly diet tabs (demo)
const DAYS_KEYS=['mon','tue','wed','thu','fri','sat','sun'];
let activeDayIndex=0; const WEEK=DAYS_KEYS.map(()=>[]);
function dayName(key){ return (LANG==='hu')?({mon:'Hétfő',tue:'Kedd',wed:'Szerda',thu:'Csütörtök',fri:'Péntek',sat:'Szombat',sun:'Vasárnap'})[key]:({mon:'Monday',tue:'Tuesday',wed:'Wednesday',thu:'Thursday',fri:'Friday',sat:'Saturday',sun:'Sunday'})[key]; }
function buildDietTabs(){ const tabs=$('#dietTabs'); if(!tabs) return; tabs.innerHTML=''; DAYS_KEYS.forEach((k,i)=>{ const b=document.createElement('button'); b.className='tab'+(i===activeDayIndex?' active':''); b.textContent=dayName(k); b.addEventListener('click',()=>{ activeDayIndex=i; buildDietTabs(); renderDayMeals(); }); tabs.appendChild(b); }); }
function renderDayMeals(){ const box=$('#dietDayList'); if(!box) return; const items=WEEK[activeDayIndex]; box.innerHTML=''; if(!items.length){ const empty=document.createElement('div'); empty.style.cssText='padding:12px 20px;color:var(--muted)'; empty.textContent=(LANG==='hu'?'Nincs még tétel ezen a napon.':'No items yet for this day.'); box.appendChild(empty); return; } items.forEach(obj=>{ const row=document.createElement('div'); row.className='meal-item'; row.innerHTML=`<span>${obj.name}</span><span class="kcal">${obj.kcal} kcal</span>`; box.appendChild(row); }); }
function addMealToDay(i,item){ WEEK[i].push(item); renderDayMeals(); }
buildDietTabs(); renderDayMeals();

// Drag & Drop (demo

// A t() függvény hívása, miután minden definíció kész
t(); 


// --- TÖRÖLT KÓD: Gyorsindító (Quickstart) Kalkulátor ---
// A "Start" gomb logikáját töröltük, mert a számítás automatikusan történik
// --- TÖRÖLT KÓD VÉGE ---


/* --- ATHLION AUTH INIT (Bejelentkezés-kezelő) --- */
// Ez a kód akkor fut le, amikor az oldal betöltődött.
document.addEventListener("DOMContentLoaded", () => {
    
    const token = localStorage.getItem("token"); // Token újraolvasása
    const navSigninBtn = $('#navSignin');
    
    if (!navSigninBtn) return;
    if (!token) return; // Ha nincs token, "vendég" módban maradunk, nem csinálunk semmit

    // 1. Próbáljuk meg lekérni a felhasználó adatait
    fetch("/api/v1/auth/users/me", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}` 
        }
    })
    .then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Invalid token");
        }
    })
    .then(user => {
        // SIKERES BEJELENTKEZÉS
        navSigninBtn.textContent = "Kijelentkezés";
        navSigninBtn.href = "#"; 
        navSigninBtn.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem("token");
            window.location.href = "index.html"; 
        });
        
        const homeTitle = $('#homeTitle');
        if (homeTitle) {
            homeTitle.textContent = `Üdvözlünk, ${user.user_name}!`;
        }

        // --- ÚJ KÓD: Automatikus makró-kalkuláció ---
        // Közvetlenül bejelentkezés után lefuttatjuk a számítást
        fetch("/api/v1/diet/calculate", {
            method: "POST", // POST-ot használunk, mert ez egy "akció", ami számol
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
            // Nincs 'body', mert a backend mindent az adatbázisból olvas ki
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
            // Sikeres válasz: Töltsük ki a makró űrlapot
            if ($('#cal')) $('#cal').value = data.calories;
            if ($('#p')) $('#p').value = data.protein;
            if ($('#c')) $('#c').value = data.carbs;
            if ($('#f')) $('#f').value = data.fat;
        })
        .catch(err => {
            // Ez az a hiba, amit láttál (pl. "Active DietProfile not found")
            console.error("Macro calculation error:", err.message);
            const msg = $('#macroMsg'); // A "Makró célok" alatti üzenet
            if(msg) {
                msg.style.color = 'var(--err)';
                msg.textContent = `❌ Hiba a makrók betöltésekor: ${err.message}`;
            }
        });
        // --- ÚJ KÓD VÉGE ---

    })
    .catch(err => {
        console.error("Auth error:", err.message);
        localStorage.removeItem("token");
    });
});

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

// ===== NAV AUTH UI =====

function updateAuthUI() {
  const token = localStorage.getItem('token');

  const navRegister = $('#navRegister');
  const navSignin   = $('#navSignin');
  const navLogout   = $('#navLogout');
  const welcome     = $('#welcomeText');

  if (!welcome || !navLogout) return; // ha nem ezen az oldalon vagyunk

  if (token) {
    const name  = localStorage.getItem('user_name');
    const email = localStorage.getItem('user_email');

    let label = 'Bejelentkezve';
    if (name) {
      label = `Szia, ${name}!`;
    } else if (email) {
      const nick = email.split('@')[0];
      label = `Szia, ${nick}!`;
    }

    welcome.textContent = label;
    welcome.style.display = 'inline-flex';

    if (navRegister) navRegister.style.display = 'none';
    if (navSignin)   navSignin.style.display   = 'none';
    navLogout.style.display = 'inline-flex';
  } else {
    welcome.textContent = '';
    welcome.style.display = 'none';

    if (navRegister) navRegister.style.display = 'inline-flex';
    if (navSignin)   navSignin.style.display   = 'inline-flex';
    navLogout.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();

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
});
