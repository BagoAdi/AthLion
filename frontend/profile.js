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

/* ---------- MULTISELECT HELPER ---------- */

/**
 * Létrehozza és inicializálja a custom multiselectet.
 * @param {string} wrapperId - .multiselect wrapper id-je (pl. "ms-allergy")
 * @param {string} listContainerId - a listát tartalmazó div id-je (pl. "allergyContainer")
 * @param {Array<object>} dataList - backendből kapott opciók tömbje
 * @param {string} groupKey - rövid kulcs a data-group-hoz ("alg" | "inj" | "cond")
 * @param {Array<number>} selectedIds - már elmentett ID-k
 */
function setupMultiselect(wrapperId, listContainerId, dataList, groupKey, selectedIds) {
    const wrapper = document.getElementById(wrapperId);
    const listEl = document.getElementById(listContainerId);
    if (!wrapper || !listEl) return;

    const header = wrapper.querySelector(".multiselect-header");
    const placeholder = wrapper.querySelector(".ms-placeholder");

    // --- lista renderelése ---
    listEl.innerHTML = "";
    const selectedSet = new Set((selectedIds || []).map(id => Number(id)));

    // Helper: ID + cím kinyerése a backend objektumból
    const getId = (item) => {
        if (item == null || typeof item !== "object") return null;
        if (item.id != null) return Number(item.id);
        if (item.allergen_id != null) return Number(item.allergen_id);
        if (item.injury_id != null) return Number(item.injury_id);
        if (item.condition_id != null) return Number(item.condition_id);
        if (item.value != null) return Number(item.value);
        return null;
    };

    const getLabel = (item) => {
        if (item == null || typeof item !== "object") return "";
        if (typeof item.name === "string") return item.name;
        if (typeof item.label === "string") return item.label;
        if (typeof item.title === "string") return item.title;
        if (typeof item.description === "string") return item.description;

        // fallback: az első string mező az objektumban
        for (const v of Object.values(item)) {
            if (typeof v === "string" && v.trim() !== "") {
                return v;
            }
        }
        return "";
    };

    (dataList || []).forEach(item => {
        const id = getId(item);
        const labelText = getLabel(item);

        if (id == null || labelText === "") return;

        const row = document.createElement("div");
        row.className = "checkbox-item";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = String(id);
        checkbox.dataset.group = groupKey;

        if (selectedSet.has(id)) {
            checkbox.checked = true;
        }

        const label = document.createElement("label");
        label.textContent = labelText;

        row.appendChild(checkbox);
        row.appendChild(label);
        listEl.appendChild(row);

        // sorra kattintás = checkbox toggle
        row.addEventListener("click", (e) => {
            if (e.target === checkbox) return;
            checkbox.checked = !checkbox.checked;
            updatePlaceholder();
        });

        // közvetlen checkbox változáskor is frissítjük a header szövegét
        checkbox.addEventListener("change", updatePlaceholder);
    });

    // --- header szöveg frissítése ---
    function updatePlaceholder() {
        if (!placeholder) return;
        const selected = listEl.querySelectorAll('input[type="checkbox"]:checked');

        if (selected.length === 0) {
            placeholder.textContent = "Válassz...";
            placeholder.classList.remove("has-value");
            return;
        }

        if (selected.length <= 2) {
            const names = Array.from(selected).map(cb => {
                const row = cb.closest(".checkbox-item");
                if (!row) return "";
                const lbl = row.querySelector("label");
                return lbl ? lbl.textContent : "";
            }).filter(Boolean);

            placeholder.textContent = names.join(", ");
        } else {
            placeholder.textContent = `${selected.length} kiválasztva`;
        }
        placeholder.classList.add("has-value");
    }

    // első render után is beállítjuk
    updatePlaceholder();

    // --- lenyitás / bezárás ---
    if (header) {
        header.addEventListener("click", (e) => {
            e.stopPropagation();
            const isActive = wrapper.classList.toggle("active");

            // minden más multiselect bezárása
            if (isActive) {
                document.querySelectorAll(".multiselect").forEach(ms => {
                    if (ms !== wrapper) ms.classList.remove("active");
                });
            }
        });
    }
}

// Globális: ha a multiselecten kívülre kattintunk, zárjuk be mindet
document.addEventListener("click", (e) => {
    if (!e.target.closest(".multiselect")) {
        document.querySelectorAll(".multiselect").forEach(el => el.classList.remove("active"));
    }
});

/* ---------- ADATOK BETÖLTÉSE ---------- */

document.addEventListener("DOMContentLoaded", async () => {
    msg.textContent = "Adatok betöltése.";

    try {
        const optionsPromise = fetch("/api/v1/options/all");
        const userPromise = fetch("/api/v1/users/me", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const profilePromise = fetch("/api/v1/setup/active", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        const [optionsRes, userRes, profileRes] = await Promise.all([
            optionsPromise,
            userPromise,
            profilePromise
        ]);

        if (!optionsRes.ok || !userRes.ok || !profileRes.ok) {
            throw new Error(
                `Hiba az adatok lekérésekor (Status: ${optionsRes.status}, ${userRes.status}, ${profileRes.status})`
            );
        }

        const optionsData = await optionsRes.json();
        const userData = await userRes.json();
        const profileData = await profileRes.json();

        const allAllergens = optionsData.allergies || [];
        const allInjuries = optionsData.injuries || [];
        const allConditions = optionsData.conditions || [];

        // Alap mezők
        userNameInput.value = userData.user_name ?? "";
        heightInput.value = userData.height_cm ?? "";
        startWeightInput.value = profileData.start_weight_kg ?? "";
        targetWeightInput.value = profileData.target_weight_kg ?? "";
        goalTypeInput.value = profileData.goal_type ?? "weight_loss";

        if (profileData.diet_preference) {
            dietPrefInput.value = profileData.diet_preference;
        }
        if (profileData.load_level) {
            loadLevelInput.value = profileData.load_level;
        }

        // Multiselectek feltöltése + inicializálása
        setupMultiselect(
            "ms-allergy",
            "allergyContainer",
            allAllergens,
            "alg",
            profileData.allergy_ids || []
        );
        setupMultiselect(
            "ms-injury",
            "injuryContainer",
            allInjuries,
            "inj",
            profileData.injury_ids || []
        );
        setupMultiselect(
            "ms-condition",
            "conditionContainer",
            allConditions,
            "cond",
            profileData.condition_ids || []
        );

        msg.textContent = "";
    } catch (err) {
        console.error("Részletes hiba:", err);
        msg.style.color = "var(--err)";
        msg.textContent = `❌ Hiba: ${err.message}`;
    }
});

/* ---------- MENTÉS ---------- */

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.style.color = "var(--muted)";
    msg.textContent = "Mentés folyamatban.";

    const allergyIds = Array.from(
        document.querySelectorAll('input[data-group="alg"]:checked')
    ).map(cb => parseInt(cb.value, 10));

    const injuryIds = Array.from(
        document.querySelectorAll('input[data-group="inj"]:checked')
    ).map(cb => parseInt(cb.value, 10));

    const conditionIds = Array.from(
        document.querySelectorAll('input[data-group="cond"]:checked')
    ).map(cb => parseInt(cb.value, 10));

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
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(userPayload)
            }),
            fetch("/api/v1/setup/active", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
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
        console.error("Mentési hiba:", err);
        msg.style.color = "var(--err)";
        msg.textContent = "❌ Mentési hiba";
    }
});
