import * as THREE from 'three';
import '../css/style.css';
import { initSolarSystem } from './solarSystem.js';
import { initControls } from './controls.js';
import { getPlanet } from './knowledge.js';
import { selectBody } from './infocard.js';
import { startQuiz } from './quizEngine.js';
import { markExplored, getStats, resetData } from './storage.js';

const sys = initSolarSystem();
const { scene, camera, renderer, labelRenderer } = sys;
const controls = initControls(sys, camera, renderer);

// ── Clickable body meshes ─────────────────────────
const clickables = [
    { mesh: sys.sun, bodyId: 'sun' },
    ...sys.planets.map(p => ({
        mesh: p.mesh,
        bodyId: (p.data.english || '').toLowerCase(),
    })),
];

// ── Raycaster click detection ────────────────────────
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let mouseDownPos = { x: 0, y: 0 };

renderer.domElement.addEventListener('pointerdown', (e) => {
    mouseDownPos.x = e.clientX;
    mouseDownPos.y = e.clientY;
});

renderer.domElement.addEventListener('pointerup', (e) => {
    const dx = e.clientX - mouseDownPos.x;
    const dy = e.clientY - mouseDownPos.y;
    // Ignore drags (user was rotating/panning)
    if (Math.sqrt(dx * dx + dy * dy) > 5) return;

    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const meshes = clickables.map(c => c.mesh);
    const hits = raycaster.intersectObjects(meshes, false);

    if (hits.length > 0) {
        const hitMesh = hits[0].object;
        const entry = clickables.find(c => c.mesh === hitMesh);
        if (entry) {
            const body = getPlanet(entry.bodyId);
            if (body) {
                selectBody(entry.bodyId);
                markExplored(entry.bodyId);
            }
        }
    }
});

// ── Global quiz button ────────────────────────────
document.getElementById('global-quiz-btn').addEventListener('click', () => {
    startQuiz({ title: '随机知识挑战' });
});

// ── Stats panel button ────────────────────────────
const statsBtn = document.getElementById('stats-btn');
statsBtn.addEventListener('click', showStats);

function showStats() {
    const overlay = document.getElementById('stats-overlay');
    const content = document.getElementById('stats-content');
    const stats = getStats();
    content.innerHTML = '<div class="sp-header">📊 我的探索档案</div>'
        + '<div class="sp-body">'
        + '<div class="sp-row"><span>已探索天体</span><span>' + stats.explored + ' / 9</span></div>'
        + '<div class="sp-row"><span>答题总数</span><span>' + stats.answered + '</span></div>'
        + '<div class="sp-row"><span>正确数</span><span>' + stats.correct + '</span></div>'
        + '<div class="sp-row"><span>正确率</span><span>' + stats.rate + '%</span></div>'
        + '</div>'
        + '<div class="sp-actions"><button id="stats-reset-btn" class="sp-reset-btn">🗑️ 重置档案</button></div>';
    overlay.style.display = '';
}

document.getElementById('stats-close').addEventListener('click', () => {
    document.getElementById('stats-overlay').style.display = 'none';
});
document.getElementById('stats-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'stats-overlay') e.target.style.display = 'none';
});

// Delegate reset button click (button is dynamically created)
document.getElementById('stats-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'stats-reset-btn') {
        if (confirm('确认重置所有探索和答题记录？此操作不可撤销。')) {
            resetData();
            document.getElementById('stats-overlay').style.display = 'none';
        }
    }
});

// ── Distance info panel ───────────────────────────
const distList = document.getElementById('distance-list');
distList.innerHTML = sys.planets.map(p => {
    const peri = (p.data.orbitA * (1 - p.data.e)).toFixed(3);
    const aph = (p.data.orbitA * (1 + p.data.e)).toFixed(3);
    return `<div class="dp-row"><span class="dp-name">${p.data.name}</span><span class="dp-dist">${peri}–${aph} AU</span></div>`;
}).join('');

let lastTime = performance.now();

// Pause simulation while tab is hidden to avoid dt spikes
// that cause trail gaps and orbital position jumps.
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        lastTime = performance.now();
    }
});

function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.5); // seconds (real), cap at 0.5s
    lastTime = now;

    // Sun pulsating effect (±2%)
    const pulse = 1 + Math.sin(now * 0.0025) * 0.02;
    sys.sun.scale.setScalar(pulse);

    sys.update(dt);

    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

animate();
