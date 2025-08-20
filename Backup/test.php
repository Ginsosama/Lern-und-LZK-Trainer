<?php 
header('Content-Type: text/plain');
echo 'PHP is working!';
file_put_contents('test.log', 'PHP write test');
?>
