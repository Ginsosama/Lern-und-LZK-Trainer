
// Theme handling (dark / light)
(function(){
  window.darkMode = (localStorage.getItem('darkMode') === 'enabled');

  function updateDonateButtonStyle(){
    const donateBtn = document.querySelector('.donate-button');
    if (!donateBtn) return;
    if (window.darkMode) donateBtn.classList.add('dark-mode'); else donateBtn.classList.remove('dark-mode');
  }

  function initTheme(){
    document.body.classList.toggle('dark-mode', !!window.darkMode);
    updateDonateButtonStyle();
  }
  window.initTheme = initTheme;

  function toggleTheme(){
    window.darkMode = !window.darkMode;
    document.body.classList.toggle('dark-mode', window.darkMode);
    localStorage.setItem('darkMode', window.darkMode ? 'enabled' : 'disabled');
    updateDonateButtonStyle();
  }

  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    const t1 = document.getElementById('themeToggle');
    const t2 = document.getElementById('themeToggleAdmin');
    if (t1) t1.addEventListener('click', toggleTheme);
    if (t2) t2.addEventListener('click', toggleTheme);
  });
})();
