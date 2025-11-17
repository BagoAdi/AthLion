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

    if (!start_weight_kg || !target_weight_kg || !goal_type || !load_level) {
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
        preference
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