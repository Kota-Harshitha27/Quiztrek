<?php
$server = "localhost";
$username = "root";
$password = "";
$database = "wt2";

$conn = mysqli_connect($server, $username, $password, $database);

if (!$conn) {
    die("Connection failed: " . mysqli_connect_error());
}

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $name = $_POST['studentname'];

    $sql = "SELECT * FROM itworkshop WHERE studentname='$name'";
    $result = mysqli_query($conn, $sql);

    if (mysqli_num_rows($result) > 0) {
        echo "<h2>Stored Data for '$name'</h2>";
        echo "<table>";
        echo "<tr><th>studentID</th><th>studetname</th><th>course</th><th>branch</th></tr>";

        while ($row = mysqli_fetch_assoc($result)) {
            echo "<tr>";
            echo "<td>" . $row['studentid'] . "</td>";
            echo "<td>" . $row['studentname'] . "</td>";
            echo "<td>" . $row['course'] . "</td>";
             echo "<td>" . $row['branch'] . "</td>";
            echo "</tr>";
        }

        echo "</table>";
    } else {
        echo "No data found for '$name'.";
    }
}

mysqli_close($conn);
?>

