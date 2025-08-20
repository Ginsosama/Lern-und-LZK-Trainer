<?php
session_start();
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "user_management";

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    die("Verbindung fehlgeschlagen: " . $conn->connect_error);
}

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Nicht eingeloggt.']);
    exit();
}

if (isset($_POST['add_user'])) {
    $new_username = $_POST['new_username'];
    $new_password = password_hash($_POST['new_password'], PASSWORD_DEFAULT);
    $new_role = $_POST['new_role'];

    if ($_SESSION['role'] != 'owner') {
        echo json_encode(['success' => false, 'message' => 'Nur der Besitzer kann Admins hinzufügen.']);
        exit();
    }

    $sql = "INSERT INTO users (username, password, role) VALUES ('$new_username', '$new_password', '$new_role')";
    if ($conn->query($sql) === TRUE) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => $conn->error]);
    }
    exit();
}

if (isset($_POST['delete_user'])) {
    $user_id_to_delete = $_POST['delete_user'];

    if ($_SESSION['role'] != 'owner') {
        echo json_encode(['success' => false, 'message' => 'Nur der Besitzer kann Admins löschen.']);
        exit();
    }

    $sql = "DELETE FROM users WHERE id = $user_id_to_delete";
    if ($conn->query($sql) === TRUE) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => $conn->error]);
    }
    exit();
}

$sql = "SELECT id, username, role FROM users";
$result = $conn->query($sql);

$users = [];
while($row = $result->fetch_assoc()) {
    $users[] = $row;
}

echo json_encode(['success' => true, 'users' => $users]);

$conn->close();
?>