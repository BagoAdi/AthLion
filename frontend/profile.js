const form = document.getElementById("profileForm");
const msg = document.getElementById("msg");
const token = localStorage.getItem("token");

// Inputok
const userNameInput = document.getElementById("user_name");
const heightInput = document.getElementById("height_cm");
const startWeightInput = document.getElementById("start_weight_kg");
const targetWeightInput = document.getElementById("target_weight_kg");
const goalTypeInput = document.getElementById("goal_type");
const loadLevelInput = document.getElementById("load_level");
const dietPrefInput = document.getElementById("diet_preference");

if (!token) {
    window.location.href = "login.html";
}

// --- MULTISELECT FUNKCIÓK ---

function setupMultiselect(elementId) {
    const wrapper = document.getElementById(elementId);
    if (!wrapper) return; // Ha nem találja az elemet, ne omoljon össze

    const header = wrapper.querySelector('.multiselect-header');
    const list = wrapper.querySelector('.multiselect-list');
    
    // FONTOS: Itt a querySelectorAll-t használjuk, ami támogatja a forEach-et
    const items = wrapper.querySelectorAll('.checkbox-item'); 

    // Fejléc kattintás (lenyitás/bezárás)
    header.addEventListener('click', (e) => {
        e.stopPropagation(); // Megakadályozza, hogy azonnal bezáródjon
        wrapper.classList.toggle('active');
        
        // Másik megnyitott bezárása (opcionális UX javítás)
        document.querySelectorAll('.multiselect').forEach(ms => {
            if (ms !== wrapper) ms.classList.remove('active');
        });
    });

    // Elemek kezelése - ITT VOLT A HIBA
    // Ha a querySelectorAll-t használod fent, akkor ez működni fog.
    // Ha nem, akkor használd az Array.from(items).forEach(...) formát.
    items.forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        
        // Ha a sorra kattintunk, váltson a checkbox is
        item.addEventListener('click', (e) => {
            // Ha közvetlenül a checkboxra kattintott, ne csináljunk semmit (az alapból vált)
            if (e.target === checkbox) return;
            
            checkbox.checked = !checkbox.checked;
            // Opcionális: trigger event, ha kell frissítés
            // updateSelectedText(wrapper); 
        });
    });
}

// Bezárás, ha kívülre kattintunk
document.addEventListener('click', (e) => {
    if (!e.target.closest('.multiselect')) {
        document.querySelectorAll('.multiselect').forEach(el => el.classList.remove('active'));
    }
});

// --- ADATOK BETÖLTÉSE ---

document.addEventListener("DOMContentLoaded", async () => {
    msg.textContent = "Adatok betöltése...";
    
    try {
        // 1. JAVÍTÁS: Egyetlen kérés a közös végpontra
        const optionsPromise = fetch("/api/v1/options/all");

        // 2. Felhasználó adatainak lekérése (párhuzamosan mehet az előzővel)
        const userPromise = fetch("/api/v1/users/me", { headers: { "Authorization": `Bearer ${token}` } });
        const profilePromise = fetch("/api/v1/setup/active", { headers: { "Authorization": `Bearer ${token}` } });

        // Megvárjuk mindhárom választ
        const [optionsRes, userRes, profileRes] = await Promise.all([
            optionsPromise, 
            userPromise, 
            profilePromise
        ]);

        if (!optionsRes.ok || !userRes.ok || !profileRes.ok) {
            throw new Error(`Hiba az adatok lekérésekor (Status: ${optionsRes.status}, ${userRes.status}, ${profileRes.status})`);
        }

        // JSON feldolgozása
        const optionsData = await optionsRes.json();
        const userData = await userRes.json();
        const profileData = await profileRes.json();

    

        // JAVÍTÁS: Az opciók szétválogatása a közös válaszból
        const allAllergens = optionsData.allergies || [];
        const allInjuries = optionsData.injuries || [];
        const allConditions = optionsData.conditions || [];

        // 3. Mezők kitöltése (Változatlan)
        userNameInput.value = userData.user_name;
        heightInput.value = userData.height_cm;
        startWeightInput.value = profileData.start_weight_kg;
        targetWeightInput.value = profileData.target_weight_kg;
        goalTypeInput.value = profileData.goal_type;
        
        if (profileData.diet_preference) {
            dietPrefInput.value = profileData.diet_preference;
        }  
        loadLevelInput.value = profileData.load_level;

        // 4. Multiselectek inicializálása
        setupMultiselect("ms-allergy", "allergyContainer", allAllergens, "alg", profileData.allergy_ids || []);
        setupMultiselect("ms-injury", "injuryContainer", allInjuries, "inj", profileData.injury_ids || []);
        setupMultiselect("ms-condition", "conditionContainer", allConditions, "cond", profileData.condition_ids || []);

        msg.textContent = "";

    } catch (err) {
        msg.style.color = "var(--err)";
        msg.textContent = `❌ Hiba: ${err.message}`;
        console.error("Részletes hiba:", err);
    }
});

// --- MENTÉS ---

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.style.color = "var(--muted)";
    msg.textContent = "Mentés folyamatban...";

    // Checkbox ID-k gyűjtése
    const allergyIds = Array.from(document.querySelectorAll('input[data-group="alg"]:checked')).map(cb => parseInt(cb.value));
    const injuryIds = Array.from(document.querySelectorAll('input[data-group="inj"]:checked')).map(cb => parseInt(cb.value));
    const conditionIds = Array.from(document.querySelectorAll('input[data-group="cond"]:checked')).map(cb => parseInt(cb.value));

    const userPayload = {
        user_name: userNameInput.value,
        height_cm: parseFloat(heightInput.value)
    };
    
    const profilePayload = {
        start_weight_kg: parseFloat(startWeightInput.value),
        goal_type: goalTypeInput.value,
        target_weight_kg: parseFloat(targetWeightInput.value),
        load_level: loadLevelInput.value,
        diet_preference: dietPrefInput.value,
        allergy_ids: allergyIds,
        injury_ids: injuryIds,
        condition_ids: conditionIds
    };

    try {
        await Promise.all([
            fetch("/api/v1/users/me", {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify(userPayload)
            }),
            fetch("/api/v1/setup/active", {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify(profilePayload)
            })
        ]);

        msg.style.color = "var(--ok)";
        msg.textContent = "✅ Sikeres mentés!";
        localStorage.setItem("user_name", userNameInput.value);

        setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 1200);

    } catch (err) {
        msg.style.color = "var(--err)";
        msg.textContent = "❌ Mentési hiba";
    }
});