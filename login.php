<!DOCTYPE html>
<html>
<head><title>login</title></head>
<style>
  *
  {
   margin:1px;
   padding:5px;
   }
   body
   {
    background-image:url('https://www.creativefabrica.com/wp-content/uploads/2023/07/26/Open-Book-In-A-Library-Aesthetic-75491019-1.png');
    background-position:center;
    background-size:cover;
    background-repeat:no-repeat;
    border:8px solid black;
    height:600px;
    }
</style>
<body>
 <form action ="login.php" method="post" class="loginform">
   <table>
   <h1><u><b>Login</b></u></h1>
   <h2 >Enter Login Details</h2>
  <tr>
   <td><label for="userid">User ID:</label></td>
   <td><input type="text" name="userid" class="loginform" placeholder="Enter User Id"></td>
   </tr>
    <tr>
   <td><label for="password">Password:</label></td>
   <td><input type="password" name="password" class="loginform"  placeholder="Enter password"></td>
   </tr>
   <tr>
     <td colspan="1"></td>
     <td><button style="border-radius:15px" >Submit</button></td>
    <td><button style="border-radius:15px" type="reset" value="Reset Form" name="reset">Reset</button></td>
    </tr>
</table>
</form>
<?php
 if($_SERVER['REQUEST_METHOD']=='POST')
 {
  $userid=$_POST['userid'];
  $password=$_POST['password'];
  }
echo "<script>
  alert ('ur userid is $userid');
  alert( 'ur password is $password'); </script>";
  
?>

</body>
</html>
