/*
 * Steuert die Umschaltung zwischen hellen und dunklen Farbvarianten. Beim
 * Laden der Seite wird geprüft, ob im localStorage bereits ein
 * entsprechender Eintrag existiert. Das Umschalten geschieht durch
 * Hinzufügen/Entfernen der Klasse "dark-mode" am body‑Element. Zusätzlich
 * wird der Spendenknopf farblich angepasst.
 */

(() => {
  let darkMode = localStorage.getItem('darkMode') === 'enabled';

  function updateDonateButtonStyle() {
    const donateBtn = document.querySelector('.donate-button');
    if (!donateBtn) return;
    if (darkMode) {
      donateBtn.classList.add('dark-mode');
    } else {
      donateBtn.classList.remove('dark-mode');
    }
  }

  function initTheme() {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    }
    updateDonateButtonStyle();
  }

  // Eventlistener für den Theme‑Button im Haupt‑ und Adminbereich
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    const toggleButtons = document.querySelectorAll('.theme-toggle');
    toggleButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        darkMode = !darkMode;
        document.body.classList.toggle('dark-mode', darkMode);
        localStorage.setItem('darkMode', darkMode ? 'enabled' : 'disabled');
        updateDonateButtonStyle();
      });
    });
  });
})();