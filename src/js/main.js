import * as THREE from 'three';
import '../css/style.css';
import { initSolarSystem } from './solarSystem.js';
import { initControls } from './controls.js';
import { getPlanet } from './knowledge.js';
import { selectBody } from './infocard.js';

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
            }
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
