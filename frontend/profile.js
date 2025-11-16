// frontend/profile.js
const form = document.getElementById("profileForm");
const msg = document.getElementById("msg");
const token = localStorage.getItem("token");

// Input mezők
const userNameInput = document.getElementById("user_name");
const heightInput = document.getElementById("height_cm");
const startWeightInput = document.getElementById("start_weight_kg");
const targetWeightInput = document.getElementById("target_weight_kg");
const goalTypeInput = document.getElementById("goal_type");
const loadLevelInput = document.getElementById("load_level");

/**
 * 1. ADATOK BETÖLTÉSE
 * Az oldal betöltődésekor lekérjük a jelenlegi beállításokat.
 */
document.addEventListener("DOMContentLoaded", async () => {
    if (!token) {
        // Ha valaki token nélkül téved ide, küldjük a loginra.
        window.location.href = "login.html";
        return;
    }

    msg.textContent = "Adatok betöltése...";
    
    try {
        // Párhuzamosan lekérjük a két végpontot
        const [userRes, profileRes] = await Promise.all([
            fetch("/api/v1/users/me", {
                headers: { "Authorization": `Bearer ${token}` }
            }),
            fetch("/api/v1/setup/active", {
                headers: { "Authorization": `Bearer ${token}` }
            })
        ]);

        if (!userRes.ok || !profileRes.ok) {
            const userErr = !userRes.ok ? await userRes.text() : "";
            const profileErr = !profileRes.ok ? await profileRes.text() : "";
            throw new Error(`Hiba a profiladatok lekérése közben. User: ${userErr} Profile: ${profileErr}`);
        }

        const userData = await userRes.json();
        const profileData = await profileRes.json();

        // Űrlap feltöltése a kapott adatokkal
        userNameInput.value = userData.user_name;
        heightInput.value = userData.height_cm;
        
        startWeightInput.value = profileData.start_weight_kg;
        targetWeightInput.value = profileData.target_weight_kg;
        
        // Ez most már a <select> mezőket tölti fel
        goalTypeInput.value = profileData.goal_type;
        loadLevelInput.value = profileData.load_level;

        msg.textContent = ""; // Betöltés kész, üzenet törlése

    } catch (err) {
        msg.style.color = "var(--err)";
        msg.textContent = `❌ Hiba a betöltéskor: ${err.message}`;
    }
});

/**
 * 2. ADATOK MENTÉSE
 * A gombra kattintáskor elküldjük a frissített adatokat.
 */
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.style.color = "var(--muted)";
    msg.textContent = "Mentés folyamatban...";

    // 1. Adatok gyűjtése az űrlapról
    const userName = userNameInput.value;
    const height = parseFloat(heightInput.value);
    const startWeight = parseFloat(startWeightInput.value);
    const targetWeight = parseFloat(targetWeightInput.value);
    const goalType = goalTypeInput.value;
    const loadLevel = loadLevelInput.value;

    // 2. Validálás (minden új mezővel)
    if (!userName || !height || !startWeight || !targetWeight || !goalType || !loadLevel) {
        msg.style.color = "var(--err)";
        msg.textContent = "❌ Minden mező kitöltése kötelező.";
        return;
    }

    // 3. Két külön payload összeállítása
    const userPayload = {
        user_name: userName,
        height_cm: height
    };
    
    const profilePayload = {
        start_weight_kg: startWeight,
        goal_type: goalType,
        target_weight_kg: targetWeight,
        load_level: loadLevel
    };

    try {
        // 4. Párhuzamosan elküldjük a két PUT kérést
        const [userRes, profileRes] = await Promise.all([
            // a /users/me végpont frissítése
            fetch("/api/v1/users/me", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}` 
                },
                body: JSON.stringify(userPayload)
            }),
            // a /setup/active végpont frissítése
            fetch("/api/v1/setup/active", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}` 
                },
                body: JSON.stringify(profilePayload)
            })
        ]);

        if (!userRes.ok || !profileRes.ok) {
            throw new Error("Hiba a mentés során. Lehet, hogy az egyik végpont hibás.");
        }

        // 5. Siker!
        msg.style.color = "var(--ok)";
        msg.textContent = "✅ Beállítások elmentve! Átirányítás a főoldalra...";
        
        // Frissítjük a localStorage-ban tárolt nevet
        localStorage.setItem("user_name", userName);

        // Ahelyett, hogy eltüntetnénk az üzenetet,
        // várunk 1.5 másodpercet, majd átirányítunk.
        setTimeout(() => {
            window.location.href = "index.html";
        }, 1500);

    } catch (err) {
        msg.style.color = "var(--err)";
        msg.textContent = "❌ " + err.message;
    }
});