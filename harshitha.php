<?php
$server = "localhost";
$username = "root";
$password = "";
$database = "wt2";
$conn = mysqli_connect($server, $username, $password, $database);

// Enable error reporting for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

if ($conn) {
    echo "Connected<br>";
}

$fname = $_POST['fname'];
$village = $_POST['village'];
$number = $_POST['number'];
$gender = $_POST['gender'];

// Validation: name length
if (strlen($fname) <= 2) {
    echo "Name should be greater than 2 characters<br>";
}

// Validation: phone number format
if (preg_match('/^[0-9]{10}$/', $number)) {
    echo "Valid 10-digit number<br>";
} else {
    echo "Invalid number: Must be exactly 10 digits<br>";
}

$target_file = '';

if (isset($_FILES['photo']) && $_FILES['photo']['error'] == 0) {
    $photo = basename($_FILES["photo"]["name"]);
    $target_dir = "uploads/";

    // Check file size limit (5MB)
    if ($_FILES['photo']['size'] > 5242880) {
        echo "<script>alert('File is too large. Max size is 5MB');</script>";
        exit();
    }

    $file_type = strtolower(pathinfo($photo, PATHINFO_EXTENSION));
    $allowed_types = ['jpg', 'jpeg', 'png', 'gif'];
    if (!in_array($file_type, $allowed_types)) {
        echo "<script>alert('Invalid file type. Only JPG, JPEG, PNG & GIF allowed');</script>";
        exit();
    }

    // Create folder if not exists
    if (!is_dir($target_dir)) {
        mkdir($target_dir, 0777, true);
    }

    $target_file = $target_dir . uniqid() . "_" . $photo; // unique file name to prevent overwrite

    if (move_uploaded_file($_FILES["photo"]["tmp_name"], $target_file)) {
        echo "Photo uploaded<br>";
    } else {
        echo "Failed to upload photo<br>";
        exit();
    }
} else {
    echo "<script>alert('Please upload a photo');</script>";
    exit();
}

// Insert data into DB
$sql = "INSERT INTO workshop 
        VALUES ('$fname', '$village', '$number', '$gender', '$target_file')";
//$sql="delete from workshop where fullname='$fname';";
$result = mysqli_query($conn, $sql);

if ($result) {
    echo "Data inserted<br>";
} else {
    echo "Data not inserted<br>";
    exit();
}


$select_sql = "SELECT * FROM workshop";
$select_result = mysqli_query($conn, $select_sql);

if (mysqli_num_rows($select_result) > 0) {
    echo "<table border='1'>";
    while ($row = mysqli_fetch_assoc($select_result)) {
        echo "<tr>";
        echo "<td>" . htmlspecialchars($row['fullname']) . "</td>";
        echo "<td>" . htmlspecialchars($row['village']) . "</td>";
        echo "<td>" . htmlspecialchars($row['number']) . "</td>";
        echo "<td>" . htmlspecialchars($row['gender']) . "</td>";
        echo "<td><img src='" . htmlspecialchars($row['photo']) . "' width='100'></td>";
        echo "</tr>";
    }
    echo "</table>";
} else {
    echo "No data found";
}
?>

