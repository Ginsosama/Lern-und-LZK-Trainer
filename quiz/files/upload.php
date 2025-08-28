<?php
// Header müssen vor jeder Ausgabe gesetzt werden
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// Absolute Pfade definieren
$uploadDir = '/var/www/html/uploads/';
$maxFileSize = 20 * 1024 * 1024; // 20MB

// Verzeichnis erstellen falls nicht existiert
if (!file_exists($uploadDir)) {
    if (!mkdir($uploadDir, 0755, true)) {
        http_response_code(500);
        die(json_encode(['error' => 'Verzeichnis konnte nicht erstellt werden']));
    }
}

try {
    // Nur POST erlauben
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Nur POST-Requests erlaubt', 405);
    }

    // Dateiüberprüfung
    if (empty($_FILES['file'])) {
        throw new Exception('Keine Datei empfangen', 400);
    }

    $file = $_FILES['file'];

    // Dateigröße prüfen
    if ($file['size'] > $maxFileSize) {
        throw new Exception('Datei zu groß (max. 20MB)', 413);
    }

    // Dateityp validieren
    $allowedMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/octet-stream'
    ];
    
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if (!in_array($mimeType, $allowedMimeTypes)) {
        throw new Exception('Nur Excel-Dateien (.xlsx) sind erlaubt', 400);
    }

    // Sicherer Dateiname
    $originalName = basename($file['name']);
    $extension = pathinfo($originalName, PATHINFO_EXTENSION);
    $safeName = uniqid() . '.' . $extension;
    $targetPath = $uploadDir . $safeName;

    // Datei verschieben
    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        echo json_encode([
            'success' => true,
            'message' => 'Excel-Datei erfolgreich hochgeladen',
            'filename' => $safeName
        ]);
    } else {
        throw new Exception('Fehler beim Speichern der Datei', 500);
    }
} catch (Exception $e) {
    http_response_code($e->getCode() ?: 500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}