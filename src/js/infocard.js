import { getPlanet, getAllPlanets, getQuestions } from './knowledge.js';
import { startQuiz } from './quizEngine.js';
import { sfx } from './sfx.js';

// ── HTML template ──────────────────────────────────────────────────────
const PANEL_HTML = `
  <div class="ic-overlay" id="ic-overlay"></div>
  <div class="ic-panel" id="ic-panel">
    <button class="ic-close" id="ic-close">✕</button>
    <div class="ic-header" id="ic-header"></div>
    <div class="ic-tabs">
      <button class="ic-tab active" data-tab="overview">概览</button>
      <button class="ic-tab" data-tab="detail">详情</button>
      <button class="ic-tab" data-tab="compare" id="ic-tab-compare">比较</button>
    </div>
    <div class="ic-body">
      <div class="ic-tab-content active" id="ic-overview"></div>
      <div class="ic-tab-content" id="ic-detail"></div>
      <div class="ic-tab-content" id="ic-compare"></div>
    </div>
    <div class="ic-footer">
      <button class="ic-quiz-btn" id="ic-quiz-btn">❓ 知识挑战</button>
    </div>
  </div>
`;

let activeBodyId = null;
let compareBodyId = null;

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

function fmtRadius(r) {
    return r.toLocaleString() + ' km';
}

// ── Texture path ───────────────────────────────────────────────────────
const TEXTURE_MAP = {
    sun: '/textures/2k_sun.jpg',
    mercury: '/textures/2k_mercury.jpg',
    venus: '/textures/2k_venus_surface.jpg',
    earth: '/textures/2k_earth_daymap.jpg',
    mars: '/textures/2k_mars.jpg',
    jupiter: '/textures/2k_jupiter.jpg',
    saturn: '/textures/2k_saturn.jpg',
    uranus: '/textures/2k_uranus.jpg',
    neptune: '/textures/2k_neptune.jpg',
};
function getTexturePath(bodyId) {
    return TEXTURE_MAP[bodyId] || '';
}

// ── Compare row helper ─────────────────────────────────────────────────
function compareRow(label, valA, valB, unit) {
    return `<tr>
      <td class="ic-cmp-label">${label}</td>
      <td class="ic-cmp-valA">${valA}</td>
      <td class="ic-cmp-vs">${valA === valB ? '=' : (valA > valB ? '>' : '<')}</td>
      <td class="ic-cmp-valB">${valB}</td>
    </tr>`;
}

// ── Build overview tab content ─────────────────────────────────────────
function overviewHTML(body) {
    const colorHex = '#' + body.color.toString(16).padStart(6, '0');
    let hlHtml = '';
    if (body.highlights && body.highlights.length) {
        hlHtml = body.highlights.map(h => `<span class="ic-hl-badge">${h}</span>`).join('');
        hlHtml = `<div class="ic-highlights">${hlHtml}</div>`;
    }

    return `
      ${hlHtml}
      <table class="ic-datatable">
        <tr><td class="ic-label">半径</td><td class="ic-val">${fmtRadius(body.radius)}</td></tr>
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
    const paragraphs = body.detail.split('\n\n').filter(Boolean);
    const html = paragraphs.map(p => `<p>${p}</p>`).join('');
    return `<div class="ic-detail-text">${html}</div>`;
}

// ── Build compare tab content ──────────────────────────────────────────
function compareHTML(bodyA, bodyB) {
    if (!bodyB) {
        // 未选择比较对象，显示选择器
        const allBodies = getAllPlanets().filter(b => b.id !== bodyA.id);
        const opts = allBodies.map(b =>
            `<option value="${b.id}">${b.symbol} ${b.name}</option>`
        ).join('');
        return `
          <div class="ic-cmp-empty">
            <p>选择一个天体与 <strong>${bodyA.symbol} ${bodyA.name}</strong> 比较</p>
            <select class="ic-cmp-select" id="ic-cmp-select">
              <option value="">— 选择 —</option>
              ${opts}
            </select>
          </div>
        `;
    }

    // 比较表格
    const colorA = '#' + bodyA.color.toString(16).padStart(6, '0');
    const colorB = '#' + bodyB.color.toString(16).padStart(6, '0');

    return `
      <div class="ic-cmp-header">
        <div class="ic-cmp-col" style="border-color:${colorA}">
          <span class="ic-cmp-symbol">${bodyA.symbol}</span>
          <span class="ic-cmp-name">${bodyA.name}</span>
        </div>
        <div class="ic-cmp-col" style="border-color:${colorB}">
          <span class="ic-cmp-symbol">${bodyB.symbol}</span>
          <span class="ic-cmp-name">${bodyB.name}</span>
        </div>
      </div>
      <table class="ic-cmp-table">
        ${compareRow('半径', fmtRadius(bodyA.radius), fmtRadius(bodyB.radius))}
        ${compareRow('质量', fmtMass(bodyA.mass), fmtMass(bodyB.mass))}
        ${compareRow('密度', bodyA.density + ' g/cm³', bodyB.density + ' g/cm³')}
        ${compareRow('距太阳', fmtAU(bodyA.orbitA), fmtAU(bodyB.orbitA))}
        ${compareRow('公转周期', fmtDays(bodyA.period), fmtDays(bodyB.period))}
        ${compareRow('自转周期', fmtDays(bodyA.rotPeriod), fmtDays(bodyB.rotPeriod))}
        ${compareRow('表面温度', fmtTemp(bodyA.surfaceTemp), fmtTemp(bodyB.surfaceTemp))}
        ${compareRow('卫星数量', fmtMoons(bodyA.moons), fmtMoons(bodyB.moons))}
      </table>
      <select class="ic-cmp-select" id="ic-cmp-select">
        <option value="">— 选择其他天体 —</option>
        ${getAllPlanets().filter(b => b.id !== bodyA.id).map(b =>
            `<option value="${b.id}" ${b.id === bodyB.id ? 'selected' : ''}>${b.symbol} ${b.name}</option>`
        ).join('')}
      </select>
    `;
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
            // 切换到比较 tab 时渲染
            if (tab === 'compare') {
                renderCompare();
            }
        });
    });

    // Quiz button
    document.getElementById('ic-quiz-btn').addEventListener('click', () => {
        if (activeBodyId) {
            startQuiz({
                bodyId: activeBodyId,
                title: document.getElementById('ic-name')?.textContent || '知识挑战'
            });
        }
    });

    // 比较选择器变更（事件委托）
    document.addEventListener('change', (e) => {
        if (e.target.id === 'ic-cmp-select') {
            compareBodyId = e.target.value;
            renderCompare();
        }
    });
}

// ── Render compare tab ─────────────────────────────────────────────────
function renderCompare() {
    const container = document.getElementById('ic-compare');
    if (!container) return;
    const bodyA = getPlanet(activeBodyId);
    if (!bodyA) return;
    const bodyB = compareBodyId ? getPlanet(compareBodyId) : null;
    container.innerHTML = compareHTML(bodyA, bodyB);
}

// ── Open card for a body ────────────────────────────────────────────────
export function selectBody(bodyId) {
    const body = getPlanet(bodyId);
    if (!body) return;

    activeBodyId = bodyId;
    compareBodyId = null;
    ensurePanel();

    const panel = document.getElementById('ic-panel');
    panel.classList.add('visible');
    document.getElementById('ic-overlay').classList.add('visible');
    sfx.panelOpen();

    // Header
    const colorHex = '#' + body.color.toString(16).padStart(6, '0');
    document.getElementById('ic-header').innerHTML = `
      <span class="ic-color-dot" style="background:${colorHex}"></span>
      <span class="ic-name" id="ic-name">${body.symbol} ${body.name}</span>
      <span class="ic-english">${body.english}</span>
    `;

    // Tab content
    document.getElementById('ic-overview').innerHTML = overviewHTML(body);
    document.getElementById('ic-detail').innerHTML = detailHTML(body);

    // 在详情页顶部插入行星图片
    const txtEl = document.getElementById('ic-detail');
    const imgPath = getTexturePath(bodyId);
    if (imgPath) {
        const imgHtml = `<div class="ic-planet-img"><img src="${imgPath}" alt="${body.name}" loading="lazy"></div>`;
        txtEl.innerHTML = imgHtml + txtEl.innerHTML;
    }

    // 启用比较 tab
    const cmpTab = document.getElementById('ic-tab-compare');
    if (cmpTab) cmpTab.style.display = '';

    // Reset to Overview tab
    document.querySelectorAll('.ic-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.ic-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.ic-tab[data-tab="overview"]').classList.add('active');
    document.getElementById('ic-overview').classList.add('active');
}

// ── Close card ─────────────────────────────────────────────────────────
export function closeCard() {
    activeBodyId = null;
    compareBodyId = null;
    sfx.panelClose();
    const panel = document.getElementById('ic-panel');
    const overlay = document.getElementById('ic-overlay');
    if (panel) panel.classList.remove('visible');
    if (overlay) overlay.classList.remove('visible');
}
