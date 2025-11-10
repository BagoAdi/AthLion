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
    if (!$('#navDiet')) return;
    const S=TXT[LANG];
    
    // JAVÍTÁS: A t() függvényt "eltiltjuk" a bejelentkezés gomb bántásától.
    $('#navDiet').textContent=S.navDiet; 
    $('#navWorkout').textContent=S.navWorkout; 
    $('#getStarted').textContent=S.cta;

    const homeTitle = $('#homeTitle');
    // Csak akkor írja át a címet, ha az még az alapértelmezett (vagy angol vagy magyar)
    if (homeTitle && (homeTitle.textContent === TXT.en.homeTitle || homeTitle.textContent === TXT.hu.homeTitle)) {
        homeTitle.textContent = S.homeTitle; 
    }
    
    $('#homeSubtitle').textContent=S.homeSubtitle; 
    $('#goDiet').textContent=S.goDiet; 
    $('#goWorkout').textContent=S.goWorkout;
    $('#dietTitle').textContent=S.dietTitle; 
    $('#dietSubtitle').textContent=S.dietSubtitle; 
    $('#macroTitle').textContent=S.macroTitle; 
    $('#calLabel').textContent=S.calLabel; 
    $('#foodSearchTitle').textContent=S.foodSearchTitle; 
    $('#weeklyDietTitle').textContent=S.weeklyDietTitle;
    $('#bmiTitle').textContent=S.bmiTitle; 
    $('#tipTitle').textContent=S.tipTitle; 
    $('#tipCopy').textContent=S.tipCopy; 
    $('#qsTitle').textContent=S.qsTitle; 
    $('#qsCopy').textContent=S.qsCopy;
    $('#workoutTitle').textContent=S.workoutTitle; 
    $('#workoutSubtitle').textContent=S.workoutSubtitle; 
    $('#weekPlanTitle').textContent=S.weekPlanTitle; 
    $('#dMon').textContent=S.dMon; 
    $('#dWed').textContent=S.dWed; 
    $('#dFri').textContent=S.dFri;
    
    buildDietTabs(); 
    renderDayMeals(); 
    doFoodSearch();
}
const langToggleBtn = $('#langToggle');
if(langToggleBtn){
    langToggleBtn.addEventListener('click',()=>{ LANG=(LANG==='hu')?'en':'hu'; t(); });
}


// Food search (demo)
const FOOD=[
  { n:'Csirkemell (sült, 100g)', kcal:165, p:31, c:0, f:3.6 },
  { n:'Zabpehely (50g)', kcal:190, p:7, c:32, f:3 },
  { n:'Rizs, főtt (150g)', kcal:195, p:4, c:43, f:0.4 },
  { n:'Tojás (1 db)', kcal:78, p:6, c:0.6, f:5 },
  { n:'Túró (100g)', kcal:98, p:12, c:3, f:4 },
  { n:'Banán (1 közepes)', kcal:105, p:1.3, c:27, f:0.4 },
  { n:'Fehérje shake (30g)', kcal:120, p:24, c:3, f:1.5 }
];
function renderFood(list){ const box=$('#foodResults'); if(!box) return; box.innerHTML=''; if(!list.length){ box.innerHTML=`<div style="padding:10px;color:var(--muted)">${LANG==='hu'?'Nincs találat.':'No results.'}</div>`; return; }
  list.forEach(item=>{ const row=document.createElement('div'); row.className='result'; row.innerHTML=`<span>${item.n} <small style="opacity:.7">(${item.kcal} kcal • P${item.p}/C${item.c}/F${item.f})</small></span><button>${(LANG==='hu')?'Hozzáad':'Add'}</button>`; row.querySelector('button').addEventListener('click',()=>addMealToDay(activeDayIndex,{name:item.n,kcal:item.kcal})); box.appendChild(row); }); }
function doFoodSearch(){ if (!$('#foodQuery')) return; const q=($('#foodQuery').value||'').toLowerCase().trim(); const res=q?FOOD.filter(x=>x.n.toLowerCase().includes(q)):FOOD; renderFood(res); }
const foodSearchBtn = $('#foodSearch');
if(foodSearchBtn){
    foodSearchBtn.addEventListener('click',doFoodSearch);
    $('#foodQuery').addEventListener('keydown',e=>{ if(e.key==='Enter') doFoodSearch(); });
    doFoodSearch();
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