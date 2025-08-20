
document.addEventListener('DOMContentLoaded', function () {
    const addUserForm = document.getElementById('addUserForm');
    const addTempUserForm = document.getElementById('addTempUserForm');
    const userList = document.getElementById('existingUsers');
    const tempUsersList = document.getElementById('tempUsersList');

    // Funktion zum Laden der Benutzer aus der Datenbank
    function loadUsers() {
        fetch('/quiz/php/get_users.php')
            .then(response => response.json())
            .then(data => {
                userList.innerHTML = '';
                data.users.forEach(user => {
                    const userDiv = document.createElement('div');
                    userDiv.classList.add('user');
                    userDiv.innerHTML = `
                        <div>
                            <strong>${user.username}</strong> (Rolle: ${user.role})
                            <button class="edit-user" data-id="${user.id}">Bearbeiten</button>
                            <button class="delete-user" data-id="${user.id}">Löschen</button>
                        </div>
                    `;
                    userList.appendChild(userDiv);
                });
            });
    }

    // Funktion zum Laden der temporären Benutzer
    function loadTempUsers() {
        fetch('/quiz/php/get_temp_users.php')
            .then(response => response.json())
            .then(data => {
                tempUsersList.innerHTML = '';
                data.tempUsers.forEach(user => {
                    const tempUserDiv = document.createElement('div');
                    tempUserDiv.classList.add('temp-user');
                    tempUserDiv.innerHTML = `
                        <div>
                            <strong>${user.username}</strong> (Gültig bis: ${user.valid_until})
                            <button class="delete-temp-user" data-id="${user.id}">Löschen</button>
                        </div>
                    `;
                    tempUsersList.appendChild(tempUserDiv);
                });
            });
    }

    // Funktion um zu prüfen, ob der Benutzer den richtigen Zugriff hat
    function canEditUser(currentUserRole, targetUserRole) {
        if (currentUserRole === 'owner') {
            return true; // Owner kann alles bearbeiten
        }
        if (currentUserRole === 'admin' && targetUserRole !== 'owner') {
            return true; // Admin kann alles außer Owner bearbeiten
        }
        if (currentUserRole === 'user' && targetUserRole === 'user') {
            return true; // User kann sich selbst bearbeiten
        }
        return false; // Alle anderen Fälle sind nicht erlaubt
    }

    // Benutzer hinzufügen
    addUserForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const username = document.getElementById('newUsername').value;
        const password = document.getElementById('newPassword').value;
        const role = document.getElementById('newUserRole').value;

        fetch('/quiz/php/add_user.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password, role })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Benutzer hinzugefügt!');
                loadUsers();
            } else {
                alert('Fehler beim Hinzufügen des Benutzers.');
            }
        });
    });

    // Temporären Benutzer hinzufügen
    addTempUserForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const username = document.getElementById('tempUsername').value;
        const password = document.getElementById('tempPassword').value;
        const validUntil = document.getElementById('tempDays').value;

        fetch('/quiz/php/add_temp_user.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password, validUntil })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Temporärer Benutzer hinzugefügt!');
                loadTempUsers();
            } else {
                alert('Fehler beim Hinzufügen des temporären Benutzers.');
            }
        });
    });

    // Benutzer bearbeiten (Rolle und Passwort ändern)
    userList.addEventListener('click', function (e) {
        if (e.target.classList.contains('edit-user')) {
            const userId = e.target.dataset.id;
            const newRole = prompt('Neue Rolle (admin/user):');
            const newPassword = prompt('Neues Passwort:');

            const currentUserRole = 'admin'; // Angenommene Rolle des aktuell angemeldeten Benutzers
            const targetUserRole = 'user';  // Die Rolle des zu bearbeitenden Benutzers

            if (canEditUser(currentUserRole, targetUserRole)) {
                fetch('/quiz/php/edit_user.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ userId, newRole, newPassword })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('Benutzer erfolgreich bearbeitet!');
                        loadUsers();
                    } else {
                        alert('Fehler beim Bearbeiten des Benutzers.');
                    }
                });
            } else {
                alert('Du hast keine Berechtigung, diesen Benutzer zu bearbeiten.');
            }
        }

        // Benutzer löschen
        if (e.target.classList.contains('delete-user')) {
            const userId = e.target.dataset.id;
            if (confirm('Bist du sicher, dass du diesen Benutzer löschen möchtest?')) {
                fetch('/quiz/php/delete_user.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ userId })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('Benutzer gelöscht!');
                        loadUsers();
                    } else {
                        alert('Fehler beim Löschen des Benutzers.');
                    }
                });
            }
        }
    });

    // Temporären Benutzer löschen
    tempUsersList.addEventListener('click', function (e) {
        if (e.target.classList.contains('delete-temp-user')) {
            const userId = e.target.dataset.id;
            if (confirm('Bist du sicher, dass du diesen temporären Benutzer löschen möchtest?')) {
                fetch('/quiz/php/delete_temp_user.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ userId })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('Temporärer Benutzer gelöscht!');
                        loadTempUsers();
                    } else {
                        alert('Fehler beim Löschen des temporären Benutzers.');
                    }
                });
            }
        }
    });

    // Initiales Laden der Benutzer
    loadUsers();
    loadTempUsers();
});
