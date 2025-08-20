document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();  // Verhindert das Neuladen der Seite

    var username = document.getElementById('username').value;
    var password = document.getElementById('password').value;

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
            localStorage.setItem('role', data.role);
            window.location.href = "/admin.html";
        } else {
            alert("Fehler beim Login: " + data.message);
        }
    })
    .catch(error => {
        console.error('Fehler:', error);
    });
});