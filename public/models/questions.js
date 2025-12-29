const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  class: Number,
  subject: String,
  chapter: String,
  section: String, // memorize | critical | application
  type: String, // mcq etc
  question: String,
  options: [String],
  answer: Number, // index (DO NOT send to client)
  explanation: String,
  caseStudy: String,
  imageUrl: String,
  difficulty: String
});

module.exports = mongoose.model("Question", questionSchema );