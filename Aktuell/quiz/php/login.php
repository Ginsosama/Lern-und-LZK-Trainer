
<?php
session_start();
include 'db.php';

// Löschen von temporären Benutzern, deren Gültigkeit abgelaufen ist
$stmt = $pdo->prepare("DELETE FROM temp_users WHERE valid_until < CURDATE()");
$stmt->execute();

$data = json_decode(file_get_contents("php://input"), true);
$username = $data['username'];
$password = $data['password'];

// Überprüfen, ob der Benutzer in der Datenbank existiert
$stmt = $pdo->prepare("SELECT * FROM users WHERE username = :username");
$stmt->execute(['username' => $username]);
$user = $stmt->fetch();

if ($user) {
    // Wenn der Benutzer existiert, das Passwort überprüfen
    if (password_verify($password, $user['password'])) {
        // Erfolgreiches Login: Session setzen
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['role'] = $user['role'];  // Rolle des Benutzers speichern (optional)

        echo json_encode(['success' => true, 'message' => 'Login erfolgreich']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Falsches Passwort']);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Benutzer nicht gefunden']);
}
?>
