const form = document.getElementById("setupForm");
const msg = document.getElementById("msg");

// Először ellenőrizzük, hogy a felhasználó be van-e jelentkezve.
const token = localStorage.getItem("token");
if (!token) {
    // Ha valaki token nélkül téved ide, küldjük a loginra.
    window.location.href = "login.html";
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.style.color = "var(--muted)";
    msg.textContent = "Beállítások mentése folyamatban...";

    // 1. Adatok gyűjtése az űrlapról
    const start_weight_kg = parseFloat(document.getElementById("start_weight_kg").value);
    const target_weight_kg = parseFloat(document.getElementById("target_weight_kg").value);
    const goal_type = document.getElementById("goal_type").value;
    const load_level = document.getElementById("load_level").value;
    const program_time = document.getElementById("program_time").value;
    const preference = document.getElementById("preference").value;
    const allergyContainer = document.getElementById("allergy_container");
    const injuryContainer = document.getElementById("injury_container");
    const conditionContainer = document.getElementById("condition_container");

    // Segédfüggvény checkboxok generálásához
function renderCheckboxes(container, items, namePrefix) {
    container.innerHTML = "";
    if (items.length === 0) {
        container.innerHTML = '<p class="small muted">Nincs adat.</p>';
        return;
    }
    items.forEach(item => {
        const div = document.createElement("div");
        div.className = "checkbox-item";
        div.innerHTML = `
            <input type="checkbox" id="${namePrefix}_${item.id}" value="${item.id}" data-group="${namePrefix}">
            <label for="${namePrefix}_${item.id}">${item.name}</label>
        `;
        container.appendChild(div);
    });
}
// Betöltés induláskor
document.addEventListener("DOMContentLoaded", async () => {
    if (!token) return; // Már van redirect

    try {
        // Opciók párhuzamos lekérése
        const [resAlg, resInj, resCond] = await Promise.all([
            fetch("/api/v1/options/allergens"),
            fetch("/api/v1/options/injuries"),
            fetch("/api/v1/options/conditions")
        ]);

        const allergens = await resAlg.json();
        const injuries = await resInj.json();
        const conditions = await resCond.json();

        renderCheckboxes(allergyContainer, allergens, "alg");
        renderCheckboxes(injuryContainer, injuries, "inj");
        renderCheckboxes(conditionContainer, conditions, "cond");

    } catch (err) {
        console.error("Nem sikerült betölteni az opciókat", err);
    }
});


form.addEventListener("submit", async (e) => {
    e.preventDefault();
    // ... (meglévő validáció) ...

    // Új: Checkboxok összegyűjtése
    const allergyIds = Array.from(document.querySelectorAll('input[data-group="alg"]:checked')).map(cb => parseInt(cb.value));
    const injuryIds = Array.from(document.querySelectorAll('input[data-group="inj"]:checked')).map(cb => parseInt(cb.value));
    const conditionIds = Array.from(document.querySelectorAll('input[data-group="cond"]:checked')).map(cb => parseInt(cb.value));

    // ... (fetch hívás változatlan, mert a payload bővült) ...
});

    if (!start_weight_kg || !target_weight_kg || !goal_type || !load_level || !program_time || !preference) {
        msg.style.color = "var(--err)";
        msg.textContent = "❌ Minden mező kitöltése kötelező.";
        return;
    }

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
        medication_ids: [] // Ezt most kihagytuk, de hasonlóan működne
    };

    try {
        // 2. Adatok küldése az új API végpontra
        const res = await fetch("/api/v1/setup/initial", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // A tokent elküldjük, hogy a backend tudja, ki vagyunk
                "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify(payload)
        });

        const ct = res.headers.get("content-type") || "";
        const resPayload = ct.includes("application/json") ? await res.json() : { detail: await res.text() };

        if (!res.ok) {
            throw new Error(resPayload.detail || `HTTP ${res.status} hiba`);
        }

        // 3. Siker!
        msg.style.color = "var(--ok)";
        msg.textContent = "✅ Beállítások elmentve! Átirányítás a főoldalra...";
        
        try {
            localStorage.setItem("athlion_load_level", load_level);
        } catch (e) {
            console.warn("Nem sikerült elmenteni a load_levelt localStorage-be:", e);
        }

        // Várunk picit, hogy a felhasználó lássa az üzenetet, majd átirányítjuk
        setTimeout(() => {
            window.location.href = "index.html";
        }, 1500);

    } catch (err) {
        msg.style.color = "var(--err)";
        msg.textContent = "❌ " + err.message;
    }
});



