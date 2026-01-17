// profile.js


const editBtn = document.getElementById('editBtn');
const profileImage = document.getElementById('profileImage');
const imgInput = document.getElementById('imgInput');

let editMode = false;
let uploadedImage = profileImage.src;
console.log(uploadedImage);

// JWT from login
const token = localStorage.getItem('token'); 
const API_BASE = 'http://localhost:5000';

// ---------------- Validation functions ----------------
function validateName(name) {
    return name.trim().length > 0;
}

function validateGrade(grade) {
    const g = parseInt(grade);
    return !isNaN(g) && g >= 1 && g <= 12;
}

function validateDOB(dob) {
    const birthDate = new Date(dob);
    const age = (new Date() - birthDate) / (1000 * 60 * 60 * 24 * 365.25);
    return birthDate instanceof Date && !isNaN(birthDate) && age >= 5;
}

function validateContact(contact) {
    const regex = /^\+?[0-9]{10,15}$/; // simple phone format
    return regex.test(contact);
}

function validatePassword(pwd) {
    return pwd === "" || pwd.length >= 6; // empty = no change
}

// ---------------- Load student data ----------------
async function loadStudentData() {
    try {
        const res = await fetch(`${API_BASE}/profile`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch student data');
        const student = await res.json();
        console.log(student);

        document.getElementById('userName').innerText = student.fullName;
        document.getElementById('parentName').innerText = student.parentName;
        document.getElementById('className').innerText = student.grade;
        document.getElementById('dob').innerText = new Date(student.dob).toISOString().split('T')[0];
        document.getElementById('contact').innerText = student.contactNum;
        document.getElementById('state').innerText = student.state || '';
        profileImage.src = student.profileImage || profileImage.src;

    } catch (err) {
        console.error(err);
        alert('Error loading student data. Please login again.');
    }
}

// ---------------- Image upload ----------------
profileImage.addEventListener('click', () => {
    if (editMode) imgInput.click();
});

imgInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            profileImage.src = e.target.result;
            uploadedImage = e.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// ---------------- Edit & Save ----------------
editBtn.addEventListener('click', async () => {
    const editableFields = ['userName', 'parentName', 'className', 'dob', 'contact', 'state', 'password'];

    if (!editMode) {
        // Convert text to input fields
        editableFields.forEach(id => {
            const element = document.getElementById(id);
            const value = (id === 'password' && element.innerText === '********') ? '' : element.innerText;
            if (id === 'userName') element.outerHTML = `<input id="${id}" class="editable-name" value="${value}">`;
            else if (id === 'password') element.outerHTML = `<input id="${id}" type="password" value="${value}" placeholder="Enter new password">`;
            else element.outerHTML = `<input id="${id}" value="${value}">`;
        });
        editBtn.innerText = 'Save Changes';
        editMode = true;
        profileImage.title = "Click to change image";

    } else {
        // Collect input values
        const updatedData = {};
        editableFields.forEach(id => {
            const input = document.getElementById(id);
            if (id === 'userName') updatedData.fullName = input.value.trim();
            else if (id === 'parentName') updatedData.parentName = input.value.trim();
            else if (id === 'className') updatedData.grade = input.value.trim();
            else if (id === 'dob') updatedData.dob = input.value.trim();
            else if (id === 'contact') updatedData.contactNum = input.value.trim();
            else if (id === 'state') updatedData.state = input.value.trim();
            else if (id === 'password') updatedData.password = input.value;
        });
        updatedData.profileImage = uploadedImage;

        // ---------------- Validate ----------------
        if (!validateName(updatedData.fullName)) return alert('Full name cannot be empty');
        if (!validateName(updatedData.parentName)) return alert('Parent name cannot be empty');
        if (!validateGrade(updatedData.grade)) return alert('Grade must be between 1 and 12');
        if (!validateDOB(updatedData.dob)) return alert('Enter a valid date of birth (age >=5)');
        if (!validateContact(updatedData.contactNum)) return alert('Enter a valid contact number');
        if (!validatePassword(updatedData.password)) return alert('Password must be at least 6 characters');

        // ---------------- Send to backend ----------------
        try {
            const res = await fetch(`${API_BASE}/profile`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(updatedData)
            });

            if (!res.ok) throw new Error('Failed to update profile');
            const result = await res.json();

            // Convert inputs back to text
            editableFields.forEach(id => {
                const input = document.getElementById(id);
                const value = input.value;
                if (id === 'userName') input.outerHTML = `<h2 id="${id}" style="background: linear-gradient(135deg, #c341ff, #bc2bff); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${value}</h2>`;
                else if (id === 'password') input.outerHTML = `<span id="${id}">********</span>`;
                else input.outerHTML = `<span id="${id}">${value}</span>`;
            });

            editBtn.innerText = 'Edit Profile';
            editMode = false;
            profileImage.title = "Profile Image";

            alert('Profile updated successfully!');

        } catch (err) {
            console.error(err);
            alert('Error updating profile. Please try again.');
        }
    }
});

// ---------------- Initialize ----------------
loadStudentData();
