
<?php
include 'db.php';

$data = json_decode(file_get_contents("php://input"), true);
$username = $data['username'];
$password = password_hash($data['password'], PASSWORD_BCRYPT);
$role = $data['role'];

$stmt = $pdo->prepare("INSERT INTO users (username, password, role) VALUES (:username, :password, :role)");
if ($stmt->execute(['username' => $username, 'password' => $password, 'role' => $role])) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false]);
}
?>
