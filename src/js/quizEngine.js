import { getRandomQuestion, getQuestions } from './knowledge.js';
import { recordAnswer } from './storage.js';
import { sfx } from './sfx.js';
import { t, getLang, onLangChange } from './i18n.js';

let activeQuestions = [];
let currentIndex = 0;
let correctCount = 0;
let answeredCount = 0;
let isAnswered = false;
let quizTitleMode = 'title';

// ── HTML template (函数式，每次打开时取当前语言) ───────────────────
function buildQuizHTML() {
  return `
  <div class="qz-overlay" id="qz-overlay"></div>
  <div class="qz-card" id="qz-card">
    <div class="qz-header">
      <span class="qz-title" id="qz-title">${t('quiz.title')}</span>
      <span class="qz-score" id="qz-score">0/0</span>
      <button class="qz-close" id="qz-close">✕</button>
    </div>
    <div class="qz-body">
      <div class="qz-question" id="qz-question"></div>
      <div class="qz-options" id="qz-options"></div>
      <div class="qz-feedback" id="qz-feedback" style="display:none">
        <div class="qz-explain" id="qz-explain"></div>
        <button class="qz-next-btn" id="qz-next-btn">${t('quiz.next')}</button>
      </div>
    </div>
  </div>
`;
}

// ── DOM injection ──────────────────────────────────────────────────────
function ensureQuizDOM() {
    if (document.getElementById('qz-overlay')) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildQuizHTML();
    while (wrapper.firstElementChild) {
        document.body.appendChild(wrapper.firstElementChild);
    }

    document.getElementById('qz-close').addEventListener('click', closeQuiz);
    document.getElementById('qz-overlay').addEventListener('click', closeQuiz);
    document.getElementById('qz-next-btn').addEventListener('click', nextQuestion);

    // 语言切换时更新UI
    const updateQuizTexts = () => {
        const title = document.getElementById('qz-title');
        title.textContent = quizTitleMode === 'random' ? t('quiz.random') : t('quiz.title');
        document.getElementById('qz-next-btn').textContent = currentIndex >= activeQuestions.length - 1 ? t('quiz.finish') : t('quiz.next');
    };
    onLangChange(updateQuizTexts);
}

// ── Show current question ──────────────────────────────────────────────
function renderQuestion() {
    const q = activeQuestions[currentIndex];
    if (!q) { closeQuiz(); return; }

    isAnswered = false;

    document.getElementById('qz-question').textContent = q.question;

    // Update score
    document.getElementById('qz-score').textContent =
        answeredCount + '/' + activeQuestions.length;

    // Build options
    const optContainer = document.getElementById('qz-options');
    optContainer.innerHTML = q.options.map((opt, i) =>
        `<button class="qz-opt" data-idx="${i}">${opt}</button>`
    ).join('');
    optContainer.style.display = '';

    // Wire option clicks
    optContainer.querySelectorAll('.qz-opt').forEach(btn => {
        btn.addEventListener('click', () => onAnswer(parseInt(btn.dataset.idx)));
    });

    // Hide feedback
    const fb = document.getElementById('qz-feedback');
    fb.style.display = 'none';
}

// ── Handle answer ──────────────────────────────────────────────────────
function onAnswer(idx) {
    if (isAnswered) return;
    isAnswered = true;
    answeredCount++;

    const q = activeQuestions[currentIndex];
    const isCorrect = idx === q.answer;

    if (isCorrect) correctCount++;

    recordAnswer(isCorrect);

    // SFX
    if (isCorrect) {
        sfx.quizCorrect();
    } else {
        sfx.quizWrong();
    }

    // Phase 2: trigger quest/achievement events
    if (window.__questEngine) {
        window.__questEngine.trigger('quiz_answer', { correct: isCorrect, streak: correctCount });
    }
    if (window.__achievement) {
        window.__achievement.evaluate();
    }

    // Highlight options
    document.querySelectorAll('.qz-opt').forEach((btn, i) => {
        btn.disabled = true;
        if (i === q.answer) btn.classList.add('qz-correct');
        else if (i === idx && !isCorrect) btn.classList.add('qz-wrong');
    });

    // Show feedback
    const fb = document.getElementById('qz-feedback');
    const explain = document.getElementById('qz-explain');
    explain.innerHTML = `
      <div class="qz-result ${isCorrect ? 'qz-result-correct' : 'qz-result-wrong'}">
        ${isCorrect ? t('quiz.correct') : t('quiz.wrong')}
      </div>
      <div class="qz-explain-text">${q.explanation}</div>
    `;
    fb.style.display = 'block';

    // Update score
    document.getElementById('qz-score').textContent =
        answeredCount + '/' + activeQuestions.length;

    // Last question? Change button text
    const nextBtn = document.getElementById('qz-next-btn');
    if (currentIndex >= activeQuestions.length - 1) {
        nextBtn.textContent = t('quiz.finish');
    } else {
        nextBtn.textContent = t('quiz.next');
    }
}

// ── Next question / finish ─────────────────────────────────────────────
function nextQuestion() {
    if (currentIndex >= activeQuestions.length - 1) {
        closeQuiz();
        return;
    }
    currentIndex++;
    renderQuestion();
}

// ── 双语适配：根据当前语言选用 question/options/explanation ─────────
function localizeQuestions(pool) {
    const lang = getLang();
    if (lang !== 'en-US') return pool;
    return pool.map(q => ({
        ...q,
        question: q.questionEn || q.question,
        options: q.optionsEn || q.options,
        explanation: q.explanationEn || q.explanation,
    }));
}

// ── Start quiz ─────────────────────────────────────────────────────────
export function startQuiz(opts = {}) {
    // opts: { title?, questions?, bodyId?, level?, count? }
    ensureQuizDOM();

    let pool;
    if (opts.questions) {
        pool = localizeQuestions(opts.questions);
    } else if (opts.bodyId) {
        pool = localizeQuestions(getQuestions({ relatedBody: opts.bodyId, shuffle: true }));
    } else {
        pool = localizeQuestions(getQuestions({ shuffle: true, level: opts.level }));
    }

    // Limit count
    if (opts.count && pool.length > opts.count) {
        pool = pool.slice(0, opts.count);
    }

    if (pool.length === 0) {
        if (opts.bodyId) {
            alert(t('quiz.noQuestionsBody'));
        } else {
            alert(t('quiz.noQuestions'));
        }
        return;
    }

    activeQuestions = pool;
    currentIndex = 0;
    correctCount = 0;
    answeredCount = 0;

    document.getElementById('qz-card').classList.add('visible');
    document.getElementById('qz-overlay').classList.add('visible');

    if (opts.title) {
        document.getElementById('qz-title').textContent = opts.title;
        quizTitleMode = 'title';
    } else if (opts.bodyId) {
        document.getElementById('qz-title').textContent = t('quiz.title');
        quizTitleMode = 'title';
    } else {
        document.getElementById('qz-title').textContent = t('quiz.random');
        quizTitleMode = 'random';
    }

    renderQuestion();
}

// ── Close quiz ─────────────────────────────────────────────────────────
export function closeQuiz() {
    document.getElementById('qz-card').classList.remove('visible');
    document.getElementById('qz-overlay').classList.remove('visible');
}
