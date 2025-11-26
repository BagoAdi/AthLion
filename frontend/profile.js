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

// --- MULTISELECT LOGIKA (Ugyanaz mint setup.js-ben) ---

function setupMultiselect(wrapperId, containerId, items, namePrefix, selectedIds = []) {
    const wrapper = document.getElementById(wrapperId);
    const header = wrapper.querySelector(".multiselect-header");
    const placeholderSpan = header.querySelector(".ms-placeholder");
    const container = document.getElementById(containerId);

    // Lista generálása
    container.innerHTML = "";
    if (!items || items.length === 0) {
        container.innerHTML = '<div style="padding:10px;font-size:13px;color:var(--muted)">Nincs adat.</div>';
    } else {
        items.forEach(item => {
            const isChecked = selectedIds.includes(item.id) ? 'checked' : '';
            const div = document.createElement("div");
            div.className = "checkbox-item";
            
            div.onclick = (e) => {
                if (e.target.tagName !== 'INPUT') {
                    const cb = div.querySelector('input');
                    cb.checked = !cb.checked;
                    cb.dispatchEvent(new Event('change'));
                }
            };

            div.innerHTML = `
                <input type="checkbox" id="${namePrefix}_${item.id}" value="${item.id}" data-group="${namePrefix}" ${isChecked}>
                <label for="${namePrefix}_${item.id}">${item.name}</label>
            `;
            container.appendChild(div);
        });
    }

    header.addEventListener("click", () => {
        wrapper.classList.toggle("active");
    });

    const checkboxes = container.querySelectorAll(`input[type="checkbox"]`);
    
    const updateHeader = () => {
        const checked = Array.from(checkboxes).filter(c => c.checked);
        if (checked.length === 0) {
            placeholderSpan.textContent = "Válassz...";
            placeholderSpan.classList.remove("has-value");
        } else {
            const names = checked.map(c => c.nextElementSibling.textContent);
            placeholderSpan.textContent = names.join(", ");
            placeholderSpan.classList.add("has-value");
        }
    };

    // Kezdéskor is le kell futtatni, hogy a bepipáltak látsszanak a fejlécben
    updateHeader();

    checkboxes.forEach(cb => cb.addEventListener("change", updateHeader));

    document.addEventListener("click", (e) => {
        if (!wrapper.contains(e.target)) {
            wrapper.classList.remove("active");
        }
    });
}

// --- ADATOK BETÖLTÉSE ---

document.addEventListener("DOMContentLoaded", async () => {
    msg.textContent = "Adatok betöltése...";
    
    try {
        // 1. Opciók lekérése
        const [resAlg, resInj, resCond] = await Promise.all([
            fetch("/api/v1/options/allergens"),
            fetch("/api/v1/options/injuries"),
            fetch("/api/v1/options/conditions")
        ]);
        const allAllergens = await resAlg.json();
        const allInjuries = await resInj.json();
        const allConditions = await resCond.json();

        // 2. Felhasználó adatainak lekérése
        const [userRes, profileRes] = await Promise.all([
            fetch("/api/v1/users/me", { headers: { "Authorization": `Bearer ${token}` } }),
            fetch("/api/v1/setup/active", { headers: { "Authorization": `Bearer ${token}` } })
        ]);

        if (!userRes.ok || !profileRes.ok) throw new Error("Hiba az adatok lekérésekor");

        const userData = await userRes.json();
        const profileData = await profileRes.json();

        // 3. Mezők kitöltése
        userNameInput.value = userData.user_name;
        heightInput.value = userData.height_cm;
        startWeightInput.value = profileData.start_weight_kg;
        targetWeightInput.value = profileData.target_weight_kg;
        goalTypeInput.value = profileData.goal_type;
        if(profileData.diet_preference) {
            dietPrefInput.value = profileData.diet_preference;
        }  
        loadLevelInput.value = profileData.load_level;

        // 4. Multiselectek inicializálása a kiválasztott ID-kkal
        // A profileData most már tartalmazza az ID listákat (pl. allergy_ids: [1, 3])
        setupMultiselect("ms-allergy", "allergyContainer", allAllergens, "alg", profileData.allergy_ids || []);
        setupMultiselect("ms-injury", "injuryContainer", allInjuries, "inj", profileData.injury_ids || []);
        setupMultiselect("ms-condition", "conditionContainer", allConditions, "cond", profileData.condition_ids || []);

        msg.textContent = "";

    } catch (err) {
        msg.style.color = "var(--err)";
        msg.textContent = `❌ Hiba: ${err.message}`;
        console.error(err);
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