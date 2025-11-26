const form = document.getElementById("loginForm");
const msg = document.getElementById("msg");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.style.color = "var(--muted)";
  msg.textContent = "Bejelentkezés folyamatban...";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    msg.style.color = "var(--err)";
    msg.textContent = "❌ Add meg az email címet és jelszót.";
    return;
  }

  try {
    const res = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const ct = res.headers.get("content-type") || "";
    const payload = ct.includes("application/json") ? await res.json() : { detail: await res.text() };

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


    // Sikeres login
    msg.style.color = "var(--ok)";
    msg.textContent = "✅ Sikeres bejelentkezés!";
    localStorage.setItem("token", payload.access_token);

    // üdvözléshez elmentjük az emailt
    localStorage.setItem("user_email", email);

    setTimeout(() => (window.location.href = "dashboard.html"), 1200);


  } catch (err) {
    msg.style.color = "var(--err)";
    msg.textContent = "❌ " + err.message;
  }
});
