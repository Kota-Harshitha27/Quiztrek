const mongoose = require("mongoose");

const recentQuizSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  class: Number,
  subject: String,
  chapter: String,
  questions: [{
    questionId: mongoose.Schema.Types.ObjectId,
    selectedIndex: Number,
    correctAnswer: Number,
    correct: Boolean,
    explanation: String,
    timeTakenSec: Number,
    section: String
  }],
  score: Number,
  startedAt: Date,
  finishedAt: Date,
  perSection: mongoose.Schema.Types.Mixed,
  rawMeta: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});
recentQuizSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("recent_quiz", recentQuizSchema);