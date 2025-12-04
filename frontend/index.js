
// 1. Meglévő sima görgetés (Smooth scroll)
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        // Ha a link a kapcsolat gomb, akkor ne görgessen, hanem a modal nyíljon meg
        if (this.id === 'contact-btn') return;

        e.preventDefault();
        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        
        if (targetElement) {
            targetElement.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

// 2. Kapcsolat Modal kezelése
const modal = document.getElementById('contact-modal');
const contactBtn = document.getElementById('contact-btn');
const closeBtn = document.querySelector('.close-modal');

// Modal megnyitása
if (contactBtn) {
    contactBtn.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.add('active');
    });
}

// Modal bezárása az X gombbal
if (closeBtn) {
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });
}

// Modal bezárása, ha a sötét háttérre kattintunk
window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('active');
    }
});