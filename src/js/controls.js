import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ambientMusic } from './ambientMusic.js';
import { t, onLangChange, getLang } from './i18n.js';

const DEFAULT_SCALE = 1200;
const MIN_SPEED = 1 / 24;  // 1 hour/sec
const DEFAULT_SPEED = 20; // days/sec
const DEFAULT_ECC = 1;    // 1x = real eccentricity
const ECC_MAX = 4;       // max eccentricity multiplier

/** Create the UI panel and connect it to the solar-system API. */
export function initControls(sys, camera, renderer) {
    // ── Orbit controls ─────────────────────────────────────────────
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.05;
    orbit.screenSpacePanning = false;
    orbit.minDistance = 5;
    orbit.maxDistance = 18000;
    orbit.target.set(0, 0, 0);

    // ── Planet focus with smooth fly-to ──────────────────────────
    let focusedBody = null;
    let focusedId = '';
    let focusName = '';
    let focusNameEn = '';
    let flying = false;
    let flyBackToSun = false;
    let flyProgress = 0;
    const FLY_DURATION = 0.8; // seconds
    const flyStart = new THREE.Vector3();
    const flyEnd = new THREE.Vector3();
    const flyTargetStart = new THREE.Vector3();
    const flyTargetEnd = new THREE.Vector3();
    const cameraOffset = new THREE.Vector3();
    const _v = new THREE.Vector3();
    const _wp = new THREE.Vector3();

    const focusLabel = document.createElement('div');
    focusLabel.id = 'focus-label';
    focusLabel.textContent = '';
    document.body.appendChild(focusLabel);

    function refreshFocusLabel() {
        const lang = getLang();
        const displayName = lang === 'en-US' ? focusNameEn : focusName;
        focusLabel.textContent = t('control.focus', { name: displayName });
    }

    function smoothstep(t) {
        return t * t * (3 - 2 * t);
    }

    /** Smoothly fly camera to look at a planet */
    function setFocus(bodyData, name, bodyId, nameEn) {
        focusedId = bodyId || '';
        // Calculate end camera position: approach the planet along current view direction
        bodyData.getWorldPosition(_wp);
        // Get actual world radius accounting for scaleWrapper scaling
        const baseRadius = bodyData.geometry ? bodyData.geometry.parameters.radius : 4;
        // Hierarchy: mesh -> tiltGroup -> scaleWrapper -> posGroup
        const scaleNode = bodyData.parent ? bodyData.parent.parent : null;
        const worldScale = scaleNode ? scaleNode.scale.x : 1;
        const worldRadius = baseRadius * worldScale;
        const viewDist = Math.max(worldRadius * 3, 1);
        // Direction from planet toward camera, or a default offset if too close
        _v.copy(camera.position).sub(_wp);
        const dist = _v.length();
        if (dist < 0.1) {
            _v.set(0, viewDist * 0.5, viewDist);
        }
        _v.normalize().multiplyScalar(viewDist);
        flyEnd.copy(_wp).add(_v);
        flyTargetEnd.copy(_wp);

        // Start from current camera
        flyStart.copy(camera.position);
        flyTargetStart.copy(orbit.target);

        // Compute target camera offset for tracking
        cameraOffset.copy(flyEnd).sub(_wp);

        flying = true;
        flyProgress = 0;
        focusedBody = bodyData;
        focusName = name || '';
        focusNameEn = nameEn || name || '';
        refreshFocusLabel();
        focusLabel.style.display = 'block';
    }

    /** Clear focus and return to sun (instant, for init) */
    function clearFocus() {
        flying = false;
        flyBackToSun = false;
        focusedBody = null;
        focusedId = '';
        focusName = '';
        focusNameEn = '';
        focusLabel.style.display = 'none';
        orbit.target.set(0, 0, 0);
    }

    /** Smooth fly-back to default sun view */
    function flyBack() {
        if (!focusedBody) return;
        flyStart.copy(camera.position);
        flyEnd.set(0, 120, 200);
        flyTargetStart.copy(orbit.target);
        flyTargetEnd.set(0, 0, 0);
        flyProgress = 0;
        flying = true;
        flyBackToSun = true;
        focusLabel.style.display = 'none';
        focusedBody = null;
    }

    /** Call each frame: flies then tracks planet with camera offset */
    function updateFocus(planets, dt) {
        // Fly-back to sun animation
        if (flying && flyBackToSun) {
            flyProgress += dt / FLY_DURATION;
            if (flyProgress >= 1) {
                flyProgress = 1;
                flying = false;
                flyBackToSun = false;
                clearFocus();
                return;
            }
            const t = smoothstep(flyProgress);
            camera.position.lerpVectors(flyStart, flyEnd, t);
            orbit.target.lerpVectors(flyTargetStart, flyTargetEnd, t);
            return;
        }
        // Normal mode: fly to / track planet
        if (!focusedBody && !flying) return;
        focusedBody.getWorldPosition(_wp);
        if (flying) {
            flyProgress += dt / FLY_DURATION;
            if (flyProgress >= 1) {
                flyProgress = 1;
                flying = false;
                // Capture final offset after fly completes
                cameraOffset.copy(camera.position).sub(_wp);
            }
            const t = smoothstep(flyProgress);
            camera.position.lerpVectors(flyStart, flyEnd, t);
            orbit.target.lerpVectors(flyTargetStart, flyTargetEnd, t);
            // Update fly end as planet orbits
            flyTargetEnd.copy(_wp);
            flyEnd.copy(_wp).add(cameraOffset);
        }
        if (focusedBody && !flying) {
            // Track: keep camera offset relative to planet
            orbit.target.copy(_wp);
            camera.position.copy(_wp).add(cameraOffset);
        }
    }

    // When user drags during tracking, update the offset
    orbit.addEventListener('change', () => {
        if (focusedBody && !flying) {
            focusedBody.getWorldPosition(_wp);
            cameraOffset.copy(camera.position).sub(_wp);
        }
    });

    // ── DOM helpers ────────────────────────────────────────────────
    const $ = (sel) => document.querySelector(sel);
    const scaleSlider = $('#scale-slider');
    const scaleVal = $('#scale-value');
    const speedSlider = $('#speed-slider');
    const speedVal = $('#speed-value');
    const eccSlider = $('#ecc-slider');
    const eccVal = $('#ecc-value');
    const MAX = sys.MAX_SCALE;

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
        // 动态调整相机最近缩放: 1x→0.5, 1200x及以上→5
        orbit.minDistance = Math.min(5, 0.5 + (s - 1) * 4.5 / 1199);
        if (s === 1) {
            scaleVal.textContent = t('control.scaleReal');
        } else if (s < 10) {
            scaleVal.textContent = 'x' + s.toFixed(1);
        } else {
            scaleVal.textContent = 'x' + Math.round(s);
        }
    }
    scaleSlider.addEventListener('input', () => {
        updateScale();
        const s = sliderToScale(parseFloat(scaleSlider.value));
        // Phase 2: trigger quest event
        const q = document.querySelector('#qt-toast-container') ? null : null;
        if (window.__questEngine) {
            window.__questEngine.trigger('scale_change', { value: s });
        }
        saveSettings();
    });

    // ── Speed slider ───────────────────────────────────────────────
    function sliderToSpeed(v) {
        const maxRatio = 365 / MIN_SPEED; // 365 / (1/24) = 8760
        return MIN_SPEED * Math.pow(maxRatio, v / 100);
    }

    function speedToSlider(s) {
        const maxRatio = 365 / MIN_SPEED;
        return Math.log(s / MIN_SPEED) / Math.log(maxRatio) * 100;
    }

    function updateSpeed() {
        const v = parseFloat(speedSlider.value);
        const speed = sliderToSpeed(v);
        sys.setSpeed(speed);
        if (speed < 1) {
            const hours = speed * 24;
            const val = hours < 10 ? hours.toFixed(1) : Math.round(hours);
            speedVal.textContent = t('control.speedHourPerSec', { val: String(val) });
        } else {
            const val = speed < 10 ? speed.toFixed(1) : Math.round(speed);
            speedVal.textContent = t('control.speedDayPerSec', { val: String(val) });
        }
    }
    speedSlider.addEventListener('input', () => {
        updateSpeed();
        const speed = sliderToSpeed(parseFloat(speedSlider.value));
        if (window.__questEngine) {
            window.__questEngine.trigger('time_speed', { value: speed });
        }
        if (window.__achievement) {
            window.__achievement.evaluate();
        }
        saveSettings();
    });

    // ── Eccentricity slider (linear 0x..4x) ─────────────────────────
    function sliderToEcc(v) {
        return v / 40 * ECC_MAX;
    }

    function eccToSlider(m) {
        return m / ECC_MAX * 40;
    }

    function updateEcc() {
        const v = parseFloat(eccSlider.value);
        const m = sliderToEcc(v);
        sys.setEccentricityMultiplier(m);
        if (m === 1) {
            eccVal.textContent = t('control.eccReal');
        } else {
            eccVal.textContent = t('control.eccDemo', { val: m.toFixed(1) });
        }
    }
    eccSlider.addEventListener('input', () => {
        updateEcc();
        const m = sliderToEcc(parseFloat(eccSlider.value));
        if (window.__questEngine) {
            window.__questEngine.trigger('eccentric_change', { value: m });
        }
        if (window.__achievement) {
            window.__achievement.evaluate();
        }
        saveSettings();
    });

    // ── Settings persistence ──────────────────────────────────────
    const SETTINGS_KEY = 'solar-system-settings';

    function saveSettings() {
        const settings = {
            scale: parseFloat(scaleSlider.value),
            speed: parseFloat(speedSlider.value),
            ecc: parseFloat(eccSlider.value),
            labels: $('#labels-toggle').checked,
            orbits: $('#orbits-toggle').checked,
            distance: $('#distance-toggle').checked,
            size: $('#size-toggle').checked,
            ecliptic: $('#ecliptic-toggle').checked,
            music: $('#music-toggle').checked,
            collapsed: $('#controls-panel').classList.contains('ctrl-collapsed'),
        };
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
    }

    function loadSettings() {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (!raw) return false;
            const s = JSON.parse(raw);
            if (typeof s.scale === 'number') scaleSlider.value = String(Math.round(s.scale));
            if (typeof s.speed === 'number') speedSlider.value = String(Math.round(s.speed));
            if (typeof s.ecc === 'number') eccSlider.value = String(Math.round(s.ecc));
            if (typeof s.labels === 'boolean') $('#labels-toggle').checked = s.labels;
            if (typeof s.orbits === 'boolean') $('#orbits-toggle').checked = s.orbits;
            if (typeof s.distance === 'boolean') $('#distance-toggle').checked = s.distance;
            if (typeof s.size === 'boolean') $('#size-toggle').checked = s.size;
            if (typeof s.ecliptic === 'boolean') $('#ecliptic-toggle').checked = s.ecliptic;
            if (typeof s.music === 'boolean') $('#music-toggle').checked = s.music;
            if (s.collapsed) $('#controls-panel').classList.add('ctrl-collapsed');
            return true;
        } catch (e) { return false; }
    }

    function initSettings() {
        const restored = loadSettings();
        if (!restored) {
            scaleSlider.value = String(Math.round(scaleToSlider(DEFAULT_SCALE)));
            speedSlider.value = String(Math.round(speedToSlider(DEFAULT_SPEED)));
            eccSlider.value = String(Math.round(eccToSlider(DEFAULT_ECC)));
        }
        updateScale();
        updateSpeed();
        updateEcc();
        // Dispatch change events to trigger registered toggle handlers
        labelToggle.dispatchEvent(new Event('change'));
        orbitToggle.dispatchEvent(new Event('change'));
        distToggle.dispatchEvent(new Event('change'));
        sizeToggle.dispatchEvent(new Event('change'));
        eclipticToggle.dispatchEvent(new Event('change'));
        musicToggle.dispatchEvent(new Event('change'));
        // Smoothly fly back to sun if focused, otherwise snap
        if (focusedBody) {
            flyBack();
        } else {
            camera.position.set(0, 120, 200);
            clearFocus();
        }
        saveSettings();
    }

    // ── Toggles ────────────────────────────────────────────────────
    const labelToggle = $('#labels-toggle');
    labelToggle.addEventListener('change', () => {
        sys.setLabelsVisible(labelToggle.checked);
        saveSettings();
    });

    const orbitToggle = $('#orbits-toggle');
    orbitToggle.addEventListener('change', () => {
        sys.planets.forEach((p) => {
            const og = p.orbitGroup;
            og.children.forEach((child) => {
                if (child.isLine) child.visible = orbitToggle.checked;
            });
        });
        // Also toggle Moon orbit line
        if (sys.moon && sys.moon.orbitLine) {
            sys.moon.orbitLine.visible = orbitToggle.checked;
        }
        // Also toggle comet orbit lines (keep trails visible — they're a visual effect)
        if (sys.comets) {
            sys.comets.forEach((c) => {
                if (c.orbitLine) c.orbitLine.visible = orbitToggle.checked;
            });
        }
        // Also toggle node lines
        sys.planets.forEach((p) => {
            if (p.nodeLine) p.nodeLine.visible = orbitToggle.checked;
        });
        saveSettings();
    });

    const distToggle = $('#distance-toggle');
    distToggle.addEventListener('change', () => {
        document.getElementById('distance-panel').style.display =
            distToggle.checked ? '' : 'none';
        saveSettings();
    });

    const sizeToggle = $('#size-toggle');
    sizeToggle.addEventListener('change', () => {
        document.getElementById('size-panel').style.display =
            sizeToggle.checked ? '' : 'none';
        saveSettings();
    });

    const eclipticToggle = $('#ecliptic-toggle');
    eclipticToggle.addEventListener('change', () => {
        sys.eclipticDisc.visible = eclipticToggle.checked;
        saveSettings();
    });

    // ── Ambient music toggle ───────────────────────────────────────
    const musicToggle = $('#music-toggle');
    musicToggle.addEventListener('change', () => {
        if (musicToggle.checked) {
            ambientMusic.start();
        } else {
            ambientMusic.stop();
        }
        saveSettings();
    });

    initSettings();

    // ── Double-click to reset ──────────────────────────────────────
    renderer.domElement.addEventListener('dblclick', () => {
        // Reset sliders + camera; keep toggle preferences untouched
        scaleSlider.value = String(Math.round(scaleToSlider(DEFAULT_SCALE)));
        speedSlider.value = String(Math.round(speedToSlider(DEFAULT_SPEED)));
        eccSlider.value = String(Math.round(eccToSlider(DEFAULT_ECC)));
        updateScale();
        updateSpeed();
        updateEcc();
        saveSettings();
        if (focusedBody) { flyBack(); }
        else { camera.position.set(0, 120, 200); clearFocus(); }
    });

    // ── Control panel collapse ──────────────────────────────────────
    const ctrlPanel = $('#controls-panel');
    const ctrlHandle = $('#ctrl-handle');
    ctrlHandle.addEventListener('click', () => {
        ctrlPanel.classList.toggle('ctrl-collapsed');
        saveSettings();
    });

    // ── Build size comparison panel (radius circles) ────────────────
    function buildSizePanel() {
        const list = document.getElementById('size-list');
        const isEn = getLang() === 'en-US';
        const items = [
            { name: isEn ? 'Sun' : '太阳', color: '#ffcc44', radius: 695508 },
            ...sys.planets.map(p => ({
                name: isEn ? p.data.english : p.data.name,
                color: '#' + p.data.color.toString(16).padStart(6, '0'),
                radius: p.data.radius,
            })),
        ];
        // Sort by radius descending
        items.sort((a, b) => b.radius - a.radius);

        // Jupiter = max circle size
        const maxPlanetR = items[1].radius; // Jupiter
        const MAX_DIAM = 100;
        const MIN_DIAM = 3;

        // Find earth for ratio
        const earth = items.find(it => it.name === 'Earth' || it.name === '地球');
        const ratio = earth ? Math.round(items[0].radius / earth.radius) : 109;

        let html = '';
        for (let i = 0; i < items.length; i++) {
            const d = items[i];
            if (i === 0) {
                html += '<div class="sp-row">'
                    + '<span class="sp-circle-frame"><span class="sp-circle sp-circle-sun" style="width:130px;height:130px;background:' + d.color + '"></span></span>'
                    + '<span class="sp-name">' + d.name + '</span>'
                    + '<span class="sp-rad">' + d.radius.toLocaleString() + ' km</span>'
                    + '</div>'
                    + '<div class="sp-note">≈' + ratio + (isEn ? ' × Earth' : ' × 地球') + '</div>';
            } else {
                const diam = Math.max(MIN_DIAM, Math.round(d.radius / maxPlanetR * MAX_DIAM));
                html += '<div class="sp-row">'
                    + '<span class="sp-circle-frame"><span class="sp-circle" style="width:' + diam + 'px;height:' + diam + 'px;background:' + d.color + '"></span></span>'
                    + '<span class="sp-name">' + d.name + '</span>'
                    + '<span class="sp-rad">' + d.radius.toLocaleString() + ' km</span>'
                    + '</div>';
            }
        }
        list.innerHTML = html;
    }

    function refreshSliderValues() {
        updateScale();
        updateSpeed();
        updateEcc();
    }

    onLangChange(() => {
        buildSizePanel();
        refreshSliderValues();
        if (focusedId) refreshFocusLabel();
    });

    // ── Window resize ──────────────────────────────────────────────
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        sys.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    });

    return { orbit, setFocus, clearFocus, flyBack, updateFocus, getFocusedId: () => focusedId };
}
