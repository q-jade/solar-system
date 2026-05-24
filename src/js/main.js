import * as THREE from 'three';
import '../css/style.css';
import '../css/questPanel.css';
import { initSolarSystem } from './solarSystem.js';
import { initControls } from './controls.js';
import { getPlanet } from './knowledge.js';
import { selectBody } from './infocard.js';
import { startQuiz } from './quizEngine.js';
import { markExplored, getStats, resetData, addXp } from './storage.js';
import { createQuestEngine } from './questEngine.js';
import { createAchievement } from './achievement.js';
import { loadTextures, setOnProgress } from './textureLoader.js';
import { sfx } from './sfx.js';
import { ambientMusic } from './ambientMusic.js';
import { t, setLang, getLang, onLangChange } from './i18n.js';

(async () => {
// ── Loading screen ────────────────────────────────
const loadingEL = document.getElementById('loading-overlay');
const fillEL = document.getElementById('loading-bar-fill');
const pctEL = document.getElementById('loading-percent');
const txtEL = document.getElementById('loading-text');
setOnProgress((ratio) => {
    const pct = Math.round(ratio * 100);
    fillEL.style.width = pct + '%';
    pctEL.textContent = pct + '%';
});
const textures = await loadTextures();
fillEL.style.width = '100%';
pctEL.textContent = '100%';
txtEL.textContent = t('app.ready');
// Brief delay so user sees 100%
await new Promise(r => setTimeout(r, 400));
loadingEL.style.opacity = '0';
setTimeout(() => loadingEL.style.display = 'none', 500);
const sys = initSolarSystem(textures);
const { scene, camera, renderer, labelRenderer } = sys;
const { orbit: controls, setFocus, updateFocus, getFocusedId } = initControls(sys, camera, renderer);

// ── Phase 2: Quest & Achievement engine ────────
const quest = createQuestEngine();
const ach = createAchievement();
quest.ensurePanelDOM();
ach.ensurePanelDOM();

// Expose for controls.js and quizEngine.js to use
window.__questEngine = quest;
window.__achievement = ach;

// 自动启动背景音乐
ambientMusic.start();

// ── Clickable body meshes ─────────────────────────
const clickables = [
    { mesh: sys.sunMesh, bodyId: 'sun' },
    ...sys.planets.map(p => ({
        mesh: p.mesh,
        bodyId: (p.data.english || '').toLowerCase(),
    })),
];

// ── Raycaster click detection ────────────────────────
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let mouseDownPos = { x: 0, y: 0 };
let mouseDownBtn = 0;

renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

renderer.domElement.addEventListener('pointerdown', (e) => {
    mouseDownPos.x = e.clientX;
    mouseDownPos.y = e.clientY;
    mouseDownBtn = e.button;
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
            if (entry.bodyId === '__asteroid_belt__') {
                quest.trigger('click_asteroid_belt', {});
                ach.evaluate();
                return;
            }
            const body = getPlanet(entry.bodyId);
            if (!body) return;

            if (mouseDownBtn === 2) {
                // Right-click: focus camera on planet or sun
                if (getFocusedId() === entry.bodyId) return; // already focused
                if (entry.bodyId === 'sun') {
                    setFocus(sys.sunMesh, '太阳', 'sun', 'Sun');
                } else {
                    const pMatch = sys.planets.find(p =>
                        (p.data.english || '').toLowerCase() === entry.bodyId
                    );
                    if (pMatch) setFocus(pMatch.mesh, pMatch.data.name, entry.bodyId, pMatch.data.english || '');
                }
                return;
            }

            // Left-click: open info card + XP/quest
            selectBody(entry.bodyId);
            sfx.focus();
            const wasExplored = markExplored(entry.bodyId);
            if (wasExplored) {
                const mult = entry.bodyId === 'sun' ? 1.5 : (
                    ['earth', 'jupiter', 'saturn'].includes(entry.bodyId) ? 1.2 : 1
                );
                addXp(Math.round(20 * mult));
            }
            quest.trigger('click_body', { bodyId: entry.bodyId });
            ach.evaluate();
        }
    }
});

// ── Global quiz button ────────────────────────────
document.getElementById('global-quiz-btn').addEventListener('click', () => {
    startQuiz({ title: t('quiz.random') });
    sfx.click();
});

// ── Quest & Achievement buttons ─────────────────
document.getElementById('quest-btn').addEventListener('click', () => {
    quest.togglePanel();
    ach.closePanel();
    sfx.click();
});
document.getElementById('ach-btn').addEventListener('click', () => {
    ach.togglePanel();
    quest.closePanel();
    sfx.click();
});

// ── Asteroid belt click detection ─────────────────
// Expose a clickable area near the asteroid belt region
let asteroidBeltMesh = null;
function createAsteroidBeltClickArea() {
    const geo = new THREE.RingGeometry(88, 128, 64); // 2.1~3.2 * AU
    const mat = new THREE.MeshBasicMaterial({
        color: 0x446688,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.userData.isAsteroidBelt = true;
    scene.add(mesh);
    asteroidBeltMesh = mesh;
}
createAsteroidBeltClickArea();

// Extend clickable meshes to include asteroid belt
clickables.push({ mesh: asteroidBeltMesh, bodyId: '__asteroid_belt__' });

// ── Stats panel button ────────────────────────────
const statsBtn = document.getElementById('stats-btn');
statsBtn.addEventListener('click', showStats);

function showStats() {
    const overlay = document.getElementById('stats-overlay');
    const content = document.getElementById('stats-content');
    const stats = getStats();
    content.innerHTML = '<div class="sp-header">' + t('stats.title') + '</div>'
        + '<div class="sp-body">'
        + '<div class="sp-row"><span>' + t('stats.explored') + '</span><span>' + stats.explored + ' / 9</span></div>'
        + '<div class="sp-row"><span>' + t('stats.quizAnswered') + '</span><span>' + stats.answered + '</span></div>'
        + '<div class="sp-row"><span>' + t('stats.quizCorrect') + '</span><span>' + stats.correct + '</span></div>'
        + '<div class="sp-row"><span>' + t('stats.quizCorrectRate') + '</span><span>' + stats.rate + '%</span></div>'
        + '</div>'
        + '<div class="sp-actions"><button id="stats-reset-btn" class="sp-reset-btn">🗑️ ' + t('stats.reset') + '</button></div>';
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
        if (confirm(t('stats.resetConfirm'))) {
            resetData();
            quest.resetQuests();
            document.getElementById('stats-overlay').style.display = 'none';
        }
    }
});

// ── Distance info panel ───────────────────────────
function rebuildDistancePanel() {
    const distList = document.getElementById('distance-list');
    if (!distList) return;
    const isEn = getLang() === 'en-US';
    distList.innerHTML = sys.planets.map(p => {
        const peri = (p.data.orbitA * (1 - p.data.e)).toFixed(3);
        const aph = (p.data.orbitA * (1 + p.data.e)).toFixed(3);
        const pname = isEn ? p.data.english : p.data.name;
        return `<div class="dp-row"><span class="dp-name">${pname}</span><span class="dp-dist">${peri}–${aph} AU</span></div>`;
    }).join('');
}
rebuildDistancePanel();

let lastTime = performance.now();

// Pause simulation while tab is hidden to avoid dt spikes
// that cause trail gaps and orbital position jumps.
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        lastTime = performance.now();
    }
});

// ── Proximity detection for quests (every 15 frames) ─
let proxFrame = 0;
function checkProximity() {
    const tmpVec = new THREE.Vector3();
    // Check distance to each planet
    for (const p of sys.planets) {
        p.posGroup.getWorldPosition(tmpVec);
        const dist = camera.position.distanceTo(tmpVec);
        quest.trigger('body_proximity', {
            bodyId: (p.data.english || '').toLowerCase(),
            distance: dist,
        });
    }
    // Check distance to moon
    if (sys.moon) {
        sys.moon.posGroup.getWorldPosition(tmpVec);
        const moonDist = camera.position.distanceTo(tmpVec);
        quest.trigger('body_proximity', {
            bodyId: 'moon',
            distance: moonDist,
        });
    }
}

function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.5); // seconds (real), cap at 0.5s
    lastTime = now;

    // Sun pulsating effect (±2%)
    const pulse = 1 + Math.sin(now * 0.0025) * 0.02;
    sys.sun.scale.setScalar(pulse);

    sys.update(dt);

    // Proximity check + quest poll + hidden achiev every 15 frames (~4 times/sec)
    proxFrame++;
    if (proxFrame >= 15) {
        proxFrame = 0;
        checkProximity();
        quest.poll(0.25);

        // Hidden achievements: check sliders
        const scaleSlider = document.getElementById('scale-slider');
        const eccSlider = document.getElementById('ecc-slider');
        const speedSlider = document.getElementById('speed-slider');
        if (scaleSlider) {
            const scaleAtMax = parseFloat(scaleSlider.value) >= 99;
            if (scaleAtMax) {
                window._scaleMaxAccum = (window._scaleMaxAccum || 0) + 0.25;
                if (window._scaleMaxAccum >= 3) {
                    ach._setCustomFlag('_achTinyUnlocked');
                }
            } else {
                window._scaleMaxAccum = 0;
            }
        }
        if (eccSlider && speedSlider) {
            const eccAtMax = parseFloat(eccSlider.value) >= 39;
            const speedHigh = parseFloat(speedSlider.value) >= 70;
            if (eccAtMax && speedHigh) {
                ach._setCustomFlag('_achOrbitUnlocked');
            }
        }

        ach.evaluate();
    }

    updateFocus(sys.planets, dt);
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

animate();

// ── 语言切换 ────────────────────────────────────────────
const langSelect = document.getElementById('lang-select');
langSelect.value = getLang();
langSelect.addEventListener('change', () => {
    setLang(langSelect.value);
});

// 语言变更时统一更新 UI
onLangChange((lang) => {
    updateUI();
    if (typeof sys.setLabelLanguage === "function") sys.setLabelLanguage(lang);
    rebuildDistancePanel();
  });

/** 重新翻译所有 data-i18n 元素和动态 UI */
function updateUI() {
    // 更新 data-i18n 元素
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        const val = el.tagName === 'INPUT' ? 'placeholder' : 'textContent';
        el[val] = t(key);
    });

    // 控制面板提示文字
    document.querySelector('#ctrl-hint').textContent = t('app.hint');
}

})();
