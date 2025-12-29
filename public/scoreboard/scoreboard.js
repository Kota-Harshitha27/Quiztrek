// ---------------- CONFIG ----------------
const API_BASE = 'http://127.0.0.1:5000'; // backend base URL

// ---------------- HELPERS ----------------
function byId(id) { return document.getElementById(id); }

function setCircle(circleId, percent) {
    const circle = byId(circleId);
    if (!circle) return;
    const radius = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;
    circle.style.strokeDasharray = `${circumference}`;
    circle.style.strokeDashoffset = offset;
}

function qsParam(name){
  const u = new URL(location.href);
  return u.searchParams.get(name);
}

async function fetchJsonWithAuth(url, opts = {}) {
  opts.headers = opts.headers || {};
  const token = localStorage.getItem('token');
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, opts);
  // log response status for debugging
  console.log('[fetch] ', url, 'status=', res.status);
  if (!res.ok) {
    const text = await res.text().catch(()=>'<no body>');
    const err = new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
    err.status = res.status;
    throw err;
  }
  return res.json().catch(()=>{ throw new Error('Invalid JSON in response'); });
}

let lastFetchedQuiz = null;

async function fetchAndPopulateScoreboard() {
  try {
    // determine quizId param if provided
    const quizId = qsParam('quizId');
    let data = null;

    if (quizId) {
      console.log('Fetching specific attempt by id:', quizId);
      data = await fetchJsonWithAuth(`${API_BASE}/api/recent-quizzes/${encodeURIComponent(quizId)}`);
      // server might return { success:true, quiz: {...} } or {...}
      console.log("fetchjsonwithauth: ",data);
      if (data.quiz) data = data.quiz;
    } else {
      console.log('No quizId in URL — fetching latest attempt');
      const res = await fetchJsonWithAuth(`${API_BASE}/api/latest-quiz`);
      // res might be { success:true, quiz: {...} } or direct quiz object
      data = res.quiz ? res.quiz : res;
    }

    console.log('Server returned quiz object:', data);

    if (!data || !Array.isArray(data.questions) || data.questions.length === 0) {
      // show something in UI and log
      console.warn('Quiz data is missing or questions array empty:', data);
      byId('totalQ').innerText = '0';
      byId('attempted').innerText = '0';
      byId('correct').innerText = '0';
      byId('wrong').innerText = '0';
      byId('totalScore').innerText = '0';
      // optionally show a message to user
      const reviewSection = byId('reviewSection');
      if (reviewSection) {
        reviewSection.style.display = 'block';
        const rc = byId('reviewContent');
        if (rc) rc.innerHTML = '<div class="question-box">No quiz data available to display.</div>';
      }
      return;
    }

    // normalize each question to expected shape
    data.questions = data.questions.map(q => ({
      questionId: q.questionId || q._id || q.id,
      questionText: q.questionText || q.question || q.text,
      options: q.options || q.choices || q.opts || [],
      selectedIndex: (q.selectedIndex !== undefined ? q.selectedIndex : (q.selected !== undefined ? q.selected : null)),
        correctIndex: (q.correctAnswer !== undefined ? q.correctAnswer : (q.correctIndex !== undefined ? q.correctIndex : null)), // add this
      correctAnswer: (q.correctAnswer !== undefined ? q.correctAnswer : (q.correctIndex !== undefined ? q.correctIndex : null)),
      correct: (typeof q.correct === 'boolean' ? q.correct : undefined),
      explanation: q.explanation || q.explain || '',
      timeTakenSec: q.timeTakenSec || q.timeTaken || 0,
      section: q.section || (q.raw && q.raw.section) || 'unknown'
    }));

    lastFetchedQuiz = {
    ...data,
    _id: String(data._id || data.id)
    };
    populateScoreboard(data); // call your existing populate function
  } catch (err) {
    console.error('Error loading quiz for scoreboard:', err);
    alert('Could not load scoreboard: ' + (err.message || err));
  }
}


async function fetchLatestQuizAndPopulate() {
  try {
    const data = await fetchJson(`${API_BASE}/api/latest-quiz`);
    const quiz = data.quiz || data;
    if (!quiz) throw new Error('No quiz found');

    lastFetchedQuiz = quiz;               // keep in memory only
    //await ensureQuestionDetailsForDisplay(quiz); // optional if you need question text
    populateScoreboard(quiz);
  } catch (err) {
    alert('Could not load recent quiz: ' + err.message);
  }
}
async function fetchLatestQuiz() {
  return fetchAndPopulateScoreboard();
}


function populateScoreboard(quiz) {
    const total = 10;
    const attempted = quiz.questions.filter(q => q.selectedIndex !== null).length || 0;
    const correct = quiz.questions.filter(q => q.selectedIndex === q.correctAnswer).length;
    const wrong = attempted - correct;

    byId('totalQ').innerText = total;
    byId('attempted').innerText = attempted;
    byId('correct').innerText = correct;
    byId('wrong').innerText = wrong;
    byId('totalScore').innerText = correct;

    // section-wise percentages
    const sections = {
  memorize: { correct: 0, total: 0 },
  critical: { correct: 0, total: 0 },
  application: { correct: 0, total: 0 }
};

// count correct answers per section
quiz.questions.forEach(q => {
  if (!sections[q.section]) return;
  sections[q.section].total++;
  if (q.selectedIndex === q.correctIndex) sections[q.section].correct++;
});

// update circles
for (const sec of ['memorize', 'critical', 'application']) {
  const pct = sections[sec].total ? (sections[sec].correct / sections[sec].total) * 100 : 0;
  setCircle(sec, pct); // pass the ID of the circle <circle> element
  document.getElementById(`${sec}Score`).innerText = `${Math.round(pct)}%`;
}

    // store quiz for explanation & reattempt
    sessionStorage.setItem('lastQuiz', JSON.stringify(quiz));
}

// ---------------- BUTTONS ----------------
byId('explainBtn').addEventListener('click', () => {
  if (!lastFetchedQuiz || !lastFetchedQuiz._id) return alert('No quiz to explain.');
  window.location.href = `/quiz-page/quizpage.html?explain=true&quizId=${lastFetchedQuiz._id}`;
});

byId('retryBtn').addEventListener('click', () => {
  if (!lastFetchedQuiz || !lastFetchedQuiz._id) return alert('No quiz to reattempt.');
  console.log(lastFetchedQuiz._id);
  window.location.href = `/quiz-page/quizpage.html?reattempt=true&quizId=${lastFetchedQuiz._id}`;
});


byId('homeBtn').addEventListener('click', () => {
    window.location.href = '/home/home.html';
});

console.log("In scoreboard.js");

// ---------------- INIT ----------------
document.addEventListener('DOMContentLoaded', fetchAndPopulateScoreboard);
