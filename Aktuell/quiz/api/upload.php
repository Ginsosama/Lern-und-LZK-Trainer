<?php
$root = "/var/www/quiz/files";
if (!is_dir($root)) { http_response_code(500); exit; }

function safe($name) {
  $name = urldecode($name ?? "upload.xlsx");
  // nur erlaubte Zeichen
  $name = preg_replace("/[^\w.\- ]+/", "_", $name);
  // Sicherheit: erlaube höchstens 128 Zeichen
  return mb_strimwidth($name, 0, 128, "");
}

function ensure_xlsx($fname) {
  $ext = strtolower(pathinfo($fname, PATHINFO_EXTENSION));
  return $ext === "xlsx";
}

function next_available_name($dir, $fname) {
  $ext  = strtolower(pathinfo($fname, PATHINFO_EXTENSION));
  $base = pathinfo($fname, PATHINFO_FILENAME);
  $candidate = $fname;
  $i = 1;
  while (file_exists($dir . "/" . $candidate)) {
    $candidate = sprintf("%s (%d).%s", $base, $i++, $ext);
  }
  return $candidate;
}

header("Content-Type: application/json");

// Variante A: multipart/form-data (Form-Upload mit <input type=file name="file">)
if (!empty($_FILES) && isset($_FILES["file"]) && is_uploaded_file($_FILES["file"]["tmp_name"])) {
  $orig  = $_FILES["file"]["name"];
  $tmp   = $_FILES["file"]["tmp_name"];
  $fname = safe($orig);

  if (!ensure_xlsx($fname)) {
    http_response_code(415);
    echo json_encode(["ok"=>false, "error"=>"only_xlsx_allowed"]);
    exit;
  }

  // Bei Kollision automatisch hochzählen
  $fname = next_available_name($root, $fname);
  $path  = $root . "/" . $fname;

  if (!move_uploaded_file($tmp, $path)) {
    http_response_code(500);
    echo json_encode(["ok"=>false, "error"=>"move_failed"]);
    exit;
  }

  echo json_encode(["ok"=>true, "file"=>$fname]);
  exit;
}

// Variante B: application/octet-stream + X-Filename (z. B. via fetch/curl)
$fname = safe($_SERVER["HTTP_X_FILENAME"] ?? null);
if (!ensure_xlsx($fname)) {
  http_response_code(415);
  echo json_encode(["ok"=>false, "error"=>"only_xlsx_allowed"]);
  exit;
}
$fname = next_available_name($root, $fname);
$path  = $root . "/" . $fname;

$in  = fopen("php://input", "rb");
$out = fopen($path, "wb");
if (!$in || !$out) {
  http_response_code(500);
  echo json_encode(["ok"=>false, "error"=>"open_failed"]);
  exit;
}
stream_copy_to_stream($in, $out);
fclose($in); fclose($out);

echo json_encode(["ok"=>true, "file"=>$fname]);
