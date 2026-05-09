/**
 * sortPanel.js — Drag-and-drop size sorting panel for quest #2
 *
 * Shows 5 planets; user drags to reorder them from largest radius to smallest.
 * Planet radii are NOT shown during sorting — the user must think.
 * Correct order fires `size_sort` event to the quest engine.
 */

const PLANET_POOL = [
    { bodyId: 'jupiter', name: '木星', radius: 69911 },
    { bodyId: 'saturn', name: '土星', radius: 58232 },
    { bodyId: 'uranus', name: '天王星', radius: 25362 },
    { bodyId: 'neptune', name: '海王星', radius: 24622 },
    { bodyId: 'earth', name: '地球', radius: 6371 },
    { bodyId: 'venus', name: '金星', radius: 6051.8 },
    { bodyId: 'mars', name: '火星', radius: 3389.5 },
    { bodyId: 'mercury', name: '水星', radius: 2439.7 },
];

// ── HTML template ──────────────────────────────────────────────────────
const SORT_HTML = `
    <div class="qz-overlay" id="sort-overlay"></div>
    <div class="qz-card" id="sort-card">
        <div class="qz-header">
            <span class="qz-title">📏 谁最大？</span>
            <span class="qz-score" id="sort-status">拖拽排序</span>
            <button class="qz-close" id="sort-close">✕</button>
        </div>
        <div class="qz-body">
            <div class="qz-question" style="font-size:14px;margin-bottom:8px;">
                将以下行星按半径<strong>从大到小</strong>排列
            </div>
            <div class="qz-question" style="font-size:12px;color:#778;margin-bottom:14px;">
                拖拽卡片调整顺序（半径数值将在验证后显示）
            </div>
            <div id="sort-list"></div>
            <div id="sort-feedback" style="display:none;margin-top:12px;">
                <div id="sort-explain" style="font-size:13px;color:#aab;line-height:1.6;"></div>
            </div>
            <button id="sort-submit" class="qz-opt" style="margin-top:14px;width:100%;padding:10px;font-size:14px;">验证顺序</button>
        </div>
    </div>
`;

// ── Planet color map ──────────────────────────────────────────────────
const PLANET_COLORS = {
    jupiter: '#d4a06a', saturn: '#e8d5a3', uranus: '#7ec8e3',
    neptune: '#3b6ee8', earth: '#4a9eff', venus: '#e8c87a',
    mars: '#e07040', mercury: '#b0a090',
};

// ── State ──────────────────────────────────────────────────────────────
let planets = [];
let isLocked = false;
let isSubmitted = false;
let dragSrcIndex = -1;

// ── DOM helpers ────────────────────────────────────────────────────────
function ensureDOM() {
    if (document.getElementById('sort-card')) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = SORT_HTML;
    while (wrapper.firstElementChild) {
        document.body.appendChild(wrapper.firstElementChild);
    }

    document.getElementById('sort-close').addEventListener('click', closePanel);
    document.getElementById('sort-overlay').addEventListener('click', closePanel);
    document.getElementById('sort-submit').addEventListener('click', submitOrder);
}

function closePanel() {
    document.getElementById('sort-card').classList.remove('visible');
    document.getElementById('sort-overlay').classList.remove('visible');
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ── Render cards ───────────────────────────────────────────────────────
function renderList() {
    const list = document.getElementById('sort-list');
    list.innerHTML = planets.map((p, idx) => {
        // Mini size bar (relative within current 5 planets)
        const maxR = Math.max(...planets.map(x => x.radius));
        const barPct = Math.max(8, Math.round(p.radius / maxR * 100));
        return `
        <div class="sort-card"
             draggable="${isLocked ? 'false' : 'true'}"
             data-index="${idx}"
             data-body-id="${p.bodyId}">
            <span class="sort-handle">⠿</span>
            <span class="sort-color" style="background:${PLANET_COLORS[p.bodyId] || '#555'}"></span>
            <span class="sort-name">${p.name}</span>
            <span class="sort-bar-track"><span class="sort-bar-fill" style="width:${barPct}%"></span></span>
            <span class="sort-rank">${idx + 1}</span>
        </div>`;
    }).join('');

    const cards = list.querySelectorAll('.sort-card');
    cards.forEach(card => {
        card.addEventListener('dragstart', onDragStart);
        card.addEventListener('dragover', onDragOver);
        card.addEventListener('dragenter', onDragEnter);
        card.addEventListener('dragleave', onDragLeave);
        card.addEventListener('drop', onDrop);
        card.addEventListener('dragend', onDragEnd);
    });
}

// ── Drag handlers ──────────────────────────────────────────────────────
function onDragStart(e) {
    if (isLocked) { e.preventDefault(); return; }
    dragSrcIndex = parseInt(e.currentTarget.dataset.index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(dragSrcIndex));
    e.currentTarget.classList.add('sort-dragging');
}

function onDragOver(e) {
    if (isLocked) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function onDragEnter(e) {
    if (isLocked) return;
    e.preventDefault();
    if (parseInt(e.currentTarget.dataset.index) !== dragSrcIndex) {
        e.currentTarget.classList.add('sort-drag-over');
    }
}

function onDragLeave(e) {
    e.currentTarget.classList.remove('sort-drag-over');
}

function onDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('sort-drag-over');
    if (isLocked) return;

    const fromIdx = dragSrcIndex;
    const toIdx = parseInt(e.currentTarget.dataset.index);
    if (fromIdx === toIdx) return;

    const [item] = planets.splice(fromIdx, 1);
    planets.splice(toIdx, 0, item);

    isSubmitted = false;
    clearFeedback();
    renderList();
}

function onDragEnd(e) {
    e.currentTarget.classList.remove('sort-dragging');
    document.querySelectorAll('.sort-drag-over').forEach(el => el.classList.remove('sort-drag-over'));
}

// ── Submit & feedback ──────────────────────────────────────────────────
function clearFeedback() {
    document.querySelectorAll('.sort-card').forEach(c => {
        c.classList.remove('sort-correct', 'sort-wrong');
    });
    document.getElementById('sort-feedback').style.display = 'none';
    const btn = document.getElementById('sort-submit');
    btn.textContent = '验证顺序';
    btn.disabled = false;
    document.getElementById('sort-status').textContent = '拖拽排序';
}

function submitOrder() {
    if (isLocked) return;

    const correctOrder = [...planets].sort((a, b) => b.radius - a.radius);
    const isCorrect = planets.every((p, i) => p.bodyId === correctOrder[i].bodyId);

    const cards = document.querySelectorAll('.sort-card');
    const feedback = document.getElementById('sort-feedback');
    const explain = document.getElementById('sort-explain');

    if (isCorrect) {
        isLocked = true;
        cards.forEach((c, i) => c.classList.add('sort-correct'));

        // Show correct order with radii
        const orderHtml = correctOrder.map((p, i) =>
            `<span style="color:#4ade80;">${i + 1}. ${p.name}</span> (${p.radius.toLocaleString()} km)`
        ).join(' → ');
        feedback.style.display = 'block';
        explain.innerHTML = `✅ 完全正确！<br><span style="font-size:12px;">${orderHtml}</span>`;

        document.getElementById('sort-submit').textContent = '✓ 完成！';
        document.getElementById('sort-status').textContent = '✅ 正确';

        if (window.__questEngine) {
            window.__questEngine.trigger('size_sort', { correct: true });
        }

        setTimeout(closePanel, 5000);
    } else {
        isSubmitted = true;
        cards.forEach((c, i) => {
            if (planets[i].bodyId === correctOrder[i].bodyId) {
                c.classList.add('sort-correct');
            } else {
                c.classList.add('sort-wrong');
            }
        });

        const wrongNames = planets
            .filter((p, i) => p.bodyId !== correctOrder[i].bodyId)
            .map(p => p.name);

        const orderHint = correctOrder.map((p, i) =>
            `${i + 1}. ${p.name} (${p.radius.toLocaleString()} km)`
        ).join('<br>');

        feedback.style.display = 'block';
        explain.innerHTML = `
            <div style="margin-bottom:6px;">❌ <strong>${wrongNames.join('、')}</strong> 位置不对</div>
            <div style="color:#889;font-size:12px;border-top:1px solid rgba(100,150,255,0.1);padding-top:8px;margin-top:6px;">
                <div style="color:#aab;margin-bottom:3px;">正确排序（半径从大到小）：</div>
                ${orderHint}
            </div>
        `;
        document.getElementById('sort-status').textContent = '❌ 再试试';
    }
}

// ── Public API ─────────────────────────────────────────────────────────
export function openSortPanel() {
    ensureDOM();
    isLocked = false;
    isSubmitted = false;
    dragSrcIndex = -1;

    const shuffled = shuffle(PLANET_POOL);
    planets = shuffled.slice(0, 5);
    planets = shuffle(planets);

    clearFeedback();
    renderList();
    document.getElementById('sort-card').classList.add('visible');
    document.getElementById('sort-overlay').classList.add('visible');
}

export function closeSortPanel() {
    closePanel();
}
