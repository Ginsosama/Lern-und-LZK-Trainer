
document.addEventListener('DOMContentLoaded', () => {
  const adminToggle     = document.getElementById('adminMenuToggle');
  const adminMenu       = document.getElementById('adminMenu');
  const adminContainer  = document.getElementById('adminContainer');
  const mainContainer   = document.getElementById('mainContainer');

  const getUsers     = () => window.users || {};
  const getTempUsers = () => window.tempUsers || {};
  const getCurrent   = () => window.currentUser || null;

  function isCurrentUserAdmin() {
    const u = getCurrent();
    const users = getUsers();
    const temps = getTempUsers();
    return !!(u && (
      (users[u] && users[u].role === 'admin') ||
      (temps[u] && temps[u].role === 'admin')
    ));
  }

  function showSection(idToShow) {
    document.querySelectorAll('.admin-section').forEach(sec => sec.classList.add('hidden'));
    const el = document.getElementById(idToShow);
    if (el) el.classList.remove('hidden');
  }

  function activateMenuItem(item) {
    document.querySelectorAll('.admin-menu-item').forEach(mi => mi.classList.remove('active'));
    item.classList.add('active');
  }

  function checkAdminStatus() {
    adminToggle.classList.remove('visible');
    adminMenu.classList.remove('active');
    document.body.classList.remove('admin-menu-active');
    if (isCurrentUserAdmin()) {
      adminToggle.classList.add('visible');
    }
  }
  window.checkAdminStatus = checkAdminStatus;

  adminToggle.addEventListener('click', () => {
    if (!isCurrentUserAdmin()) return;
    const willOpen = !adminMenu.classList.contains('active');
    adminMenu.classList.toggle('active', willOpen);
    document.body.classList.toggle('admin-menu-active', willOpen);
    adminToggle.style.transform = willOpen ? 'rotate(90deg)' : 'rotate(0)';
  });

  document.querySelectorAll('.admin-menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      if (!isCurrentUserAdmin()) return;

      const section = item.getAttribute('data-section');
      if (section === 'backToMain') {
        adminContainer.classList.add('hidden');
        mainContainer.classList.remove('hidden');
        adminMenu.classList.remove('active');
        document.body.classList.remove('admin-menu-active');
        return;
      }

      adminContainer.classList.remove('hidden');
      mainContainer.classList.add('hidden');

      switch (section) {
        case 'userManagement':
          showSection('userManagementSection');
          if (typeof window.showUserList === 'function') window.showUserList();
          break;
        case 'tempUsers':
          showSection('tempUsersSection');
          if (typeof window.showTempUsersList === 'function') window.showTempUsersList();
          break;
        case 'fileUpload':
          showSection('fileUploadSection');
          break;
        case 'fileEdit':
          showSection('fileEditSection');
          if (typeof window.loadAvailableFiles === 'function') window.loadAvailableFiles();
          break;
      }
      activateMenuItem(item);
    });
  });

  checkAdminStatus();
});
