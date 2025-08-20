
document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault();
    let username = document.getElementById('username').value;
    let password = document.getElementById('password').value;

    fetch('login.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username, password: password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Redirect to the main page on successful login
            window.location.href = "index.html";
        } else {
            // Display error message on failed login
            alert("Login fehlgeschlagen. Bitte überprüfen Sie Ihren Benutzernamen und Ihr Passwort.");
        }
    })
    .catch(error => {
        console.error('Error during login:', error);
        alert('Es gab einen Fehler beim Login. Bitte versuchen Sie es später erneut.');
    });
});

// Additional functions related to user authentication can go here if needed
