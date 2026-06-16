import * as THREE from 'three';
import '../css/style.css';
import '../css/questPanel.css';
import { initSolarSystem } from './solarSystem.js';
import { initControls } from './controls.js';
import { getPlanet } from './knowledge.js';
import { selectBody } from './infocard.js';
import { startQuiz } from './quizEngine.js';
import { markExplored, getStats, resetData, addXp, isFirstGuideDone, markGuideDone } from './storage.js';
import { createQuestEngine } from './questEngine.js';
import { createAchievement } from './achievement.js';
import { loadTextures, setOnProgress } from './textureLoader.js';
import { sfx } from './sfx.js';
import { ambientMusic } from './ambientMusic.js';
import { t, setLang, getLang, onLangChange, getLocale } from './i18n.js';

export async function boot(hooks = {}) {
// ── Simulated date tracking ────────────────────
const J2000 = new Date(Date.UTC(2000, 0, 1, 12, 0, 0));
const DAY_MS = 86400000;
let simulatedDays = 0;
const dateEl = document.getElementById('date-display');

function formatDate(days, showHours) {
    const d = new Date(J2000.getTime() + days * DAY_MS);
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const da = String(d.getUTCDate()).padStart(2, '0');
    let s = y + '-' + mo + '-' + da;
    if (showHours) {
        s += ' ' + String(d.getUTCHours()).padStart(2, '0');
        s += ':' + String(d.getUTCMinutes()).padStart(2, '0');
    }
    return s;
}

/** 重新翻译所有 data-i18n 元素和动态 UI */
function updateUI() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        const val = el.tagName === 'INPUT' ? 'placeholder' : 'textContent';
        el[val] = t(key);
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = t(el.dataset.i18nTitle);
    });

    document.querySelector('#ctrl-hint').textContent = t('app.hint');

    const desc = t('app.description');
    const m = document.querySelector('meta[name="description"]');
    if (m) m.content = desc;
    const og = document.querySelector('meta[property="og:description"]');
    if (og) og.content = desc;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = t('app.title');

    // Version badge
    const verEl = document.getElementById('version-badge');
    if (verEl) verEl.textContent = 'v' + APP_VERSION;

    // Date display (refresh locale format)
    if (dateEl) dateEl.textContent = formatDate(simulatedDays, false);
}

updateUI();

// ── Loading screen ────────────────────────────────
const loadingEL = document.getElementById('loading-overlay');
const fillEL = document.getElementById('loading-bar-fill');
const pctEL = document.getElementById('loading-percent');
const txtEL = document.getElementById('loading-text');
txtEL.textContent = t('app.loading');
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

// ── First-time guide ─────────────────────────────
(function showGuide() {
    if (isFirstGuideDone()) return;
    const overlay = document.getElementById('guide-overlay');
    if (!overlay) return;
    overlay.style.display = '';
    document.getElementById('guide-title').textContent = t('guide.title');
    document.getElementById('guide-desc').textContent = t('guide.desc');
    const list = document.getElementById('guide-steps');
    list.innerHTML = getLocale().guide.steps.map(s => `<li>${s}</li>`).join('');
    document.getElementById('guide-btn').textContent = t('guide.btn');
    document.getElementById('guide-btn').addEventListener('click', () => {
        overlay.style.display = 'none';
        markGuideDone();
    }, { once: true });
})();

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

const ctx = { sys, scene, camera, renderer, labelRenderer, controls, quest, ach,
              setFocus, updateFocus, getFocusedId };
if (hooks.afterInit) await hooks.afterInit(ctx);

// ── Clickable body meshes ─────────────────────────
const clickables = [
    { mesh: sys.sunMesh, bodyId: 'sun' },
    ...sys.planets.map(p => ({
        mesh: p.mesh,
        bodyId: (p.data.english || '').toLowerCase(),
    })),
    ...sys.moons.map(m => ({
        mesh: m.mesh,
        bodyId: m.id,
        moon: true,
    })),
];

if (hooks.registerClickables) hooks.registerClickables(clickables, ctx);

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
            if (mouseDownBtn === 2) {
                // Right-click: focus camera on planet, sun, or moon
                if (getFocusedId() === entry.bodyId) return;
                if (entry.bodyId === 'sun') {
                    setFocus(sys.sunMesh, '太阳', 'sun', 'Sun');
                } else if (entry.moon) {
                    const m = sys.moons.find(x => x.id === entry.bodyId);
                    if (m) setFocus(m.mesh, m.data.name, m.id, m.data.english);
                } else {
                    const pMatch = sys.planets.find(p =>
                        (p.data.english || '').toLowerCase() === entry.bodyId
                    );
                    if (pMatch) setFocus(pMatch.mesh, pMatch.data.name, entry.bodyId, pMatch.data.english || '');
                }
                return;
            }

            // Left-click: find body or moon, open parent planet card
            const body = getPlanet(entry.bodyId);
            let targetId = entry.bodyId;
            if (!body && entry.moon) {
                // Moon has no entry in bodies.json; open parent planet card
                const m = sys.moons.find(x => x.id === entry.bodyId);
                if (m) {
                    targetId = m.data.parent;
                }
            }
            selectBody(targetId);
            sfx.focus();
            const wasExplored = markExplored(targetId);
            if (wasExplored) {
                const mult = targetId === 'sun' ? 1.5 : (
                    ['earth', 'jupiter', 'saturn'].includes(targetId) ? 1.2 : 1
                );
                addXp(Math.round(20 * mult));
            }
            quest.trigger('click_body', { bodyId: targetId });
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

// ── Help panel button ────────────────────────────
document.getElementById('help-btn').addEventListener('click', showHelp);

function showHelp() {
    const overlay = document.getElementById('help-overlay');
    const content = document.getElementById('help-content');
    const controls = getLocale().help.controlsList;
    const ctrlHtml = controls.map(c => '<li>' + c + '</li>').join('');
    content.innerHTML = '<h2>' + t('help.title') + '</h2>'
        + '<div class="hp-section">'
        + '<p>' + t('help.description') + '</p>'
        + '</div>'
        + '<div class="hp-section">'
        + '<h3>' + t('help.version') + '</h3>'
        + '<p>v' + APP_VERSION + '</p>'
        + '</div>'
        + '<div class="hp-section">'
        + '<h3>' + t('help.author') + '</h3>'
        + '<p>q-jade (gavin_qw@126.com)</p>'
        + '</div>'
        + '<div class="hp-section">'
        + '<h3>' + t('help.links') + '</h3>'
        + '<div class="hp-links">'
        + '<a href="' + (getLang() === 'zh-CN' ? 'https://gitee.com/q-jade/solar-system' : 'https://github.com/q-jade/solar-system') + '" target="_blank" rel="noopener">' + t('help.github') + '</a>'
        + '<a href="' + (getLang() === 'zh-CN' ? 'https://gitee.com/q-jade/solar-system#readme' : 'https://github.com/q-jade/solar-system#readme') + '" target="_blank" rel="noopener">' + t('help.readme') + '</a>'
        + '</div>'
        + '</div>'
        + '<div class="hp-section">'
        + '<h3>' + t('help.controls') + '</h3>'
        + '<ul class="hp-controls">' + ctrlHtml + '</ul>'
        + '</div>'
        + '<div class="hp-section">'
        + '<p class="hp-meta">' + t('help.license') + '</p>'
        + '</div>';
    overlay.style.display = '';
}

document.getElementById('help-close').addEventListener('click', () => {
    document.getElementById('help-overlay').style.display = 'none';
});
document.getElementById('help-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'help-overlay') e.target.style.display = 'none';
});

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
    // Check distance to all moons
    for (const m of sys.moons) {
        m.posGroup.getWorldPosition(tmpVec);
        const mDist = camera.position.distanceTo(tmpVec);
        quest.trigger('body_proximity', {
            bodyId: m.id,
            distance: mDist,
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

    // Update simulated date
    simulatedDays += sys.currentSpeedMul * dt;
    if (dateEl) dateEl.textContent = formatDate(simulatedDays, sys.currentSpeedMul < 1);

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

    if (hooks.onFrame) hooks.onFrame(dt, ctx);

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
    // 如果统计面板当前可见则刷新
    const statsOverlay = document.getElementById('stats-overlay');
    if (statsOverlay && statsOverlay.style.display !== 'none') {
        showStats();
    }
  });

// ── Showcase mode ────────────────────────────
const showcaseBtn = document.getElementById('showcase-btn');
showcaseBtn.addEventListener('click', toggleShowcase);

document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        document.body.classList.remove('showcase-active');
    }
});

function toggleShowcase() {
    const active = document.body.classList.toggle('showcase-active');
    if (active) {
        document.documentElement.requestFullscreen();
    } else if (document.fullscreenElement) {
        document.exitFullscreen();
    }
}

if (hooks.afterBoot) hooks.afterBoot(ctx);
}

if (typeof __SKIP_AUTO_BOOT__ === 'undefined' || !__SKIP_AUTO_BOOT__) {
    boot();
}
