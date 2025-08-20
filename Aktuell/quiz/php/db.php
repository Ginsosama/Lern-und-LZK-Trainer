
<?php
$host = 'localhost';       // MariaDB-Server (localhost, wenn auf dem gleichen Server)
$dbname = 'lernquiz';      // Der Name der Datenbank
$user = 'quiz_user';       // Der neue Benutzername
$pass = '79232138';        // Das Passwort des neuen Benutzers

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die("Verbindung fehlgeschlagen: " . $e->getMessage());
}
?>
