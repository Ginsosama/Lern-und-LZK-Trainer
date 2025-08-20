<?php
$file = isset($_GET['file']) ? basename($_GET['file']) : '';
$filepath = '/var/www/quiz/files/' . $file;

if (file_exists($filepath) && is_file($filepath)) {
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $file . '"');
    header('Content-Length: ' . filesize($filepath));
    readfile($filepath);
    exit;
} else {
    header("HTTP/1.0 404 Not Found");
    echo "Datei nicht gefunden";
}
?>
