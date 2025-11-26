// frontend/setup.js

const token = localStorage.getItem("token");
if (!token) window.location.href = "login.html";

// --- STATE MANAGEMENT ---
let currentStep = 1;
const totalSteps = 4;

// DOM elemek
const steps = document.querySelectorAll('.step');
const progressBar = document.getElementById('progressBar');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');
const msg = document.getElementById('msg');
const form = document.getElementById('setupForm');

// --- 0. SZÜLETÉSNAP LOGIKA (ÚJ) ---
function setupBirthdayPicker() {
    const yearSelect = document.getElementById("dob_year");
    const monthSelect = document.getElementById("dob_month");
    const daySelect = document.getElementById("dob_day");

    const months = [
        "Január", "Február", "Március", "Április", "Május", "Június",
        "Július", "Augusztus", "Szeptember", "Október", "November", "December"
    ];

    // 1. Évek feltöltése (Jelenlegi évtől vissza 100 évig)
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 10; i >= currentYear - 100; i--) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = i;
        yearSelect.appendChild(opt);
    }

    // 2. Hónapok feltöltése
    months.forEach((m, index) => {
        const opt = document.createElement("option");
        opt.value = index + 1; // 1 = Január
        opt.textContent = m;
        monthSelect.appendChild(opt);
    });

    // 3. Napok frissítése (hónaptól függően)
    function updateDays() {
        const year = parseInt(yearSelect.value);
        const month = parseInt(monthSelect.value);
        const currentDay = parseInt(daySelect.value);
        
        // Ha nincs kiválasztva év/hónap, alapból 31 nap
        if (!year || !month) return;

        // Hány nap van az adott hónapban? (A "0" a következő hónap nulladik napja = előző hó utolsó napja)
        const daysInMonth = new Date(year, month, 0).getDate();

        // Lista ürítése (kivéve az első "Nap" opciót)
        daySelect.innerHTML = '<option value="" disabled selected>Nap</option>';

        for (let i = 1; i <= daysInMonth; i++) {
            const opt = document.createElement("option");
            opt.value = i;
            opt.textContent = i;
            if (i === currentDay) opt.selected = true; // Megőrizzük a választást, ha lehet
            daySelect.appendChild(opt);
        }
    }

    yearSelect.addEventListener("change", updateDays);
    monthSelect.addEventListener("change", updateDays);
    
    // Kezdeti feltöltés (31 nappal)
    for (let i = 1; i <= 31; i++) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = i;
        daySelect.appendChild(opt);
    }
}

// --- 1. MULTISELECT LOGIKA (Változatlan, csak a betöltésnél használjuk) ---
function setupMultiselect(wrapperId, containerId, items, namePrefix) {
    const wrapper = document.getElementById(wrapperId);
    const header = wrapper.querySelector(".multiselect-header");
    const placeholderSpan = header.querySelector(".ms-placeholder");
    const container = document.getElementById(containerId);

    container.innerHTML = "";
    if (!items || items.length === 0) {
        container.innerHTML = '<div style="padding:10px;font-size:13px;color:var(--muted)">Nincs adat.</div>';
    } else {
        items.forEach(item => {
            const div = document.createElement("div");
            div.className = "checkbox-item";
            div.onclick = (e) => {
                if (e.target.tagName !== 'INPUT') {
                    const cb = div.querySelector('input');
                    cb.checked = !cb.checked;
                    updateHeader();
                }
            };

            div.innerHTML = `
                <input type="checkbox" id="${namePrefix}_${item.id}" value="${item.id}" data-group="${namePrefix}">
                <label for="${namePrefix}_${item.id}">${item.name}</label>
            `;
            container.appendChild(div);
            // Figyeljük a változást a header frissítéséhez
            div.querySelector('input').addEventListener('change', updateHeader);
        });
    }

    // Header frissítése
    function updateHeader() {
        const checkedCount = container.querySelectorAll('input:checked').length;
        placeholderSpan.textContent = checkedCount === 0 ? "Nincs / Válassz..." : `${checkedCount} kiválasztva`;
        placeholderSpan.style.color = checkedCount === 0 ? "var(--muted)" : "var(--text)";
    }

    header.addEventListener("click", () => {
        wrapper.classList.toggle("active");
    });
    
    // Klikk kívülre -> bezárás
    document.addEventListener("click", (e) => {
        if (!wrapper.contains(e.target)) wrapper.classList.remove("active");
    });
}

// --- 2. ADATOK BETÖLTÉSE ---
document.addEventListener("DOMContentLoaded", async () => {
    updateUI(); // Progress bar init

    try {
        const res = await fetch("/api/v1/options/all");
        if (res.ok) {
            const data = await res.json();
            setupMultiselect("ms-allergy", "allergyContainer", data.allergies, "alg");
            setupMultiselect("ms-injury", "injuryContainer", data.injuries, "inj");
            setupMultiselect("ms-condition", "conditionContainer", data.conditions, "cond");
            setupBirthdayPicker();
        }
    } catch (err) {
        console.error("Opciók betöltési hiba:", err);
    }
});

// --- 3. WIZARD LOGIKA ---

function updateUI() {
    // Lépések mutatása/rejtése
    steps.forEach(step => {
        if (parseInt(step.dataset.step) === currentStep) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });

    // Progress bar frissítése
    const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;
    progressBar.style.width = `${progress}%`;

    // Gombok állapota
    prevBtn.style.display = currentStep === 1 ? 'none' : 'inline-block';
    nextBtn.textContent = currentStep === totalSteps ? 'Kész, mentés! 🚀' : 'Tovább';
    msg.textContent = ""; // Hibaüzenet törlése váltáskor
}

function validateCurrentStep() {
    const currentStepEl = document.querySelector(`.step[data-step="${currentStep}"]`);
    const inputs = currentStepEl.querySelectorAll('input[required], select[required]');
    
    for (let input of inputs) {
        if (!input.value) {
            input.focus();
            msg.style.color = "var(--err)";
            msg.textContent = "Kérlek töltsd ki a kötelező mezőket!";
            return false;
        }
    }
    return true;
}

nextBtn.addEventListener('click', async () => {
    // 1. Validáció
    if (!validateCurrentStep()) return;

    // 2. Ha nem az utolsó lépés, léptetünk
    if (currentStep < totalSteps) {
        currentStep++;
        updateUI();
    } else {
        // 3. Ha az utolsó lépés, KÜLDÉS
        await submitForm();
    }
});

prevBtn.addEventListener('click', () => {
    if (currentStep > 1) {
        currentStep--;
        updateUI();
    }
});

// --- 4. FORM BEKÜLDÉSE (A VÉGÉN) ---
async function submitForm() {
    nextBtn.disabled = true;
    nextBtn.textContent = "Mentés...";
    msg.style.color = "var(--text)";
    msg.textContent = "Adatok feldolgozása...";

    // Dátum összerakása YYYY-MM-DD formátumra
    const y = document.getElementById("dob_year").value;
    const m = document.getElementById("dob_month").value.padStart(2, '0');
    const d = document.getElementById("dob_day").value.padStart(2, '0');

    const fullBirthDate = `${y}-${m}-${d}`;
    
    // Multiselect ID-k
    const allergyIds = Array.from(document.querySelectorAll('input[data-group="alg"]:checked')).map(cb => parseInt(cb.value));
    const injuryIds = Array.from(document.querySelectorAll('input[data-group="inj"]:checked')).map(cb => parseInt(cb.value));
    const conditionIds = Array.from(document.querySelectorAll('input[data-group="cond"]:checked')).map(cb => parseInt(cb.value));

    const payload = {
        birth_date: fullBirthDate,
        gender: document.getElementById('gender').value,
        height: parseFloat(document.getElementById('height').value),
        
        start_weight_kg: parseFloat(document.getElementById("start_weight").value),
        target_weight_kg: parseFloat(document.getElementById("target_weight").value),
        goal_type: document.getElementById("goal_type").value,
        
        load_level: document.getElementById("load_level").value,
        diet_preference: document.getElementById('diet_preference').value,
        program_time: document.getElementById("program_time").value,
        preference: document.getElementById("preference").value,

        allergy_ids: allergyIds,
        injury_ids: injuryIds,
        condition_ids: conditionIds,
        medication_ids: [] 
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
            throw new Error(errData.detail || "Hiba történt a mentéskor.");
        }

        msg.style.color = "var(--ok)";
        msg.textContent = "✅ Sikeres mentés! Átirányítás...";
        
        setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 1500);

    } catch (err) {
        console.error(err);
        msg.style.color = "var(--err)";
        msg.textContent = "Hiba: " + err.message;
        nextBtn.disabled = false;
        nextBtn.textContent = "Kész, mentés! 🚀";
    }
}