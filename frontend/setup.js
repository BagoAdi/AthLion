const form = document.getElementById("setupForm");
const msg = document.getElementById("msg");
const token = localStorage.getItem("token");

// Ha nincs token, vissza a loginra
if (!token) {
    window.location.href = "login.html";
}

// --- 1. MULTISELECT LOGIKA (Lenyíló lista kezelése) ---

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
            
            // Ez a trükk: ha a sorra kattintasz, akkor is pipálódjon be
            div.onclick = (e) => {
                if (e.target.tagName !== 'INPUT') {
                    const cb = div.querySelector('input');
                    cb.checked = !cb.checked;
                    // Manuálisan jelezzük a változást, hogy a fejléc frissüljön
                    cb.dispatchEvent(new Event('change'));
                }
            };

            div.innerHTML = `
                <input type="checkbox" id="${namePrefix}_${item.id}" value="${item.id}" data-group="${namePrefix}">
                <label for="${namePrefix}_${item.id}">${item.name}</label>
            `;
            container.appendChild(div);
        });
    }

    // Lenyitás / Becsukás kattintásra
    header.addEventListener("click", () => {
        // Ha már nyitva van, bezárjuk, ha nincs, kinyitjuk
        wrapper.classList.toggle("active");
    });

    // Kijelölés figyelése -> Fejléc szöveg frissítése
    const checkboxes = container.querySelectorAll(`input[type="checkbox"]`);
    
    const updateHeader = () => {
        const checked = Array.from(checkboxes).filter(c => c.checked);
        if (checked.length === 0) {
            placeholderSpan.textContent = "Válassz a listából...";
            placeholderSpan.classList.remove("has-value");
        } else {
            // Összegyűjtjük a neveket (pl. "Tej, Glutén")
            const names = checked.map(c => c.nextElementSibling.textContent);
            placeholderSpan.textContent = names.join(", ");
            placeholderSpan.classList.add("has-value");
        }
    };

    checkboxes.forEach(cb => cb.addEventListener("change", updateHeader));

    // Kattintás kívülre -> bezárjuk a listát
    document.addEventListener("click", (e) => {
        if (!wrapper.contains(e.target)) {
            wrapper.classList.remove("active");
        }
    });
}


// --- 2. ADATOK BETÖLTÉSE (Oldal betöltésekor) ---

document.addEventListener("DOMContentLoaded", async () => {
    try {
        // Párhuzamosan lekérjük az opciókat
        const [resAlg, resInj, resCond] = await Promise.all([
            fetch("/api/v1/options/allergens"),
            fetch("/api/v1/options/injuries"),
            fetch("/api/v1/options/conditions")
        ]);

        const allergens = await resAlg.json();
        const injuries = await resInj.json();
        const conditions = await resCond.json();

        // Inicializáljuk a 3 lenyíló listát
        setupMultiselect("ms-allergy", "allergyContainer", allergens, "alg");
        setupMultiselect("ms-injury", "injuryContainer", injuries, "inj");
        setupMultiselect("ms-condition", "conditionContainer", conditions, "cond");

    } catch (err) {
        console.error("Hiba az adatok betöltésekor:", err);
        // Ha hiba van, a "Válassz..." helyett jelezzük
        document.querySelectorAll(".ms-placeholder").forEach(el => el.textContent = "Hiba a betöltéskor");
    }
});


// --- 3. ŰRLAP KÜLDÉSE (Mentés gomb) ---

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.style.color = "var(--muted)";
    msg.textContent = "Mentés folyamatban...";

    const start_weight_kg = parseFloat(document.getElementById("start_weight_kg").value);
    const target_weight_kg = parseFloat(document.getElementById("target_weight_kg").value);
    const goal_type = document.getElementById("goal_type").value;
    const load_level = document.getElementById("load_level").value;
    
    // A rejtett mezők
    const program_time = document.getElementById("program_time")?.value || "30-45 perc"; 
    const preference = document.getElementById("preference")?.value || "Vegyes";

    if (!start_weight_kg || !target_weight_kg || !goal_type || !load_level) {
        msg.style.color = "var(--err)";
        msg.textContent = "❌ Minden mező kitöltése kötelező.";
        return;
    }

    // ID-k összegyűjtése a pipák alapján
    const allergyIds = Array.from(document.querySelectorAll('input[data-group="alg"]:checked')).map(cb => parseInt(cb.value));
    const injuryIds = Array.from(document.querySelectorAll('input[data-group="inj"]:checked')).map(cb => parseInt(cb.value));
    const conditionIds = Array.from(document.querySelectorAll('input[data-group="cond"]:checked')).map(cb => parseInt(cb.value));

    const payload = {
        start_weight_kg, 
        target_weight_kg, 
        goal_type, 
        load_level, 
        program_time, 
        preference,
        allergy_ids: allergyIds,
        injury_ids: injuryIds,
        condition_ids: conditionIds,
        medication_ids: [] // Ezt egyelőre üresen hagyjuk
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

        msg.style.color = "var(--ok)";
        msg.textContent = "✅ Mentés sikeres! Átirányítás...";
        
        // Helyi tároló frissítése
        localStorage.setItem("athlion_load_level", load_level);
        
        setTimeout(() => {
            window.location.href = "index.html";
        }, 1500);

    } catch (err) {
        msg.style.color = "var(--err)";
        msg.textContent = "❌ " + err.message;
    }
});