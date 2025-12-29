

const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const path = require('path');
const jwt = require('jsonwebtoken');
const SECRET = 'quiztrek@123';
const Student = require("./public/models/student");
const Question = require("./public/models/questions");
const RecentQuiz = require("./public/models/recent_quizzes");
const Task = require('./public/models/tasks');




const app = express();
app.use(express.static(path.join(__dirname, "public")));
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// MongoDB connection
mongoose.connect("mongodb://127.0.0.1:27017/Quiztrek", {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));


//verify token

function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  
  if (!header) {
    console.warn('verifyToken: no Authorization header');
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    console.warn('verifyToken: bad Authorization header format', header);
    return res.status(400).json({ success: false, message: 'Bad authorization header' });
  }

  try {
    //const decoded = jwt.verify(token, SECRET);
    //req.user = decoded; // e.g. { id, fullName, iat, exp }
    const token = req.headers['authorization']?.split(' ')[1];
const decoded = jwt.verify(token, SECRET);
req.user = { id: decoded.id };
    return next();
  } catch (err) {
    console.error('verifyToken jwt.verify error:', err.message);
    return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
}

/* const dashboardRoutes = require('./public/dashboard');
app.use(dashboardRoutes); */
 


// Registration endpoint
app.post("/register", async (req, res) => {
    const { fullName, parentName, grade, dob, contactNum, password, confirmPass } = req.body;

    if (password !== confirmPass) {
        return res.status(400).json({ message: "Passwords do not match" });
    }

    try {
        const existingStudent = await Student.findOne({ contactNum });
        if (existingStudent) {
            return res.status(400).json({ message: "Contact number already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newStudent = new Student({
            fullName,
            parentName,
            grade,
            dob,
            contactNum,
            password: hashedPassword
        });

        const saved = await newStudent.save();
        const token = jwt.sign({ id: newStudent._id, fullName: newStudent.fullName }, SECRET, { expiresIn: '2h' });
        return res.status(201).json({ message: "Student registered successfully", id: saved._id });
        
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
});


//Login code

app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: "Username and password are required." });
        }

        // Find user either by fullName or contactNum
        const user = await Student.findOne({ fullName : username.trim()});


        if (!user) return res.status(400).json({ message: "User not found." });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Incorrect password." });

        // Login successful
        const token = jwt.sign({ id: user._id, fullName: user.fullName }, SECRET, { expiresIn: '2h' });
        res.json({ message: "Login successful", fullName: user.fullName, id: user._id ,token});

    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

function shuffleInPlace(a){
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

// sample n docs from a filter safely (returns up to n)
async function sampleFromSection(filter, n) {
  const count = await Question.countDocuments(filter);
  const size = Math.min(n, count);
  if (size <= 0) return [];
  const pipeline = [{ $match: filter }, { $sample: { size } }];
  return Question.aggregate(pipeline);
}

// ---------- Routes ----------

// GET /api/quiz?class=6&subject=Maths&chapter=...&total=10
app.get('/api/quiz', async (req, res) => {
  try {
    const classNum = Number(req.query.class);
    const subject = req.query.subject;
    const chapter = req.query.chapter;
    const total = Number(req.query.total) || 10;

    if (!classNum || !subject || !chapter) {
      return res.status(400).json({ success: false, error: 'Missing class, subject or chapter query params' });
    }

    const sections = ['memorize', 'critical', 'application'];
    const base = Math.floor(total / sections.length);
    let rem = total % sections.length;

    // Shuffle order to decide which sections get the extra picks (varies which section gets +1)
    const shuffled = [...sections].sort(() => Math.random() - 0.5);
    const picks = {};
    for (let s of shuffled) {
      picks[s] = base + (rem > 0 ? 1 : 0);
      if (rem > 0) rem--;
    }

    // Collect sampled questions, maintaining original sections order to keep section info stable
    let collected = [];
    for (let s of sections) {
      const filter = { class: classNum, subject, chapter, section: s };
      const subs = await sampleFromSection(filter, picks[s] || 0);
      collected.push(...subs);
    }

    // If still fewer than desired (not enough in pools), fill with any available questions from chapter
    if (collected.length < total) {
      const needed = total - collected.length;
      const fallback = await Question.aggregate([
        { $match: { class: classNum, subject, chapter, section: { $in: sections } } },
        { $sample: { size: Math.min(needed, 1000) } } // cap to some sane number
      ]);
      collected.push(...fallback);
    }

    // Final shuffle and cut to requested total
    shuffleInPlace(collected);
    const final = collected.slice(0, total);

    // Strip server-only fields (answer, explanation) from payload sent to client
    const clientPayload = final.map(q => ({
      _id: q._id.toString(),
      question: q.question,
      options: q.options || [],
      caseStudy: q.caseStudy || '',
      imageUrl: q.imageUrl || '',
      section: q.section || '',
      type: q.type || '',
      difficulty: q.difficulty || ''
    }));

    return res.json({ success: true, quiz: clientPayload, total: clientPayload.length });
  } catch (err) {
    console.error('GET /api/quiz error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});



// ---------- GET: current user's recent quizzes (list) ----------
app.get('/api/recent-quizzes', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const quizzes = await RecentQuiz.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // normalize each entry to the shape frontend expects
    const normalized = quizzes.map(q => ({
      _id: q._id,
      title: `${q.subject || ''} ${q.chapter ? '- ' + q.chapter : ''}`.trim() || 'Quiz',
      score: typeof q.score === 'number' ? q.score : null,
      total: typeof q.perSection === 'object' && q.perSection.total ? q.perSection.total : null,
      startedAt: q.startedAt,
      finishedAt: q.finishedAt,
      createdAt: q.createdAt
    }));

    return res.json({ success: true, quizzes: normalized });
  } catch (err) {
    console.error('GET /api/recent-quizzes error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/recent-quizzes/:id', verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    
    const quiz = await RecentQuiz.findById(id).lean();
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz attempt not found' });

    // Optionally, if question text is missing in `quiz.questions`, populate from Question collection:
    // for each quiz.questions[i].questionId fetch Question and attach questionText/options etc.

    res.json({ success: true, quiz });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});




// GET latest quiz for authenticated user
app.get('/api/latest-quiz', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const quiz = await RecentQuiz.findOne({ userId }).sort({ createdAt: -1 }).lean();
    if (!quiz) return res.status(404).json({ success: false, message: 'No recent quiz found' });

    // Optional: populate question details if question text/options are stored elsewhere
    // If your recent_quiz already contains question text/options, skip populate.

    res.json({ success: true, quiz });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


app.get('/api/quiz-template-for-reattempt/:quizId', verifyToken, async (req, res) => {
  try {
    const id = req.params.quizId;
    const attempt = await RecentQuiz.findById(id).lean();
    if (!attempt) return res.status(404).json({ success: false, message: 'Attempt not found' });

    // assume attempt.questions[].questionId holds the original question ids
    const questionIds = attempt.questions.map(q => q.questionId).filter(Boolean);
    // fetch question docs from Question model
    const questions = await Question.find({ _id: { $in: questionIds } })
      .select('question options correctIndex section imageUrl') // choose fields you need
      .lean();

    // maintain original order using questionIds
    const ordered = questionIds.map(id => questions.find(q=>String(q._id)===String(id))).filter(Boolean);

    res.json({ success: true, quiz: { _id: attempt._id, questions: ordered } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});



app.post('/api/questions-by-ids', async (req, res) => {
  try {
    const { ids } = req.body;
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id)); // ✅ correct
    const questions = await Question.find({ _id: { $in: validIds } });
    res.json({ success: true, questions });
  } catch (err) {
    console.error('POST /api/questions-by-ids error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});






// POST /api/submit-quiz
// body: { meta: {...}, questions: [{questionId, selectedIndex, timeTakenSec}, ...] }
app.post('/api/submit-quiz',verifyToken, async (req, res) => {
 
  try {
    const userId = req.user.id;
    const { meta, questions } = req.body;
    if (!meta || !questions || !Array.isArray(questions)) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    // convert ids to ObjectId array
    
      const qIds = questions.map(q => q.questionId).filter(Boolean);

    const dbQuestions = await Question.find({ _id: { $in: qIds } }).lean();

    const map = {};
    dbQuestions.forEach(dq => { map[String(dq._id)] = dq; });

    let correctCount = 0;
    const perSection = {};
    const detailed = [];

    for (const q of questions) {
      const idStr = String(q.questionId);
      const dq = map[idStr];
      const correctAnswer = dq ? dq.answer : null;
      const explanation = dq ? dq.explanation : '';
      const section = dq ? dq.section : 'unknown';
      const selectedIndex = (typeof q.selectedIndex === 'number') ? q.selectedIndex : null;
      const correct = (correctAnswer != null && selectedIndex === correctAnswer);

      if (!perSection[section]) perSection[section] = { asked: 0, correct: 0 };
      perSection[section].asked += 1;
      if (correct) { perSection[section].correct += 1; correctCount++; }

      detailed.push({
        questionId: q.questionId,
        selectedIndex,
        correctAnswer,
        correct,
        explanation,
        timeTakenSec: q.timeTakenSec || 0,
        section
      });
    }

    const score = correctCount;

    const rq = new RecentQuiz({
      userId,
      class: meta.class || null,
      subject: meta.subject || null,
      chapter: meta.chapter || null,
      questions: detailed.map(d => ({
        questionId: d.questionId, // keep as string
        selectedIndex: d.selectedIndex,
        correctAnswer: d.correctAnswer,
        correct: d.correct,
        explanation: d.explanation,
        timeTakenSec: d.timeTakenSec,
        section: d.section
      })),
      score,
      startedAt: meta.startedAt ? new Date(meta.startedAt) : null,
      finishedAt: meta.finishedAt ? new Date(meta.finishedAt) : new Date(),
      perSection,
      rawMeta: meta
    });

    await rq.save();

    return res.json({
      success: true,
      savedId: rq._id,
      analysis: { score, perSection, total: questions.length },
      detailed
    });

  } catch (err) {
    console.error('POST /api/submit-quiz error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});



// ---------------- PROFILE ROUTES ----------------
app.get("/profile", verifyToken, async (req, res) => {
    try {
        const student = await Student.findById(req.user.id).select("-password -__v -recentQuizzes");
        if (!student) return res.status(404).json({ message: "Student not found" });

        res.json(student);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

app.put("/profile", verifyToken, async (req, res) => {
    const { fullName, parentName, grade, dob, contactNum, password, state, profileImage } = req.body;

    try {
        const student = await Student.findById(req.user.id);
        if (!student) return res.status(404).json({ message: "Student not found" });

        // Update fields
        if (fullName) student.fullName = fullName;
        if (parentName) student.parentName = parentName;
        if (grade) student.grade = grade;
        if (dob) student.dob = dob;
        if (contactNum) student.contactNum = contactNum;
        if (state) student.state = state;
        if (profileImage) student.profileImage = profileImage;

        // Hash password if updated
        if (password && password.trim() !== "") {
            const hashedPassword = await bcrypt.hash(password, 10);
            student.password = hashedPassword;
        }

        await student.save();

        res.json({
            message: "Profile updated successfully",
            student: {
                fullName: student.fullName,
                parentName: student.parentName,
                grade: student.grade,
                dob: student.dob,
                contactNum: student.contactNum,
                state: student.state,
                profileImage: student.profileImage
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

app.put('/profile/streaks', verifyToken, async (req,res) => {
  const { currentStreak, maxStreak } = req.body;
  const s = await Student.findByIdAndUpdate(req.user.id, { currentStreak, maxStreak }, { new:true });
  res.json(s);
});



// --------- Tasks endpoints ----------
app.get('/api/tasks', verifyToken, async (req, res) => {
  try {
    const tasks = await Task.find({ student: req.user.id }).sort({ createdAt: -1 }).lean();
    res.json({tasks});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/tasks', verifyToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ message: 'Task text required' });
    const t = new Task({ student: req.user.id, text: text.trim() });
    await t.save();
    res.status(201).json({ tasks: [t] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/tasks/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });
    const update = {};
    if (typeof req.body.done !== 'undefined') update.done = !!req.body.done;
    if (typeof req.body.text !== 'undefined') update.text = String(req.body.text).trim();
    const t = await Task.findOneAndUpdate({ _id: id, student: req.user.id }, update, { new: true });
    if (!t) return res.status(404).json({ message: 'Task not found' });
    res.json(t);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/tasks/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });
    const t = await Task.findOneAndDelete({ _id: id, student: req.user.id });
    if (!t) return res.status(404).json({ message: 'Task not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------- GET: leaderboard (top users by total score) ----------
app.get('/api/leaderboard', async (req, res) => {
  try {
    // Aggregate by userId summing score field (if score missing treat as 0)
    const rows = await RecentQuiz.aggregate([
      { $group: { _id: '$userId', totalScore: { $sum: { $ifNull: ['$score', 0] } } } },
      { $sort: { totalScore: -1 } },
      { $limit: 10 },
      { $lookup: {
          from: 'students',
          localField: '_id',
          foreignField: '_id',
          as: 'student'
        }
      },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, userId: '$_id', username: '$student.fullName', score: '$totalScore' } }
    ]);
    res.json({ success: true, leaderboard: rows });
  } catch (err) {
    console.error('GET /api/leaderboard error', err);
    res.status(500).json({ success:false, message:'Server error' });
  }
});







// Optional: a simple route to check server health
app.get('/api/ping', (req, res) => res.json({ success: true, now: new Date().toISOString() }));



// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
