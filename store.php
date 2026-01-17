*<?php
$server="localhost";
$username="root";
$password="";
$database="wt2";
$conn=mysqli_connect($server,$username,$password,$database);
if(!$conn)
{
 echo "not connected";
 }
 else
 {
  echo "connected";
  }
  $id=$_POST['studentid'];
 $name=$_POST['studentname'];
 $course=$_POST['course'];
 $branch=$_POST['branch'];
  $sql="INSERT INTO itworkshop VALUES('$id','$name','$course','$branch');";
 $result=mysqli_query($conn,$sql);
 if($result)
 {
  echo "data stored ";
  }
  else
  {
   echo "data not stored";
   }
  ?>
  
