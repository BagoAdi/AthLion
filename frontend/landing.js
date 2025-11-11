// landing.js
document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("landingOverlay");
  if (!overlay) return;

  const root = document.documentElement;

  const loginBtn = document.getElementById("landingLogin");
  const registerBtn = document.getElementById("landingRegister");
  const guestBtn = document.getElementById("landingGuest");

  // Belépő animáció
  overlay.classList.add("visible");

  // Gombok
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      window.location.href = "login.html";
    });
  }

  if (registerBtn) {
    registerBtn.addEventListener("click", () => {
      window.location.href = "register.html";
    });
  }

  if (guestBtn) {
    guestBtn.addEventListener("click", () => {
      // csak eltüntetjük az overlayt, az index.html app alatta már fut
      overlay.classList.add("hide");
      setTimeout(() => {
        overlay.style.display = "none";
      }, 400);
    });
  }

  // Egérre reagáló blob-mozgás
  const moveBg = (x, y) => {
    const xRatio = x / window.innerWidth - 0.5;
    const yRatio = y / window.innerHeight - 0.5;
    const moveX = xRatio * 40;
    const moveY = yRatio * 40;
    root.style.setProperty("--mouseX", `${moveX}px`);
    root.style.setProperty("--mouseY", `${moveY}px`);
  };

  window.addEventListener("mousemove", (e) => {
    moveBg(e.clientX, e.clientY);
  });

  window.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      moveBg(t.clientX, t.clientY);
    },
    { passive: true }
  );
});
