import { getPlanet, getQuestions } from './knowledge.js';
import { startQuiz } from './quizEngine.js';

// ── HTML template ──────────────────────────────────────────────────────
const PANEL_HTML = `
  <div class="ic-overlay" id="ic-overlay"></div>
  <div class="ic-panel" id="ic-panel">
    <button class="ic-close" id="ic-close">✕</button>
    <div class="ic-header" id="ic-header"></div>
    <div class="ic-tabs">
      <button class="ic-tab active" data-tab="overview">概览</button>
      <button class="ic-tab" data-tab="detail">详情</button>
    </div>
    <div class="ic-body">
      <div class="ic-tab-content active" id="ic-overview"></div>
      <div class="ic-tab-content" id="ic-detail"></div>
    </div>
    <div class="ic-footer">
      <button class="ic-quiz-btn" id="ic-quiz-btn">❓ 知识挑战</button>
    </div>
  </div>
`;

let activeBodyId = null;

// ── Format helpers ─────────────────────────────────────────────────────
function fmtMass(m) {
    if (m >= 1e27) return (m / 1e27).toFixed(3) + ' × 10²⁷ kg';
    if (m >= 1e24) return (m / 1e24).toFixed(3) + ' × 10²⁴ kg';
    if (m >= 1e23) return (m / 1e23).toFixed(3) + ' × 10²³ kg';
    if (m >= 1e20) return (m / 1e20).toFixed(3) + ' × 10²⁰ kg';
    return m.toExponential(3) + ' kg';
}

function fmtTemp(t) {
    if (t.min === t.max) return t.mean + '°C';
    return t.min + ' ~ ' + t.max + '°C';
}

function fmtAU(au) {
    if (au === 0) return '—';
    return au.toFixed(4) + ' AU';
}

function fmtDays(d) {
    if (d === 0) return '—';
    if (Math.abs(d) < 1) return (Math.abs(d) * 24).toFixed(1) + ' 小时';
    const val = Math.abs(d).toFixed(d < 10 ? 3 : (d < 1000 ? 2 : (d < 10000 ? 1 : 0)));
    if (d < 0) return val + ' 天（逆向）';
    return val + ' 天';
}

function fmtMoons(count) {
    if (count === null) return '—';
    return String(count);
}

// ── Build overview tab content ─────────────────────────────────────────
function overviewHTML(body) {
    return `
      <table class="ic-datatable">
        <tr><td class="ic-label">半径</td><td class="ic-val">${body.radius.toLocaleString()} km</td></tr>
        <tr><td class="ic-label">质量</td><td class="ic-val">${fmtMass(body.mass)}</td></tr>
        <tr><td class="ic-label">密度</td><td class="ic-val">${body.density} g/cm³</td></tr>
        <tr><td class="ic-label">距太阳</td><td class="ic-val">${fmtAU(body.orbitA)}</td></tr>
        <tr><td class="ic-label">公转周期</td><td class="ic-val">${fmtDays(body.period)}</td></tr>
        <tr><td class="ic-label">自转周期</td><td class="ic-val">${fmtDays(body.rotPeriod)}</td></tr>
        <tr><td class="ic-label">表面温度</td><td class="ic-val">${fmtTemp(body.surfaceTemp)}</td></tr>
        <tr><td class="ic-label">大气成分</td><td class="ic-val">${body.atmosphere}</td></tr>
        <tr><td class="ic-label">卫星数量</td><td class="ic-val">${fmtMoons(body.moons)}</td></tr>
      </table>
      <div class="ic-funfact">💡 ${body.funFact}</div>
      <div class="ic-source">来源：${body.source}</div>
    `;
}

// ── Build detail tab content ───────────────────────────────────────────
function detailHTML(body) {
    return `<div class="ic-detail-text">${body.detail}</div>`;
}

// ── Inject panel into DOM ──────────────────────────────────────────────
function ensurePanel() {
    if (document.getElementById('ic-panel')) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = PANEL_HTML;
    while (wrapper.firstElementChild) {
        document.body.appendChild(wrapper.firstElementChild);
    }

    // Events
    document.getElementById('ic-close').addEventListener('click', closeCard);
    document.getElementById('ic-overlay').addEventListener('click', closeCard);

    // Tab switching
    document.querySelectorAll('.ic-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ic-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.ic-tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            document.getElementById('ic-' + tab).classList.add('active');
        });
    });

    // Quiz button
    document.getElementById('ic-quiz-btn').addEventListener('click', () => {
        if (activeBodyId) {
            startQuiz({ bodyId: activeBodyId,
                title: document.getElementById('ic-name')?.textContent || '知识挑战' });
        }
    });
}

// ── Open card for a body ────────────────────────────────────────────────
export function selectBody(bodyId) {
    const body = getPlanet(bodyId);
    if (!body) return;

    activeBodyId = bodyId;
    ensurePanel();

    const panel = document.getElementById('ic-panel');
    panel.classList.add('visible');
    document.getElementById('ic-overlay').classList.add('visible');

    // Header
    const colorHex = '#' + body.color.toString(16).padStart(6, '0');
    document.getElementById('ic-header').innerHTML = `
      <span class="ic-color-dot" style="background:${colorHex}"></span>
      <span class="ic-name">${body.symbol} ${body.name}</span>
      <span class="ic-english">${body.english}</span>
    `;

    // Tab content
    document.getElementById('ic-overview').innerHTML = overviewHTML(body);
    document.getElementById('ic-detail').innerHTML = detailHTML(body);

    // Reset to Overview tab
    document.querySelectorAll('.ic-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.ic-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.ic-tab[data-tab="overview"]').classList.add('active');
    document.getElementById('ic-overview').classList.add('active');
}

// ── Close card ─────────────────────────────────────────────────────────
export function closeCard() {
    activeBodyId = null;
    const panel = document.getElementById('ic-panel');
    const overlay = document.getElementById('ic-overlay');
    if (panel) panel.classList.remove('visible');
    if (overlay) overlay.classList.remove('visible');
}
