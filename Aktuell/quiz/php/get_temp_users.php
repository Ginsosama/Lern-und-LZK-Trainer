
<?php
include 'db.php';

$stmt = $pdo->query("SELECT * FROM temp_users");
$tempUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(['tempUsers' => $tempUsers]);
?>
