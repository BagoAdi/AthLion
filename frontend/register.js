const form = document.getElementById("registerForm");
const msg = document.getElementById("msg");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.style.color = "var(--muted)";
  msg.textContent = "Folyamatban...";

  const email = document.getElementById("email").value.trim();
  const user_name = document.getElementById("user_name").value.trim();
  const password = document.getElementById("password").value.trim();
  const date_of_birth = document.getElementById("dob").value;      // YYYY-MM-DD
  const height_cm = parseFloat(document.getElementById("height").value);
  const sex = document.getElementById("sex").value.trim();

  // minimális kliensoldali valid
  if (!email || !user_name || !password || !date_of_birth || !height_cm || !sex) {
    msg.style.color = "var(--err)";
    msg.textContent = "❌ Minden mező kötelező.";
    return;
  }

  try {
    const res = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, user_name, password, date_of_birth, height_cm, sex })
    });

    const ct = res.headers.get("content-type") || "";
    const payload = ct.includes("application/json") ? await res.json()
                                                    : { detail: await res.text() };

    if (!res.ok) {
      let msgText;
      if (Array.isArray(payload.detail)) {
        msgText = payload.detail.map(e => `${(e.loc || []).join(".")}: ${e.msg}`).join(" | ");
      } else if (payload && payload.detail) {
        msgText = typeof payload.detail === "string" ? payload.detail : JSON.stringify(payload.detail);
      } else {
        msgText = `HTTP ${res.status}`;
      }
      throw new Error(msgText);
    }

    // --- VÁLTOZÁS ITT ---
    // Siker! Ne csak kiírjunk, hanem jelentsük is be a felhasználót
    // és irányítsuk át a beállításokhoz.
    
    msg.style.color = "var(--ok)";
    msg.textContent = "✅ Sikeres regisztráció! Átirányítás a beállításokhoz...";

    // 1. Mentsd el a kapott tokent
    localStorage.setItem("token", payload.access_token);

    // üdvözléshez elmentjük a nevet és az emailt
    localStorage.setItem("user_name", user_name);
    localStorage.setItem("user_email", email);

    // 2. Irányítsd át a setup.html-re
    setTimeout(() => {
        window.location.href = "setup.html";
    }, 1500);


  } catch (err) {
    msg.style.color = "var(--err)";
    msg.textContent = "❌ " + err.message;
  }
});