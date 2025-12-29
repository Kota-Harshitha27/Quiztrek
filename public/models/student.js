const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
    profileImage:{type:String , required:false},
    fullName: { type: String, required: true },
    parentName: { type: String, required: true },
    grade: { type: Number, required: true },
    dob: { type: Date, required: true },
    contactNum: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    currentStreak: { type: Number, default: 0 },
    maxStreak: { type: Number, default: 0 },
    recentQuizzes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'RecentQuiz' }],
});

module.exports = mongoose.model("Student", studentSchema);
