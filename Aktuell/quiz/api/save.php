<?php
$root = "/var/www/quiz/files";
if (!is_dir($root)) { http_response_code(500); exit; }

function safe($name) {
  $name = urldecode($name ?? "upload.bin");
  return preg_replace("/[^\w.\- ]+/", "_", $name);
}

header("Content-Type: application/json");

if (!empty($_FILES) && isset($_FILES["file"]) && is_uploaded_file($_FILES["file"]["tmp_name"])) {
  // multipart/form-data
  $orig  = $_FILES["file"]["name"];
  $tmp   = $_FILES["file"]["tmp_name"];
  $fname = safe($orig);
  $path  = $root . "/" . $fname;

  // überschreiben/neu
  if (file_exists($path)) { @unlink($path); }
  if (!move_uploaded_file($tmp, $path)) { http_response_code(500); echo json_encode(["ok"=>false,"error"=>"move_failed"]); exit; }

  echo json_encode(["ok"=>true,"file"=>$fname]); exit;
} else {
  // application/octet-stream + X-Filename
  $fname = safe($_SERVER["HTTP_X_FILENAME"] ?? null);
  $path  = $root . "/" . $fname;

  $in = fopen("php://input", "rb");
  $out = fopen($path, "wb"); // überschreibt
  if (!$in || !$out) { http_response_code(500); echo json_encode(["ok"=>false,"error"=>"open_failed"]); exit; }
  stream_copy_to_stream($in, $out);
  fclose($in); fclose($out);

  echo json_encode(["ok"=>true,"file"=>$fname]); exit;
}
