// auth.js

// Funktion, die beim Absenden des Login-Formulars aufgerufen wird
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();

    var username = document.getElementById('username').value;
    var password = document.getElementById('password').value;

    // Daten an den Server schicken
    fetch('/php/login.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username: username,
            password: password
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Erfolgreicher Login, Redirect oder UI-Anpassung
            window.location.href = "/quiz.html";
        } else {
            alert("Fehler beim Login: " + data.message);
        }
    })
    .catch(error => console.error('Fehler:', error));
});
