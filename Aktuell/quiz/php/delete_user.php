
<?php
include 'db.php';

$data = json_decode(file_get_contents("php://input"), true);
$userId = $data['userId'];

$stmt = $pdo->prepare("DELETE FROM users WHERE id = :id");
$result = $stmt->execute(['id' => $userId]);

echo json_encode(['success' => $result]);
?>
