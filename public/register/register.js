document.getElementById("registerButton").addEventListener("click", async () => {
    // Get input values
    const fullName = document.getElementById("name").value.trim();
    const parentName = document.getElementById("parentName").value.trim();
    const grade = document.getElementById("grade").value;
    const dob = document.getElementById("dob").value;
    const contactNum = document.getElementById("contactNum").value.trim();
    const password = document.getElementById("pass").value;
    const confirmPass = document.getElementById("confirmPass").value;

    // Validation
    if (!fullName || !parentName || grade === "-- select grade --" || !dob || !contactNum || !password || !confirmPass) {
        alert("Please fill in all fields.");
        return;
    }

    if (!/^\d{10}$/.test(contactNum)) {
        alert("Contact number must be exactly 10 digits.");
        return;
    }

    if (password.length < 6) {
        alert("Password must be at least 6 characters long.");
        return;
    }

    if (password !== confirmPass) {
        alert("Passwords do not match.");
        return;
    }

    // Send data to backend
    try {
        const response = await fetch("http://localhost:5000/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullName, parentName, grade, dob, contactNum, password, confirmPass })
        });

        const data = await response.json();
        alert(data.message);
        if (response.ok) {
            // Optional: clear form after successful registration
            document.getElementById("name").value = "";
            document.getElementById("parentName").value = "";
            document.getElementById("grade").value = "-- select grade --";
            document.getElementById("dob").value = "";
            document.getElementById("contactNum").value = "";
            document.getElementById("pass").value = "";
            document.getElementById("confirmPass").value = "";
            window.location.href = "../home/home.html";
        }
    } catch (err) {
        console.error(err);
        alert("Server error. Please try again later.");
    }
});
