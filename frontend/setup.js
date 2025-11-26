const form = document.getElementById("setupForm");
const msg = document.getElementById("msg");
const token = localStorage.getItem("token");

// Ha nincs token, vissza a loginra
if (!token) {
    window.location.href = "login.html";
}

// --- 1. MULTISELECT LOGIKA (Lenyíló lista kezelése) ---
// Ez a rész változatlan marad, kezeli a lenyíló listákat
function setupMultiselect(wrapperId, containerId, items, namePrefix) {
    const wrapper = document.getElementById(wrapperId);
    const header = wrapper.querySelector(".multiselect-header");
    const placeholderSpan = header.querySelector(".ms-placeholder");
    const container = document.getElementById(containerId);

    // Lista generálása
    container.innerHTML = "";
    if (!items || items.length === 0) {
        container.innerHTML = '<div style="padding:10px;font-size:13px;color:var(--muted)">Nincs elérhető adat.</div>';
    } else {
        items.forEach(item => {
            const div = document.createElement("div");
            div.className = "checkbox-item";
            
            // Ha a sorra kattintasz, akkor is pipálódjon be
            div.onclick = (e) => {
                if (e.target.tagName !== 'INPUT') {
                    const cb = div.querySelector('input');
                    cb.checked = !cb.checked;
                    updatePlaceholder();
                }
            };

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.value = item.id; 
            cb.dataset.group = namePrefix; 
            cb.onchange = updatePlaceholder;

            const label = document.createElement("span");
            label.textContent = item.name || item.label; 

            div.appendChild(cb);
            div.appendChild(label);
            container.appendChild(div);
        });
    }

    // Fejléc frissítése (pl. "3 kiválasztva")
    function updatePlaceholder() {
        const checkedCount = container.querySelectorAll('input:checked').length;
        if (checkedCount === 0) {
            placeholderSpan.textContent = "Válassz...";
            placeholderSpan.style.color = "var(--muted)";
        } else {
            placeholderSpan.textContent = `${checkedCount} kiválasztva`;
            placeholderSpan.style.color = "var(--text)";
        }
    }

    // Lenytás / Bezárás
    header.addEventListener("click", () => {
        wrapper.classList.toggle("active");
    });
}

// --- 2. ADATOK BETÖLTÉSE (Opciók) ---
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const res = await fetch("/api/v1/options/all");
        if (!res.ok) throw new Error("Nem sikerült betölteni az opciókat");
        
        const data = await res.json();
        
        // Multiselectek inicializálása
        setupMultiselect("ms-allergy", "allergyContainer", data.allergies, "alg");
        setupMultiselect("ms-injury", "injuryContainer", data.injuries, "inj");
        setupMultiselect("ms-condition", "conditionContainer", data.conditions, "cond");

    } catch (err) {
        console.error(err);
        msg.textContent = "Hiba az opciók betöltésekor.";
    }
});

// --- 3. ŰRLAP BEKÜLDÉSE (A FRISSÍTETT RÉSZ) ---
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "Mentés...";
    msg.style.color = "var(--text)";

    // --- ÚJ MEZŐK KIOLVASÁSA ---
    const birthDate = document.getElementById('birth_date').value;
    const gender = document.getElementById('gender').value;
    const heightVal = parseFloat(document.getElementById('height').value);

    // --- RÉGI MEZŐK KIOLVASÁSA ---
    const start_weight_kg = parseFloat(document.getElementById("start_weight").value);
    const target_weight_kg = parseFloat(document.getElementById("target_weight").value);
    const goal_type = document.getElementById("goal_type").value;
    const load_level = document.getElementById("load_level").value;
    const program_time = document.getElementById("program_time").value;
    const preference = document.getElementById("preference").value;

    // Checkbox listák összegyűjtése
    const allergyIds = Array.from(document.querySelectorAll('input[data-group="alg"]:checked')).map(cb => parseInt(cb.value));
    const injuryIds = Array.from(document.querySelectorAll('input[data-group="inj"]:checked')).map(cb => parseInt(cb.value));
    const conditionIds = Array.from(document.querySelectorAll('input[data-group="cond"]:checked')).map(cb => parseInt(cb.value));

    // Validáció az új mezőkre
    if (!birthDate || !gender || isNaN(heightVal)) {
        msg.textContent = "Kérlek töltsd ki a születési dátumot, nemet és magasságot!";
        msg.style.color = "var(--danger)";
        return;
    }

    // --- PAYLOAD ÖSSZEÁLLÍTÁSA ---
    const payload = {
        // 1. Az új személyes adatok (amiket a backend most már vár)
        birth_date: birthDate,
        gender: gender,
        height: heightVal,

        // 2. A fizikai és cél adatok
        start_weight_kg, 
        target_weight_kg, 
        goal_type,
        diet_preference: document.getElementById('diet_preference').value,
        load_level, 
        program_time, 
        preference,
        
        // 3. Listák
        allergy_ids: allergyIds,
        injury_ids: injuryIds,
        condition_ids: conditionIds,
        medication_ids: [] // Ezt egyelőre üresen hagyjuk, ha nincs a UI-n
    };

    try {
        const res = await fetch("/api/v1/setup/initial", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || "Mentési hiba");
        }

        msg.style.color = "var(--accent)"; // Zöld visszajelzés
        msg.textContent = "✅ Mentés sikeres! Átirányítás...";
        
        // Helyi tároló frissítése (opcionális, ha használod valahol)
        localStorage.setItem("athlion_load_level", load_level);

        // Késleltetett átirányítás a főoldalra
        setTimeout(() => {
            window.location.href = "dashboard.html"; 
        }, 1500);

    } catch (err) {
        console.error(err);
        msg.style.color = "var(--danger)";
        msg.textContent = "Hiba: " + err.message;
    }
});