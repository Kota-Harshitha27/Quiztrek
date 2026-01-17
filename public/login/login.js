document.getElementById("loginButton").addEventListener("click", async () => {
    const username = document.getElementById("name").value.trim();
    const password = document.getElementById("pass").value;

    if (!username || !password) {
        alert("Please enter both username and password");
        return;
    }

    try {
        const response = await fetch("http://localhost:5000/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            //alert("Login successful! Welcome " + data.fullName);
            // Redirect to home page after successful login
            localStorage.setItem("token", data.token);
            window.location.href = "../home/home.html";  
        } else {
            alert("Error: " + data.message);
        }
    } catch (err) {
        console.error(err);
        alert("Server error. Try again later.");
    }
});
