const form = document.getElementById("registerForm");
const msg = document.getElementById("msg");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "Folyamatban...";

  const email = document.getElementById("email").value.trim();
  const user_name = document.getElementById("user_name").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const res = await fetch("/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, user_name, password })
    });

    let data, text;
    try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) data = await res.json();
    else { text = await res.text(); throw new Error(text || `HTTP ${res.status}`); }
    } catch (e) {
    // ha JSON parse bukik (pl. Internal Server Error plain text)
    text = text || (e && e.message) || "Ismeretlen hiba";
    throw new Error(text);
    }

    if (!res.ok) throw new Error((data && data.detail) || `HTTP ${res.status}`);
  }
  catch (err) {
    msg.style.color = "var(--err)";
    msg.textContent = "❌ " + err.message;
  }
});
