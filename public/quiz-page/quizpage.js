// quiz-page.js
// Frontend script for quiz page. Place next to quizpage.html and load it via <script src="quiz-page.js"></script>

// ---------------- CONFIG ----------------
const API_BASE = 'http://127.0.0.1:5000'; // backend origin (port 5000)


// ---------------- HELPERS ----------------
function byId(id){ return document.getElementById(id); }

function qsParam(name){
  const u = new URL(location.href);
  return u.searchParams.get(name);
}


function shuffleArray(a){
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random() * (i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

// Better fetch helper for debugging
async function fetchJsonOrThrow(url, options){
  console.log('[fetch] Requesting URL:', url, options || {});
  const resp = await fetch(url, options);
  if (!resp.ok) {
    let body = '';
    try { body = await resp.text(); } catch(e) { body = '<unreadable body>'; }
    const err = new Error(`Fetch failed: ${resp.status} ${resp.statusText} - ${body}`);
    err.status = resp.status;
    err.body = body;
    throw err;
  }
  return resp.json();
}
async function fetchJsonOrThrow(url, options){
  const resp = await fetch(url, options);
  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) {
      // token missing/invalid -> force re-login
      alert('Session expired or not authenticated. Please login again.');
      localStorage.removeItem('token');
      window.location.href = '/login.html';
      throw new Error('Unauthorized');
    }
    let body = await resp.text().catch(()=>'<unreadable>');
    throw new Error(`Fetch failed: ${resp.status} ${resp.statusText} - ${body}`);
  }
  return resp.json();
}
// ---------------- STATE ----------------
const TOTAL_QUESTIONS = 10;
const meta = {
  class: Number(qsParam('class') || qsParam('cls') || null),
  subject: qsParam('subject') || null,
  chapter: qsParam('chapter') || null
};

const state = {
  questions: [],
  currentIndex: 0,
  answers: [],
  questionStartTs: null,
  quizStartedAt: null,
  quizEndTs: null,        // timestamp when quiz ends
  remainingTimeSec: 0,    // remaining seconds
  timerInterval: null     // store interval ID
};

// ---------------- UI ELEMENTS (IDs must match quizpage.html) ----------------
const lessonEl = byId('lessonname');
const numberEl = byId('qNumber');
const numberEl2 = byId('number');
const questionEl = byId('question');
const caseEl = byId('casestudy');
const qImage = byId('qimage');
const optionLabels = [
  byId('option1'),
  byId('option2'),
  byId('option3'),
  byId('option4')
];
const optionRadios = [
  byId('0'),
  byId('1'),
  byId('2'),
  byId('3')
];
const prevBtn = byId('prevBtn');
const nextBtn = byId('nextBtn');
const quitBtn = byId('quitBtn');
const timerEl = byId('timer'); // optional

// If some elements are missing, allow graceful fallback
function ensureUI(){
  // If your HTML uses different IDs, adapt here.
  // This function intentionally left simple.
}

// ---------------- RENDERING ----------------
function updateHeader(){
  if (lessonEl && meta.class && meta.subject && meta.chapter) {
    lessonEl.textContent = `Class ${meta.class} · ${meta.subject} · ${meta.chapter}`;
  }
}

function updateTimer() {
  const now = Date.now();
  state.remainingTimeSec = Math.max(0, Math.round((state.quizEndTs - now) / 1000));

  if (timerEl) {
    const min = Math.floor(state.remainingTimeSec / 60).toString().padStart(2, '0');
    const sec = (state.remainingTimeSec % 60).toString().padStart(2, '0');
    timerEl.textContent = `${min}:${sec}`;
  }

  // If time is up, submit automatically
  if (state.remainingTimeSec <= 0) {
    clearInterval(state.timerInterval);
    alert("Time's up! Quiz will be submitted automatically.");
    submitQuiz(true);
  }
}


function renderQuestion(){
  const idx = state.currentIndex;
  const q = state.questions[idx];
  console.log(q);
  if (!q) return;

  if (numberEl) numberEl.textContent = `${idx + 1} / ${state.questions.length}`;
  if (caseEl) caseEl.textContent = q.caseStudy || '';
  if (questionEl) questionEl.textContent = q.question || '';
  
  if (q.imageUrl && q.imageUrl.length > 0 && qImage) {
    console.log("InqImage");
    
    
    q.imageUrl = "/img-proxy?url=https://drive.google.com/uc?export=download&id=1Gv8NhfqNad_Si2J6ap5C8J-gYApu9o6w";
    qImage.src = q.imageUrl;
    console.log(qImage.src);
    qImage.style.display = 'block';
  } else if (qImage) {
    qImage.style.display = 'none';
  }

  // fill options
  for (let i = 0; i < 4; i++){
    optionLabels[i] && (optionLabels[i].textContent = q.options && q.options[i] ? q.options[i] : '');
    if (optionRadios[i]) {
      optionRadios[i].checked = (state.answers[idx] && state.answers[idx].selectedIndex === i);
      optionRadios[i].disabled = false;
      optionRadios[i].value = String(i);
    }
  }

  // buttons
  if (prevBtn) prevBtn.disabled = (idx === 0);
  if (nextBtn) nextBtn.textContent = (idx === state.questions.length - 1) ? 'Submit' : 'Next';

  // reset timer for question
  state.questionStartTs = Date.now();
}


//--------Extra part added --------------



// fetch saved attempt by id
async function loadAttemptById(quizId) {
  const token = localStorage.getItem('token');
  const resp = await fetch(`${API_BASE}/api/recent-quizzes/${quizId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!resp.ok) throw new Error('Failed to load attempt');
  const data = await resp.json();
  console.log("Attempted by load",data);
  return data.quiz || data;
}

// fetch template for reattempt
async function loadQuizTemplateForReattempt(quizId) {
  const token = localStorage.getItem('token');
  const resp = await fetch(`${API_BASE}/api/quiz-template-for-reattempt/${quizId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!resp.ok) throw new Error('Failed to load quiz template');
  const data = await resp.json();
  return data.quiz || data;
}

function renderQuestionInExplainMode() {
  quitBtn.disabled=true;
  const idx = state.currentIndex;
  const q = state.questions[idx];
  if (!q) return;

  // Question number
  if (numberEl) numberEl.textContent = `${idx + 1} / ${state.questions.length}`;
  if (questionEl) questionEl.textContent = q.question || '';
  if(caseEl)caseEl.textContent=q.caseStudy || '';
  // Question image
  if (q.imageUrl && q.imageUrl.length && qImage) {
    qImage.src = q.imageUrl;
    qImage.style.display = 'block';
  } else if (qImage) {
    qImage.style.display = 'none';
  }

  // Render options and highlight correct/wrong
  for (let i = 0; i < 4; i++) {
    const lbl = optionLabels[i];
    const optText = q.options && q.options[i] ? q.options[i] : '';

    if (lbl) {
      lbl.textContent = optText;
      lbl.style.background = '';
      lbl.style.border = '';
      lbl.style.color = '';
      lbl.style.pointerEvents = 'none'; // disable clicking
    }

    // Disable radios in explain mode
    if (optionRadios[i]) {
      optionRadios[i].checked = false;
      optionRadios[i].disabled = true;
    }

    const isCorrect = (q.correctIndex !== null && Number(q.correctIndex) === i);
    const userPicked = (q.selectedIndex !== null && Number(q.selectedIndex) === i);

    if (lbl) {
      if (isCorrect) {
        lbl.style.background = '#e6ffed'; // light green
        lbl.style.border = '1px solid #2ecc71';
      } else if (userPicked && !isCorrect) {
        lbl.style.background = '#ffecec'; // light red
        lbl.style.border = '1px solid #e74c3c';
      } else {
        lbl.style.background = 'transparent';
        lbl.style.border = '1px solid transparent';
      }
    }
  }

  // Show explanation box
  const reviewSection = byId('reviewSection');
  const reviewContent = byId('reviewContent');
  if (reviewSection && reviewContent) {
    reviewSection.style.display = 'block';
    reviewContent.innerHTML = `
      <div class="question-box">
        <div><strong>Explanation:</strong></div>
        <div style="margin-top:6px">${q.explanation || 'No explanation available.'}</div>
      </div>
    `;
  }

  // Previous / Next buttons
  if (prevBtn) prevBtn.disabled = (idx === 0);
  if (nextBtn) nextBtn.textContent = (idx === state.questions.length - 1) ? 'Done' : 'Next';

  // Re-bind navigation handlers only once outside render in initExplainMode
  // (so you don't overwrite main quiz listeners)
}


  /* if (prevBtn) prevBtn.disabled = (idx === 0);
  if (nextBtn) nextBtn.textContent = (idx === state.questions.length - 1) ? 'Done' : 'Next';
 */




//--------Extra part ended --------------







// ---------------- NAVIGATION & ANSWER RECORDING ----------------
function saveCurrentAnswer(){
  const idx = state.currentIndex;
  if (idx == null || !state.questions[idx]) return;
  const start = state.questionStartTs || Date.now();
  const elapsed = Math.round((Date.now() - start) / 1000);
  state.answers[idx].timeTakenSec += elapsed;

  const selRadio = optionRadios.find(r => r && r.checked);
  state.answers[idx].selectedIndex = selRadio ? Number(selRadio.value) : null;
  state.questionStartTs = Date.now();
}

if (prevBtn) prevBtn.addEventListener('click', () => {
  //if (numberEl) numberEl.textContent = `${state.currentIndex - 1} / ${state.questions.length}`;
  /* const explainMode = qsParam('explain') === 'true';
  if (explainMode) {
    // change currentIndex then call renderQuestionInExplainMode()
    state.currentIndex = Math.max(0, state.currentIndex - 1);
    renderQuestionInExplainMode();
    return;
  } */

  numberEl2.textContent=state.currentIndex;
  saveCurrentAnswer();
  if (state.currentIndex > 0) {
    state.currentIndex--;
    renderQuestion();
  }
});

if (nextBtn) nextBtn.addEventListener('click', async () => {
   numberEl2.textContent=state.currentIndex+2;
  //if (numberEl) numberEl.textContent = `${state.currentIndex + 1} / ${state.questions.length}`;
  /* const explainMode = qsParam('explain') === 'true';
  if (explainMode) {
    // change currentIndex then call renderQuestionInExplainMode()
    state.currentIndex = Math.max(0, state.currentIndex - 1);
    renderQuestionInExplainMode();
    return;
  } */
  saveCurrentAnswer();
  if (state.currentIndex === state.questions.length - 1) {
    await submitQuiz();
  } else {
    state.currentIndex++;
    renderQuestion();
  }
});

if (quitBtn) quitBtn.addEventListener('click', async () => {
  if (confirm('Quit quiz? Your answers will be submitted.')) {
    saveCurrentAnswer();
    await submitQuiz(true);
  }
});

// update answer on change (record selection immediately)
optionRadios.forEach(r => r && r.addEventListener('change', () => {
  const idx = state.currentIndex;
  const elapsed = Math.round((Date.now() - (state.questionStartTs || Date.now())) / 1000);
  state.answers[idx].timeTakenSec += elapsed;
  state.answers[idx].selectedIndex = Number(r.value);
  state.questionStartTs = Date.now();
  // optional: auto-next - commented out:
  // if (state.currentIndex < state.questions.length - 1) { state.currentIndex++; renderQuestion(); }
}));

// ---------------- LOAD QUIZ ----------------
async function loadQuiz(){
  if (!meta.class || !meta.subject || !meta.chapter){
    alert('Missing class/subject/chapter in URL. e.g. quizpage.html?class=6&subject=Maths&chapter=Chapter1');
    return;
  }

  try {
    const qparams = new URLSearchParams({
      class: meta.class,
      subject: meta.subject,
      chapter: meta.chapter,
      total: String(TOTAL_QUESTIONS)
    });
    const url = `${API_BASE}/api/quiz?${qparams.toString()}`;

    const payload = await fetchJsonOrThrow(url);
    //if (!payload.success) throw new Error(payload.error || 'Failed to load quiz');

     console.log("Fetched questions:", payload);

      if (/* !Array.isArray(payload) ||  */payload.length === 0) {
        alert("No questions available for this chapter. Please check data in DB.");
        return;
      }

      state.questions = payload.quiz;
    
    // initialize answers
    state.answers = state.questions.map(q => ({ questionId: q._id, selectedIndex: null, timeTakenSec: 0 }));
    state.currentIndex = 0;
    state.quizStartedAt = new Date().toISOString();
    state.remainingTimeSec = 10 * 60;
    state.quizEndTs = Date.now() + state.remainingTimeSec * 1000;

    // start countdown interval
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(updateTimer, 1000);
    updateTimer();

    updateHeader();
    renderQuestion();

  } catch (err) {
    console.error('loadQuiz error:', err);
    alert('Could not load quiz: ' + err.message);
  }
}

// ---------------- SUBMIT QUIZ ----------------
async function submitQuiz(isQuit=false){
  try {
    if (state.timerInterval) {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
}

    saveCurrentAnswer();

    const payload = {
      meta: {
        class: meta.class,
        subject: meta.subject,
        chapter: meta.chapter,
        totalQuestions: state.questions.length,
        startedAt: state.quizStartedAt,
        finishedAt: new Date().toISOString(),
        quit: !!isQuit
      },
      questions: state.answers.map(a => ({
        questionId: a.questionId,
        selectedIndex: a.selectedIndex,
        timeTakenSec: a.timeTakenSec
      }))
    };
    const token = localStorage.getItem('token');
    if (!token) {
      alert('You are not logged in. Please login to submit the quiz.');
      // optionally: redirect to login page
      window.location.href = `/login/login.html`;
      return;
    }

    const url = `${API_BASE}/api/submit-quiz`;
    const resp = await fetchJsonOrThrow(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!resp.success) throw new Error(resp.error || 'Submit failed');


     const quizId = resp.quizId || resp.id || resp._id;
    const analysis = resp.analysis || {};
    const score = analysis.score ?? 'N/A';

    // redirect to the scoreboard using absolute path and pass quizId in query
    if (quizId) {
      // absolute path ensures browser won't request a relative path like /quiz-page/scoreboard.html
      window.location.href = `/scoreboard/scoreboard.html?quizId=${encodeURIComponent(quizId)}`;
    } else {
      // fallback: go to latest scoreboard (server-side latest lookup)
      window.location.href = `/scoreboard/scoreboard.html`;
    }
    //alert(`Quiz submitted. Score: ${score}/${state.questions.length}`);
    console.log('Full result (server):', resp);

    // disable controls to prevent resubmit
    if (nextBtn) nextBtn.disabled = true;
    if (prevBtn) prevBtn.disabled = true;
  } catch (err) {
    console.error('submitQuiz error:', err);
    alert('Submit failed: ' + err.message);
  }
}

// ---------------- BOOTSTRAP ----------------
// wrap startup in an async IIFE so we can use await safely
/* window.addEventListener('load', () => {
  (async () => {
    ensureUI();
    await loadQuiz();
  })();
});
 */


window.addEventListener('load', () => {
  (async () => {
    ensureUI();
    const explain = qsParam('explain') === 'true';
    const reattempt = qsParam('reattempt') === 'true';
    const quizId = qsParam('quizId') || null;

    if (explain && quizId) {
  try {
    const attempt = await loadAttemptById(quizId);

    // fetch full questions from backend
    const questionIds = (attempt.questions || []).map(q => q.questionId).filter(Boolean);
    const token = localStorage.getItem('token');
    const questionsResp = await fetchJsonOrThrow(`${API_BASE}/api/questions-by-ids`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ ids: questionIds })
    });

    const fullQuestions = questionsResp.questions || [];

    state.questions = (attempt.questions || []).map(q => {
      const fullQ = fullQuestions.find(fq => fq._id === q.questionId);
      return {
        _id: q.questionId,
        question: fullQ?.question || '[no text]',
        options: fullQ?.options || ['','','',''],
        correctIndex: (q.correctAnswer !== undefined) ? q.correctAnswer : (fullQ?.correctIndex ?? null),
        selectedIndex: q.selectedIndex,
        explanation: fullQ?.explanation || 'No explanation available',
        imageUrl: fullQ?.imageUrl || ''
      };
    });

    state.currentIndex = 0;

    // --- ADD EXPLAIN MODE BUTTON HANDLERS HERE ---
    if (nextBtn) nextBtn.onclick = () => {
      if (state.currentIndex < state.questions.length - 1) {
        state.currentIndex++;
        renderQuestionInExplainMode();
      } else {
        window.location.href = '/scoreboard/scoreboard.html';
      }
    };
    if (prevBtn) prevBtn.onclick = () => {
      if (state.currentIndex > 0) {
        state.currentIndex--;
        renderQuestionInExplainMode();
      }
    };

    // now render first question in explain mode
    renderQuestionInExplainMode();
    return;

  } catch (err) {
    console.error(err);
    alert('Could not load explanation: ' + err.message);
    return;
  }
}

    // Reattempt path
    if (reattempt && quizId) {
      try {
        const template = await loadQuizTemplateForReattempt(quizId);

        state.questions = (template.questions || []).map(q => ({
          _id: q._id,
          question: q.question || q.questionText,
          options: q.options || q.choices || ['','','',''],
          correctIndex: q.correctIndex !== undefined ? q.correctIndex : (q.correctAnswer ?? null),
          section: q.section || 'unknown',
          imageUrl: q.imageUrl || ''
        }));

        // reset answers
        state.answers = state.questions.map(q => ({ questionId: q._id, selectedIndex: null, timeTakenSec: 0 }));
        state.currentIndex = 0;
        state.quizStartedAt = new Date().toISOString();
        state.remainingTimeSec = 10 * 60; // 10 min for example
        state.quizEndTs = Date.now() + state.remainingTimeSec * 1000;

        if (state.timerInterval) clearInterval(state.timerInterval);
        state.timerInterval = setInterval(updateTimer, 1000);
        updateTimer();

        updateHeader();
        renderQuestion();
        return;
      } catch (err) {
        console.error(err);
        alert('Could not start reattempt: ' + err.message);
        return;
      }
    }

    // Default path: load new quiz
    await loadQuiz();

  })();
});