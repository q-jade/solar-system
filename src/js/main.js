import '../css/style.css';
import { initSolarSystem } from './solarSystem.js';
import { initControls } from './controls.js';

const sys = initSolarSystem();
const { scene, camera, renderer, labelRenderer } = sys;
const controls = initControls(sys, camera, renderer);

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
