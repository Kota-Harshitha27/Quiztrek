<?php
 error_reporting(E_ALL);
 ini_set('display_errors',1);
 $servername="localhost";
 $username="root";
 $password="";
 $database="test";
 $conn= mysqli_connect($servername,$username,$password,$database);
 if(!$conn)
 {
  echo "not connected<br>";
  }
  else
  {
   echo "connected<br>";
  }
  $sname=$_POST['studentname'];
  $rollno=$_POST['number'];
  $course=$_POST['course'];
  $telugu=$_POST['telugu'];
  $english=$_POST['english'];
  $hindi=$_POST['hindi'];
  $average=($telugu+$hindi+$english)/3;
  $sql="insert into result values('$sname','$rollno','$course','$average')";
   $result=mysqli_query($conn,$sql);
   if(!$result)
   {
       //echo "no database exist";
       echo "table not created";
   }
   else
   {
     // echo "database created";
     echo "table created";
       
   }
 ?>
