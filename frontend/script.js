// =================================================
// BIZTONSÁGI ÉS ÁTIRÁNYÍTÁSI RENDSZER (Auth Guard)
// =================================================
(function checkAuth() {
    const token = localStorage.getItem("token");
    const path = window.location.pathname;

    // Ezeket bárki láthatja:
    const publicPages = ['/index.html', '/', '/login.html', '/register.html'];
    
    // Ha a landing.html véletlenül megmaradt volna, azt is idevehetjük
    const isPublic = publicPages.some(p => path.endsWith(p) || path === p);

    // 1. HA NINCS LOGIN, DE VÉDETT OLDALON VAN (pl. dashboard.html)
    if (!token && !isPublic) {
        window.location.href = 'index.html'; // Kirúgjuk a Landingre
        return;
    }

    // 2. HA VAN LOGIN, DE A LANDINGET VAGY LOGINT NÉZI
    if (token && (path.endsWith('index.html') || path === '/' || path.includes('login.html') || path.includes('register.html'))) {
        // Ha nem akarunk nagyon agresszívak lenni, csak a Login/Registerről irányítunk át
        if (path.includes('login') || path.includes('register')) {
             window.location.href = 'dashboard.html';
        }
        // Megjegyzés: A sima index.html-en (Landing) maradhat a user, ha akar,
        // de a "Bejelentkezés" gomb ott majd a dashboardra visz.
    }
})();


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
    hu: { navDiet: 'Étrend', navWorkout: 'Edzésterv', navSignin: 'Bejelentkezés', cta: 'Kezdjük el', homeTitle: 'Edzésterv + Étrend – egyben, egyszerűen.', homeSubtitle: 'Az ATHLION a céljaidhoz igazítja az edzést és az étrendet.', goDiet: '← Étrend kezelő', goWorkout: 'Edzésterv →', dietTitle: 'Étrend kezelő', dietSubtitle: 'Makró-célok, heti terv, bevásárlólista.', macroTitle: 'Makró Célok', calLabel: 'Napi kalória', foodSearchTitle: 'Étel keresése', weeklyDietTitle: 'Heti étrend', bmiTitle: 'BMI / BMR', tipTitle: 'Napi tipp', tipCopy: 'Aludj 7–9 órát. A fejlődés 50%-a a pihenőn múlik.',  workoutTitle: 'Edzésterv-összeállító', workoutSubtitle: 'Fogd-és-vidd gyakorlatsorrend, heti bontás.', weekPlanTitle: 'Heti terv', dMon: 'Hétfő:', dWed: 'Szerda:', dFri: 'Péntek:' },
    en: { navDiet: 'Diet', navWorkout: 'Workout', navSignin: 'Sign in', cta: 'Get Started', homeTitle: 'Training + Diet — together, simply.', homeSubtitle: 'ATHLION adapts training and nutrition to your goals.', goDiet: '← Diet Manager', goWorkout: 'Workout →', dietTitle: 'Diet Manager', dietSubtitle: 'Macro targets, weekly plan, shopping list.', macroTitle: 'Macro goals', calLabel: 'Daily calories', foodSearchTitle: 'Food Search', weeklyDietTitle: 'Weekly diet', bmiTitle: 'BMI / BMR', tipTitle: 'Daily tip', tipCopy: 'Sleep 7–9 hours. Half of progress comes from rest.', qsCopy: 'Pick your goal and generate a plan.', workoutTitle: 'Plan Builder', workoutSubtitle: 'Drag & drop ordering, weekly layout.', weekPlanTitle: 'Weekly plan', dMon: 'Monday:', dWed: 'Wednesday:', dFri: 'Friday:' }
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

    /*// Nyelvváltó gomb
    const langBtn = $('#langToggle');
    if (langBtn) {
        langBtn.textContent = (LANG === 'hu') ? 'Magyar' : 'English';
    }*/
}

/*// Nyelvváltó gomb eseménykezelője
const langToggleBtn = $('#langToggle');
if (langToggleBtn) {
    langToggleBtn.addEventListener('click', () => {
        LANG = (LANG === 'hu') ? 'en' : 'hu';
        t();
        langToggleBtn.blur();
    });
}*/


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

function updateAuthUI() {
    const token = localStorage.getItem("token");
    
    // Elemek lekérése
    const navLogin = document.getElementById("navLogin");
    const navRegister = document.getElementById("navRegister");
    const navLogout = document.getElementById("navLogout");
    const navProfile = document.getElementById("navProfile");

    // 1. A Login/Register gombokat (ha vannak) a token alapján kezeljük
    if (navLogin && navRegister) {
        if (token) {
            navLogin.style.display = "none";
            navRegister.style.display = "none";
        } else {
            navLogin.style.display = "flex";
            navRegister.style.display = "flex";
        }
    }

    // 2. A Profil és Kijelentkezés gombokat MINDIG mutatjuk, ha léteznek
    // (Mivel a Dashboardról már törölted a Login gombokat, ez a legbiztosabb)
    if (navLogout) navLogout.style.display = "flex";
    if (navProfile) navProfile.style.display = "flex";
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

function initDropdown() {
    const btn = document.getElementById('profileDropdownBtn');
    const menu = document.getElementById('profileMenu');

    if (btn && menu) {
        // 1. Gomb kattintás: nyit/zár
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Ne fusson tovább a kattintás a dokumentumra
            menu.classList.toggle('show');
        });

        // 2. Bárhova máshova kattintás: bezár
        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target) && !btn.contains(e.target)) {
                menu.classList.remove('show');
            }
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
 * JAVÍTOTT VERZIÓ: Nem dob ki hálózati hiba esetén!
 */
function fetchUser(token) {
    fetch("/api/v1/auth/users/me", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}` 
        }
    })
    .then(async res => {
        // Ha minden rendben (200 OK)
        if (res.ok) return res.json();

        // Ha a szerver azt mondja: "Nem vagy bejelentkezve" (401) vagy "Nincs jogod" (403)
        if (res.status === 401 || res.status === 403) {
            throw new Error("AUTH_ERROR"); // Speciális hibaüzenet
        }

        // Minden más hiba (pl. 500 szerver hiba, vagy 404) esetén NEM dobunk ki
        // Csak dobunk egy technikai hibát, amit elkapunk, de nem törlünk tokent
        const errData = await res.json().catch(() => ({})); 
        throw new Error(errData.detail || "Server error");
    })
    .then(user => {
        // Sikeres bejelentkezés, üdvözlő szöveg beállítása
        const homeTitle = $('#homeTitle');
        if (homeTitle) {
            homeTitle.textContent = `Üdvözlünk, ${user.user_name || user.email}!`;
        }
        // És a makrók lekérése
        fetchMacros(token);
        
        // Profil név frissítése a menüben is
        const navProfile = document.getElementById('navProfile');
        if(navProfile) {
             const dName = user.user_name || user.email;
             navProfile.textContent = dName.length > 15 ? dName.substring(0, 12) + "..." : dName;
        }
    })
    .catch(err => {
        console.error("Adatlekérési hiba:", err.message);

        // KULCSFONTOSSÁGÚ RÉSZ:
        // Csak akkor töröljük a tokent és dobunk ki, ha TÉNYLEG authentikációs hiba van.
        if (err.message === "AUTH_ERROR") {
            console.warn("A token lejárt vagy érvénytelen -> Kijelentkeztetés.");
            localStorage.removeItem("token");
            updateAuthUI(); 
            window.location.href = 'index.html'; // Csak ekkor irányítunk át
        } else {
            // Ha csak a szerver nem válaszol, vagy nincs net, MARADJUNK bejelentkezve.
            console.log("Hálózati vagy szerver hiba, de a bejelentkezést megtartjuk.");
            // Opcionális: kiírhatsz egy üzenetet, hogy "Offline mód" vagy "Hiba a szerverrel"
        }
    });
}

// =================================================
// 100 NAPI TIPP GYŰJTEMÉNY
// =================================================
const fitnessTips = [
    // --- TÁPLÁLKOZÁS (1-30) ---
    "A fehérje a legfontosabb építőkő. Minden étkezéshez fogyassz egy keveset!",
    "Ne idd meg a kalóriákat! A cukros üdítők helyett válaszd a vizet vagy teát.",
    "A zöldségek nemcsak vitaminok, de rostok is – segítenek, hogy tovább maradj jóllakott.",
    "Az étkezésed 80%-a legyen tápláló, 20%-a pedig élvezet. Ez a fenntarthatóság titka.",
    "Tervezd meg előre a heti menüdet, így elkerülheted a 'farkaséhes vagyok, rendelek valamit' helyzeteket.",
    "Reggelizz úgy, mint egy király! Egy jó reggeli beindítja az anyagcserét.",
    "A szénhidrát nem az ellenséged, csak az időzítés számít. Edzés környékén a legjobb!",
    "Lassíts! Az agyadnak 20 perc kell, mire rájön, hogy tele a gyomrod.",
    "A 'light' vagy 'zsírszegény' termékek gyakran tele vannak cukorral. Mindig olvasd el a címkét!",
    "Nincs tiltott étel, csak mértékletesség.",
    "A fűszerek a barátaid! Kurkuma, gyömbér, fahéj – íz és egészség kalóriák nélkül.",
    "Próbáld ki a szakaszos böjtöt, ha nehezen tartod a kalóriakeretet.",
    "Egyél a szivárvány színeiben! Minél színesebb a tányérod, annál több a vitamin.",
    "Az omega-3 zsírsavak (hal, dió) csökkentik a gyulladást és segítik a regenerációt.",
    "Ne vásárolj éhesen! Ilyenkor hajlamosabb vagy egészségtelen dolgokat venni.",
    "A koffein edzés előtt szuper teljesítményfokozó lehet.",
    "Vacsora után már ne nassolj, hagyd pihenni az emésztőrendszered éjszakára.",
    "A rostbevitel kulcsfontosságú az emésztésednek: zab, bab, lencse!",
    "A házi koszt mindig jobb, mint a gyorséttermi, mert pontosan tudod, mi van benne.",
    "Cseréld a napraforgóolajat olívaolajra vagy kókuszzsírra.",
    "A túró az egyik legjobb esti nasi: lassan felszívódó fehérje (kazein) van benne.",
    "Ha édességre vágysz, egyél gyümölcsöt vagy magas kakaótartalmú étcsokit.",
    "A hidratáltság néha éhségnek álcázza magát. Ha éhes vagy, igyál előbb egy pohár vizet!",
    "A kreatin az egyik legkutatottabb és legbiztonságosabb teljesítményfokozó.",
    "Ne félj a zsíroktól! Az avokádó és a magvak kellenek a hormonrendszerednek.",
    "Kerüld a feldolgozott húsokat (virsli, felvágott), válaszd a friss húst.",
    "A tojás az egyik legtökéletesebb fehérjeforrás a természetben.",
    "Mindig legyen nálad egy egészséges nasi (pl. mandula), ha úton vagy.",
    "A görög joghurt fehérjében gazdagabb, mint a sima joghurt.",
    "Ne egyél a tévé vagy telefon előtt, mert észrevétlenül túleszed magad.",

    // --- HIDRATÁLÁS (31-40) ---
    "Indítsd a napot 3-5 dl vízzel, még a kávé előtt!",
    "Ha sárga a vizeleted, nem ittál eleget. A cél a halványsárga szín.",
    "Edzés közben is pótold a folyadékot, ne várd meg, amíg szomjas leszel.",
    "Tegyél citromot vagy uborkát a vizedbe, ha unod az ízét.",
    "Napi 3-4 liter víz segít pörgetni az anyagcserét és tisztítja a bőrt.",
    "A fejfájás leggyakoribb oka a kiszáradás. Igyál egy nagy pohár vizet!",
    "Étkezés előtt fél órával igyál egy pohár vizet, így kevesebbet fogsz enni.",
    "A zöld tea szuper antioxidáns és enyhén zsírégető hatású.",
    "Kerüld a kalóriadús italokat (kóla, gyümölcslé), ezek 'üres kalóriák'.",
    "Legyen mindig egy kulacs a kezed ügyében, így automatikusan inni fogsz.",

    // --- EDZÉS & MOZGÁS (41-70) ---
    "A legjobb edzésterv az, amit hosszú távon is képes vagy tartani.",
    "Ne hagyd ki a bemelegítést! 5 perc most megspórolhat 5 hét sérülést.",
    "A progresszív túlterhelés a fejlődés kulcsa: emeld a súlyt vagy az ismétlést hétről hétre.",
    "Nem kell minden nap edzeni. A pihenőnapokon nő az izom!",
    "A séta alulértékelt zsírégető módszer. Napi 10.000 lépés csodákat tesz.",
    "A forma fontosabb, mint a súly nagysága. Hanyag technikával csak sérülést építesz.",
    "Találj egy edzőtársat! Ketten nehezebb ellógni az edzést.",
    "Váltogasd az intenzitást! A HIIT edzés rövidebb, de jobban pörgeti az anyagcserét.",
    "A nyújtás edzés után segít megőrizni a mobilitást és csökkenti az izomlázat.",
    "Ne hasonlítsd magad másokhoz a teremben. Mindenki kezdte valahol.",
    "A guggolás és a felhúzás a királygyakorlatok: az egész testet megdolgoztatják.",
    "Hallgass zenét edzés közben! Kutatások szerint növeli a teljesítményt.",
    "Vezess edzésnaplót! Ha nem méred a fejlődést, nem tudsz javítani rajta.",
    "Ha nincs kedved edzeni, csak ígérd meg magadnak, hogy 10 percet csinálsz. Általában ott ragadsz végig.",
    "A saját testsúlyos edzés (fekvőtámasz, húzódzkodás) bárhol elvégezhető és szuperhatékony.",
    "A 'kardió' nemcsak futás lehet. Úszás, biciklizés, ugrálókötél – találd meg, mit élvezel.",
    "Az izomláz nem a fejlődés mércéje. Lehet jó edzésed izomláz nélkül is.",
    "A törzsizom (core) erősítése minden gyakorlatnál segít és védi a derekad.",
    "Használj hengert (SMR henger) edzés előtt vagy után az izmok lazítására.",
    "A lépcsőzés kiváló farizom- és állóképesség-fejlesztő.",
    "Ne félj a nagy súlyoktól! A nők nem lesznek tőle 'túl izmosak', csak tónusosak.",
    "Az edzés a legjobb stresszoldó. Ha rossz napod volt, irány a terem!",
    "Koncentrálj az izom-agy kapcsolatra: érezd, ahogy dolgozik az adott izom.",
    "Változtasd a gyakorlatokat 6-8 hetente, hogy új ingert adj a testednek.",
    "A jó edzőcipő aranyat ér. Védd az ízületeidet!",
    "Ne telefonozz a gépek között! Tartsd a fókuszt és a pihenőidőt.",
    "A plank a egyik legjobb hasizom gyakorlat, és még a tartásodat is javítja.",
    "Reggeli edzés? Sokan esküsznek rá, mert utána egész napra letudták a kötelességet.",
    "Ne hagyd ki a lábnapot! A legnagyobb izomcsoportok ott vannak.",
    "A következetesség többet ér, mint a motiváció. Csináld akkor is, ha nincs kedved.",

    // --- ALVÁS & REGENERÁCIÓ (71-85) ---
    "Az izom az ágyban nő, nem az edzőteremben. Aludj legalább 7-8 órát!",
    "Lefekvés előtt 1 órával tedd le a telefont. A kék fény rontja az alvásminőséget.",
    "A hálószobád legyen hűvös és sötét a legjobb pihenésért.",
    "Próbáld meg minden nap ugyanakkor feküdni és kelni, hétvégén is.",
    "A magnézium lefekvés előtt segíthet ellazítani az izmokat és mélyebben aludni.",
    "A délutáni szieszta ne legyen több 20-30 percnél, különben este nem tudsz aludni.",
    "A hideg zuhany edzés után csökkentheti a gyulladást és frissít.",
    "A masszázs nem luxus, hanem karbantartás a testednek.",
    "Figyelj a tested jelzéseire. Ha fáj (nem izomláz), pihenj vagy kérj segítséget.",
    "A szauna segít a méregtelenítésben és ellazítja az izmokat.",
    "A stressz növeli a kortizolszintet, ami gátolja a zsírégetést. Relaxálj!",
    "Vegyel mély levegőket! A helyes légzés csökkenti a stresszt.",
    "A jóga vagy a nyújtás segít megőrizni a rugalmasságot idős korban is.",
    "Ne eddz betegen! A testednek az energiára a gyógyuláshoz van szüksége.",
    "Az aktív pihenés (séta, kirándulás) jobb, mint az egész napos fekvés.",

    // --- MOTIVÁCIÓ & MINDSET (86-100) ---
    "Ne a fogyásra koncentrálj, hanem az egészségre. A fogyás jönni fog magától.",
    "A mai nap a legjobb nap elkezdeni. Nem holnap, nem hétfőn. Ma.",
    "Légy türelmes magaddal. A változás nem egyik napról a másikra történik.",
    "Ünnepeld meg a kis sikereket is! (De ne kajával.)",
    "A mérleg csak egy szám. A tükör és a ruhaméret jobban mutatja a változást.",
    "Csinálj 'előtte' képeket. Amikor úgy érzed, nem haladsz, ezek adnak erőt.",
    "A kudarc nem a végállomás, hanem a tanulási folyamat része.",
    "Vedd körül magad olyanokkal, akik támogatják a céljaidat.",
    "Nem kell tökéletesnek lenned, csak jobbnak, mint tegnap voltál.",
    "A fegyelem ott kezdődik, ahol a motiváció véget ér.",
    "Tűzz ki reális célokat! A 'fogyok 10 kilót 2 nap alatt' csak csalódáshoz vezet.",
    "Higgy magadban! Ha másnak sikerült, neked is sikerülni fog.",
    "Az egészséges életmód nem büntetés, hanem ajándék a testednek.",
    "Ne másokhoz mérd a sikeredet, hanem a saját korábbi önmagadhoz.",
    "Légy büszke arra, hogy teszel magadért. Sokan el sem kezdik.",
];

// FÜGGVÉNY: Véletlenszerű tipp kiválasztása
function setRandomTip() {
    const tipElement = document.getElementById('dailyTipText');
    if (tipElement) {
        // Véletlenszám generálás 0 és a lista hossza között
        const randomIndex = Math.floor(Math.random() * fitnessTips.length);
        tipElement.textContent = fitnessTips[randomIndex];
    }
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

    // Profil legördülő menü inicializálása
    initDropdown();

    // 4. Ellenőrizzük, be van-e jelentkezve
    const token = localStorage.getItem("token");
    if (token) {
        // Ha igen, lekérjük a felhasználó adatait (ami betölti a makrókat is)
        fetchUser(token);
    }
    //A napi random tipp betöltése
    setRandomTip();
    
    // 5. A diet.js és workout.js saját 'DOMContentLoaded'
    // eseménykezelői itt fognak lefutni, miután ez a közös script lefutott.
});