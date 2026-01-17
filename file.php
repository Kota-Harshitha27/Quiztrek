<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

$file ="/opt/lampp/htdocs/php/sort.txt";
$handle = fopen($file, 'w');

if ($handle) {
    fwrite($handle, 'w is used to write a data to a file and r is used to read from the file');
    fclose($handle);
    echo "We can write now";
   } else {
    echo "Failed to open the file.";
  }

$handle1=fopen($file,'r');
$content=fread($handle1,filesize($file));
echo "$content";

?>

