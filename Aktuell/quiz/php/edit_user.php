
<?php
include 'db.php';

$data = json_decode(file_get_contents("php://input"), true);
$userId = $data['userId'];
$newRole = $data['newRole'];
$newPassword = password_hash($data['newPassword'], PASSWORD_BCRYPT);

$stmt = $pdo->prepare("UPDATE users SET role = :role, password = :password WHERE id = :id");
$result = $stmt->execute(['role' => $newRole, 'password' => $newPassword, 'id' => $userId]);

echo json_encode(['success' => $result]);
?>
