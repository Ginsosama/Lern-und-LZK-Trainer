
// Auth & Benutzer-Management
(function(){
  const BASE_URL = window.BASE_URL || 'http://209.25.141.16:4728/';
  window.BASE_URL = BASE_URL;

  // Predefined users
  window.users = {
    "Justus": { password: "79232138", role: "admin" },
    "Gast": { password: "test123", role: "user" },
    "Trainer": { password: "test123", role: "admin" },
    "Hamid": { password: "Pa$$w0rd", role: "user" },
    "Marc": { password: "Pa$$w0rd", role: "user" },
    "DanielK": { password: "Pa$$w0rd", role: "user" },
    "Sarah": { password: "Pa$$w0rd", role: "user" },
    "Jules": { password: "Pa$$w0rd", role: "user" },
    "DanielD": { password: "Pa$$w0rd", role: "user" },
    "Felix": { password: "Pa$$w0rd", role: "user" },
    "Steven": { password: "Pa$$w0rd", role: "user" },
    "ChrisD": { password: "Pa$$w0rd", role: "user" },
    "Önder": { password: "Pa$$w0rd", role: "admin" },
    "ChrisA": { password: "Pa$$w0rd", role: "user" },
    "Marco": { password: "Pa$$w0rd", role: "user" },
    "Henning": { password: "Pa$$w0rd", role: "admin" },
    "Michael": { password: "Pa$$w0rd", role: "user" },
    "Trainee1": { password: "Pa$$w0rd", role: "user" },
    "Trainee2": { password: "Pa$$w0rd", role: "user" }
  };
  window.tempUsers = JSON.parse(localStorage.getItem('tempUsers') || '{}');

  function loadUsersFromStorage(){
    const stored = localStorage.getItem('quizUsers');
    if (stored){
      const add = JSON.parse(stored);
      for (const [u,data] of Object.entries(add)){
        if (!window.users[u]) window.users[u]=data;
      }
    }
    // cleanup expired temp users
    const now = Date.now();
    let changed = false;
    for (const [u,data] of Object.entries(window.tempUsers)){
      if (data.expiryDate < now){ delete window.tempUsers[u]; changed = true; }
    }
    if (changed) localStorage.setItem('tempUsers', JSON.stringify(window.tempUsers));
  }
  window.loadUsersFromStorage = loadUsersFromStorage;

  function saveUsersToStorage(){
    const predefined = ["Justus","Gast","Trainer","Hamid","Marc","DanielK","Sarah","Jules","DanielD","Felix","Steven","ChrisD","Önder","ChrisA","Marco","Henning","Michael","Trainee1","Trainee2"];
    const additional = {};
    for (const [u,data] of Object.entries(window.users)){
      if (!predefined.includes(u)) additional[u]=data;
    }
    localStorage.setItem('quizUsers', JSON.stringify(additional));
    localStorage.setItem('tempUsers', JSON.stringify(window.tempUsers));
  }
  window.saveUsersToStorage = saveUsersToStorage;

  function handleLoginSuccess(username){
    window.currentUser = username;
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('mainContainer').classList.remove('hidden');
    if (typeof window.initTheme === 'function') window.initTheme();
    if (typeof window.loadAvailableFiles === 'function') window.loadAvailableFiles();
    if (typeof window.checkAdminStatus === 'function') window.checkAdminStatus();
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadUsersFromStorage();

    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;

      // Try server login first
      fetch(`${BASE_URL}login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      }).then(res => {
        if (res.ok) return res.json();
        throw new Error('server login failed');
      }).then(data => {
        if (data && data.success){
          handleLoginSuccess(username);
          return;
        }
        throw new Error('invalid credentials');
      }).catch(() => {
        // Fallback local users
        if (window.users[username] && window.users[username].password === password){
          handleLoginSuccess(username);
          return;
        }
        // Temp users
        if (window.tempUsers[username] && window.tempUsers[username].password === password){
          const now = Date.now();
          if (window.tempUsers[username].expiryDate < now){
            delete window.tempUsers[username];
            saveUsersToStorage();
            alert('Temporärer Benutzer abgelaufen!');
            return;
          }
          handleLoginSuccess(username);
          return;
        }
        alert('Falsche Anmeldedaten');
      });
    });

    // Admin: add user
    document.getElementById('addUserForm').addEventListener('submit', (e)=>{
      e.preventDefault();
      const u = document.getElementById('newUsername').value.trim();
      const p = document.getElementById('newPassword').value;
      const r = document.getElementById('newUserRole').value;
      if (!u || !p || !r){ alert('Bitte alle Felder ausfüllen!'); return; }
      if (window.users[u] || window.tempUsers[u]){ alert('Benutzername existiert bereits!'); return; }
      window.users[u] = { password: p, role: r };
      saveUsersToStorage();
      document.getElementById('addUserForm').reset();
      if (typeof window.showUserList === 'function') window.showUserList();
      alert(`Benutzer ${u} wurde erfolgreich hinzugefügt!`);
    });

    // Admin: add temp user
    document.getElementById('addTempUserForm').addEventListener('submit', (e)=>{
      e.preventDefault();
      const u = document.getElementById('tempUsername').value.trim();
      const p = document.getElementById('tempPassword').value;
      const days = parseInt(document.getElementById('tempDays').value);
      if (!u || !p || !days){ alert('Bitte alle Felder ausfüllen!'); return; }
      if (window.users[u] || window.tempUsers[u]){ alert('Benutzername existiert bereits!'); return; }
      const expiry = new Date(); expiry.setDate(expiry.getDate()+days);
      window.tempUsers[u] = { password:p, role:'user', expiryDate: expiry.getTime() };
      saveUsersToStorage();
      document.getElementById('addTempUserForm').reset();
      if (typeof window.showTempUsersList === 'function') window.showTempUsersList();
      alert(`Temporärer Benutzer ${u} erstellt (gültig bis ${expiry.toLocaleDateString()})!`);
    });
  });

  // ----- Listen & Utilities -----
  function showUserList(){
    const userList = document.getElementById('existingUsers');
    userList.innerHTML = '';
    for (const [username, data] of Object.entries(window.users)){
      const div = document.createElement('div');
      div.className='user-item';
      div.innerHTML = `
        <span>${username} (Rolle: ${data.role})</span>
        <div class="user-actions">
          <button class="edit-user-btn" data-username="${username}">Passwort ändern</button>
          <button class="delete-user-btn" data-username="${username}">Löschen</button>
        </div>`;
      userList.appendChild(div);
    }
    userList.querySelectorAll('.edit-user-btn').forEach(btn=>{
      btn.addEventListener('click',()=>showEditPasswordForm(btn.getAttribute('data-username')));
    });
    userList.querySelectorAll('.delete-user-btn').forEach(btn=>{
      btn.addEventListener('click',()=>deleteUser(btn.getAttribute('data-username')));
    });
  }
  window.showUserList = showUserList;

  function showTempUsersList(){
    const list = document.getElementById('tempUsersList');
    list.innerHTML='';
    const now = Date.now();
    for (const [username, data] of Object.entries(window.tempUsers)){
      const expiryDate = new Date(data.expiryDate);
      const daysLeft = Math.ceil((data.expiryDate - now) / (1000*60*60*24));
      const div = document.createElement('div');
      div.className='user-item';
      div.innerHTML = `
        <span>${username} (Läuft ab: ${expiryDate.toLocaleDateString()} - noch ${daysLeft} Tage)</span>
        <div class="user-actions">
          <button class="delete-temp-user-btn" data-username="${username}">Löschen</button>
        </div>`;
      list.appendChild(div);
    }
    list.querySelectorAll('.delete-temp-user-btn').forEach(btn=>{
      btn.addEventListener('click',()=>deleteTempUser(btn.getAttribute('data-username')));
    });
  }
  window.showTempUsersList = showTempUsersList;

  function showEditPasswordForm(username){
    const container = document.querySelector(`.edit-user-btn[data-username="${username}"]`)?.closest('.user-item');
    if (!container) return;
    if (container.querySelector('.edit-password-form')) return;
    const form = document.createElement('div');
    form.className='edit-password-form';
    form.innerHTML = `
      <h4>Passwort für ${username} ändern</h4>
      <input type="password" id="newPassword-${username}" placeholder="Neues Passwort" required>
      <button class="save-password-btn" data-username="${username}">Speichern</button>
      <button class="cancel-edit-btn">Abbrechen</button>`;
    container.appendChild(form);
    form.querySelector('.save-password-btn').addEventListener('click',()=>{
      const np = document.getElementById(`newPassword-${username}`).value;
      if (np){
        window.users[username].password = np;
        saveUsersToStorage();
        showUserList();
        alert(`Passwort für ${username} wurde erfolgreich geändert!`);
      }
    });
    form.querySelector('.cancel-edit-btn').addEventListener('click',()=>form.remove());
  }
  window.showEditPasswordForm = showEditPasswordForm;

  function deleteUser(username){
    if (!confirm(`Möchten Sie den Benutzer "${username}" wirklich löschen?`)) return;
    if (username === window.currentUser){ alert('Sie können sich nicht selbst löschen!'); return; }
    const predefined = ["Justus","Gast","Trainer","Hamid","Marc","DanielK","Sarah","Jules","DanielD","Felix","Steven","ChrisD","Önder","ChrisA","Marco","Henning","Michael","Trainee1","Trainee2"];
    if (predefined.includes(username)){ alert('Dieser Benutzer kann nicht gelöscht werden!'); return; }
    delete window.users[username];
    saveUsersToStorage();
    showUserList();
    alert(`Benutzer ${username} wurde gelöscht!`);
  }
  window.deleteUser = deleteUser;

  function deleteTempUser(username){
    if (!confirm(`Möchten Sie den temporären Benutzer "${username}" wirklich löschen?`)) return;
    if (username === window.currentUser){ alert('Sie können sich nicht selbst löschen!'); return; }
    delete window.tempUsers[username];
    saveUsersToStorage();
    showTempUsersList();
    alert(`Temporärer Benutzer ${username} wurde gelöscht!`);
  }
  window.deleteTempUser = deleteTempUser;

})();
