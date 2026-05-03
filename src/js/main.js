import '../css/style.css';
import { initSolarSystem } from './solarSystem.js';
import { initControls } from './controls.js';

const sys = initSolarSystem();
const { scene, camera, renderer, labelRenderer } = sys;
const controls = initControls(sys, camera, renderer);

let lastTime = performance.now();

function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const dt = (now - lastTime) / 1000; // seconds (real)
    lastTime = now;

    // At speed=1, 1 real second = 1 Earth day
    // We don't multiply by speed here because setSpeed already adjusted
    // the per-planet angularSpeed; we advance by dt (real seconds converted
    // to "simulated days" at base speed, then angularSpeed (which is
    // radians per simulated Earth day) handles the rest.
    //
    // With angularSpeed = 2π / period * speedMul,
    // and update(days) adds angularSpeed * days to meanAnomaly,
    // we need days = dt (since speedMul=1 means dt seconds = dt days).
    // Since angularSpeed already includes speedMul, days = dt is correct.
    sys.update(dt);

    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

animate();
