<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

$files = glob("/var/www/quiz/files/*.xlsx");
if ($files === false) {
    http_response_code(500);
    die(json_encode(['error' => 'Dateiscan fehlgeschlagen']));
}

echo json_encode(array_map('basename', $files));
?>
