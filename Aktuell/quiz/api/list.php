<?php
$root = "/var/www/quiz/files";
$files = @scandir($root);
if ($files === false) { http_response_code(500); exit; }
$files = array_values(array_filter($files, fn($f) => is_file("$root/$f")));
header("Content-Type: application/json");
echo json_encode(["ok"=>true, "files"=>$files]);
