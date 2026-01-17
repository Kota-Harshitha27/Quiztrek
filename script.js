function setCookie(name, value, days = 1) {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000)); // 1 day
  const expires = "expires=" + date.toUTCString();
  document.cookie = name + "=" + encodeURIComponent(value) + ";" + expires + ";path=/";
}
function validation(event) {
    var name = document.getElementById("name").value;
    var email = document.getElementById("email").value;
    var phone = document.getElementById("phone").value;
    var password = document.getElementById("password").value;
    var msg = document.getElementById("msg").value;
    var gender = document.getElementsByName('gender');
    var error_msg = document.getElementById("error_msg");

    error_msg.style.padding = "10px";
    var text;

    let genderselected = false;
    for (let g of gender) {
        if (g.checked) {
            genderselected = true;
            break;
        }
    }

    var namepat = /^[A-Za-z]+$/;

    if (name.length < 5) {
        text = "Name should be more than 5 characters";
        error_msg.innerHTML = text;
        alert(text);
        event.preventDefault();
        return false;
    } else if (!namepat.test(name)) {
        text = "Name should be non numeric";
        error_msg.innerHTML = text;
        event.preventDefault();
        return false;
    } else if (phone.length !== 10) {
        text = "Phone number should be 10 characters only";
        error_msg.innerHTML = text;
        event.preventDefault();
        return false;
    } else if (password.length < 8) {
        text = "Password should be more than 8 characters";
        error_msg.innerHTML = text;
        event.preventDefault();
        return false;
    } else if (name.trim() == "") {
        alert("Name should not be empty");
        event.preventDefault();
        return false;
    } else if (!genderselected) {
        text = "Gender should be selected";
        error_msg.innerHTML = text;
        event.preventDefault();
        return false;
    }

    //  Set cookies AFTER validation passes
    setCookie("name", name);
    setCookie("password", password);
    console.log("Cookies created:", document.cookie);

    return true;
}

