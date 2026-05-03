import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const DEFAULT_SCALE = 1200;
const DEFAULT_SPEED = 20; // days/sec

/** Create the UI panel and connect it to the solar-system API. */
export function initControls(sys, camera, renderer) {
    // ── Orbit controls ─────────────────────────────────────────────
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.05;
    orbit.screenSpacePanning = false;
    orbit.minDistance = 5;
    orbit.maxDistance = 3500;
    orbit.target.set(0, 0, 0);

    // ── DOM helpers ────────────────────────────────────────────────
    const $ = (sel) => document.querySelector(sel);
    const scaleSlider = $('#scale-slider');
    const scaleVal = $('#scale-value');
    const speedSlider = $('#speed-slider');
    const speedVal = $('#speed-value');
    const MAX = sys.MAX_SCALE;

    // ── Help text in top-right ─────────────────────────────────────
    const helpText = $('#help-text');

    // ── Scale slider ───────────────────────────────────────────────
    function sliderToScale(v) {
        return 1 + (MAX - 1) * (v / 100);
    }

    function scaleToSlider(s) {
        return ((s - 1) / (MAX - 1)) * 100;
    }

    function updateScale() {
        const v = parseFloat(scaleSlider.value);
        const s = sliderToScale(v);
        sys.setScale(s);
        if (s === 1) {
            scaleVal.textContent = 'x1 (真实)';
        } else if (s < 10) {
            scaleVal.textContent = 'x' + s.toFixed(1);
        } else {
            scaleVal.textContent = 'x' + Math.round(s);
        }
    }
    scaleSlider.addEventListener('input', updateScale);

    // ── Speed slider ───────────────────────────────────────────────
    function sliderToSpeed(v) {
        return Math.pow(365, v / 100);
    }

    function speedToSlider(s) {
        return Math.log(s) / Math.log(365) * 100;
    }

    function updateSpeed() {
        const v = parseFloat(speedSlider.value);
        const speed = sliderToSpeed(v);
        sys.setSpeed(speed);
        speedVal.textContent = speed < 10
            ? speed.toFixed(1) + ' 天/秒'
            : Math.round(speed) + ' 天/秒';
    }
    speedSlider.addEventListener('input', updateSpeed);

    // ── Set defaults ───────────────────────────────────────────────
    function setDefaults() {
        scaleSlider.value = String(Math.round(scaleToSlider(DEFAULT_SCALE)));
        speedSlider.value = String(Math.round(speedToSlider(DEFAULT_SPEED)));
        updateScale();
        updateSpeed();
        // Reset camera
        camera.position.set(0, 120, 200);
        camera.lookAt(0, 0, 0);
        orbit.target.set(0, 0, 0);
    }
    setDefaults(); // initialise with default values

    // ── Double-click to reset ──────────────────────────────────────
    renderer.domElement.addEventListener('dblclick', setDefaults);

    // ── Labels toggle ──────────────────────────────────────────────
    const labelToggle = $('#labels-toggle');
    labelToggle.addEventListener('change', () => {
        sys.setLabelsVisible(labelToggle.checked);
    });

    // ── Orbit path toggle (bonus control) ──────────────────────────
    const orbitToggle = $('#orbits-toggle');
    orbitToggle.addEventListener('change', () => {
        sys.planets.forEach((p) => {
            const orbitGroup = p.posGroup.parent;
            orbitGroup.children.forEach((child) => {
                if (child.isLine) child.visible = orbitToggle.checked;
            });
        });
    });

    // ── Window resize ──────────────────────────────────────────────
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        sys.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    });

    return orbit;
}
