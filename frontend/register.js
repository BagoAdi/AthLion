const form = document.getElementById("registerForm");
const msg = document.getElementById("msg");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.style.color = "var(--muted)";
  msg.textContent = "Folyamatban...";

  const email = document.getElementById("email").value.trim();
  const user_name = document.getElementById("user_name").value.trim();
  const password = document.getElementById("password").value.trim();

  // Minimális kliensoldali ellenőrzés
  if (!email || !user_name || !password) {
    msg.style.color = "var(--err)";
    msg.textContent = "❌ Minden mező kötelező.";
    return;
  }

  try {
    const res = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, user_name, password }),
    });

    // Ellenőrizzük a választ
    const ct = res.headers.get("content-type") || "";
    const payload = ct.includes("application/json") 
      ? await res.json()
      : { detail: await res.text() };

    if (!res.ok) {
      // Hibaüzenet összerakása
      let msgText;
      if (Array.isArray(payload.detail)) {
        // Pydantic validációs hiba
        msgText = payload.detail.map(e => `${(e.loc || []).join(".")}: ${e.msg}`).join(" | ");
      } else if (payload && payload.detail) {
        // Sima HTTP hiba szöveg
        msgText = typeof payload.detail === "string" ? payload.detail : JSON.stringify(payload.detail);
      } else {
        msgText = `HTTP ${res.status}`;
      }
      throw new Error(msgText);
    }

    // --- SIKERES REGISZTRÁCIÓ ---
    msg.style.color = "var(--ok)";
    msg.textContent = "✅ Sikeres regisztráció! Átirányítás...";

    // Token mentése
    localStorage.setItem("token", payload.access_token);
    
    // Opcionális: név mentése üdvözléshez (ha a backend visszaküldené, de most a tokenben van)
    // Most kérjük le a profil adatait a token segítségével, hogy biztosan meglegyen a név:
    try {
        const userRes = await fetch("/api/v1/auth/users/me", {
            headers: { "Authorization": `Bearer ${payload.access_token}` }
        });
        if (userRes.ok) {
            const userData = await userRes.json();
            localStorage.setItem("user_name", userData.user_name);
        }
    } catch (ignore) {
        console.warn("Nem sikerült előre lekérni a user adatokat, sebaj.");
    }

    // Átirányítás a Setup-ra (vagy Dashboardra, ha már van adata)
    // Mivel új regisztráció, valószínűleg a setup kell:
    setTimeout(() => {
      window.location.href = "setup.html"; 
    }, 1500);

  } catch (err) {
    console.error(err);
    msg.style.color = "var(--err)";
    // Itt írja ki a backend üzenetét (pl: "Érvénytelen e-mail cím...")
    msg.textContent = "❌ " + err.message;
  }
});