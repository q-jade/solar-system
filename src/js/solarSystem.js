import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject }
    from 'three/examples/jsm/renderers/CSS2DRenderer.js';

// ── Scene scale constants ──────────────────────────────────────────────
const AU = 40;                      // 1 AU in scene units
const KM_PER_U = 149597870.7 / AU;  // km per scene unit
const SUN_RADIUS = 8;               // fixed sun size
const MAX_SCALE = 3000;             // max planet size multiplier

// ── Real planetary data (approximate) ──────────────────────────────────
// radius: km | orbitA: AU | eccentricity: unitless | inclination: °
// period: Earth days | rotPeriod: Earth days
const PLANET_DATA = [
    {
        name: '水星', color: 0xaaaaaa,
        radius: 2439.7, orbitA: 0.387, e: 0.2056, incl: 7.0,
        period: 87.97, rotPeriod: 58.646,
    },
    {
        name: '金星', color: 0xe6b800,
        radius: 6051.8, orbitA: 0.723, e: 0.0068, incl: 3.4,
        period: 224.7, rotPeriod: -243.025,
    },
    {
        name: '地球', color: 0x2266cc,
        radius: 6371.0, orbitA: 1.0, e: 0.0167, incl: 0.0,
        period: 365.25, rotPeriod: 1.0,
    },
    {
        name: '火星', color: 0xcc4422,
        radius: 3389.5, orbitA: 1.524, e: 0.0934, incl: 1.85,
        period: 687.0, rotPeriod: 1.025,
    },
    {
        name: '木星', color: 0xddbb99,
        radius: 69911, orbitA: 5.203, e: 0.0484, incl: 1.3,
        period: 4332.6, rotPeriod: 0.4135,
    },
    {
        name: '土星', color: 0xeeddbb,
        radius: 58232, orbitA: 9.537, e: 0.0539, incl: 2.49,
        period: 10759.2, rotPeriod: 0.444,
        rings: true,
    },
    {
        name: '天王星', color: 0x88ccdd,
        radius: 25362, orbitA: 19.191, e: 0.0473, incl: 0.77,
        period: 30688.5, rotPeriod: -0.718,
    },
    {
        name: '海王星', color: 0x4466ff,
        radius: 24622, orbitA: 30.069, e: 0.0086, incl: 1.77,
        period: 60182.3, rotPeriod: 0.671,
    },
];

const MOON = { name: '月球', color: 0xcccccc, radius: 1737.4, orbitKm: 384400, period: 27.3 };

const ASTEROID_COUNT = 5000;
const ASTEROID_A_MIN = 2.2;
const ASTEROID_A_MAX = 3.2;

// ── Kepler solver (Newton's method) ────────────────────────────────────
function solveKepler(M, e) {
    let E = M;
    for (let i = 0; i < 8; i++) {
        const dE = (M + e * Math.sin(E) - E) / (1 - e * Math.cos(E));
        E += dE;
        if (Math.abs(dE) < 1e-10) break;
    }
    return E;
}

// ── Entry point ────────────────────────────────────────────────────────
export function initSolarSystem() {
    const scene = new THREE.Scene();

    // ── Camera ──────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(
        60, window.innerWidth / window.innerHeight, 0.1, 5000
    );
    camera.position.set(0, 120, 200);
    camera.lookAt(0, 0, 0);

    // ── WebGL renderer ──────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    document.getElementById('solar-system-container').appendChild(renderer.domElement);

    // ── CSS2D renderer (labels) ─────────────────────────────────────
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    document.getElementById('solar-system-container').appendChild(labelRenderer.domElement);

    // ── Stars ───────────────────────────────────────────────────────
    const starCount = 1800;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        const r = 1500 + Math.random() * 900;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        starPos[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
        starPos[i * 3 + 1] = r * Math.cos(phi);
        starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.4 });
    scene.add(new THREE.Points(starGeo, starMat));

    // ── Sun ─────────────────────────────────────────────────────────
    const sunGeo = new THREE.SphereGeometry(SUN_RADIUS, 48, 48);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffaa33 });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sun);

    const sunLight = new THREE.PointLight(0xffcc66, 2, 600);
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight(0x222244, 0.3));

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 200, 200);
    scene.add(dirLight);

    // ── State ───────────────────────────────────────────────────────
    let currentScale = 1;
    const allLabels = [];   // CSS2DObject references

    // ── Helper: create a label div ──────────────────────────────────
    function makeLabel(text, fontSize) {
        const div = document.createElement('div');
        div.textContent = text;
        div.style.color = '#fff';
        div.style.fontSize = (fontSize || 14) + 'px';
        div.style.fontFamily = '"Microsoft YaHei","PingFang SC",sans-serif';
        div.style.fontWeight = '500';
        div.style.textShadow =
            '0 0 6px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,1), 0 0 1px #000';
        div.style.pointerEvents = 'none';
        div.style.userSelect = 'none';
        div.style.whiteSpace = 'nowrap';
        return new CSS2DObject(div);
    }

    // ── Build planets ──────────────────────────────────────────────
    const planets = [];

    for (const d of PLANET_DATA) {
        const orbitA = d.orbitA * AU;
        const pRadius = d.radius / KM_PER_U;   // real size in scene units
        const inclRad = d.incl * Math.PI / 180;

        // Orbital-plane group (tilted by inclination)
        const orbitGroup = new THREE.Group();
        orbitGroup.rotation.x = inclRad;
        scene.add(orbitGroup);

        // ── Elliptical orbit line ──
        const segs = 128;
        const pts = [];
        for (let i = 0; i <= segs; i++) {
            const a = (i / segs) * Math.PI * 2;
            const r = orbitA * (1 - d.e * d.e) / (1 + d.e * Math.cos(a));
            pts.push(new THREE.Vector3(r * Math.cos(a), 0, r * Math.sin(a)));
        }
        const orbitLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({ color: 0x8cb8ce, transparent: true, opacity: 0.4 })
        );
        orbitGroup.add(orbitLine);

        // ── Planet position group (moves along orbit) ──
        const posGroup = new THREE.Group();
        orbitGroup.add(posGroup);

        // ── Scale wrapper for planet mesh ──
        const scaleWrapper = new THREE.Group();
        posGroup.add(scaleWrapper);

        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(pRadius, 32, 32),
            new THREE.MeshLambertMaterial({ color: d.color })
        );
        scaleWrapper.add(mesh);

        // ── Saturn rings ──
        let ringMesh = null;
        if (d.rings) {
            ringMesh = new THREE.Mesh(
                new THREE.RingGeometry(pRadius * 1.3, pRadius * 2.2, 48),
                new THREE.MeshLambertMaterial({
                    color: 0xbba87f, side: THREE.DoubleSide,
                    transparent: true, opacity: 0.6,
                })
            );
            ringMesh.rotation.x = Math.PI / 3;
            scaleWrapper.add(ringMesh);
        }

        // ── Label (sibling of scale-wrapper, above planet) ──
        const label = makeLabel(d.name, d.name.length <= 2 ? 15 : 13);
        label.position.set(0, pRadius * 2 + 3, 0);
        posGroup.add(label);
        allLabels.push(label);

        planets.push({
            data: d,
            posGroup,
            scaleWrapper,
            mesh,
            pRadius,
            orbitA,
            e: d.e,
            inclRad,
            meanAnomaly: Math.random() * Math.PI * 2,
            angularSpeed: 2 * Math.PI / d.period, // rad / Earth day
        });
    }

    // ── Moon (orbits Earth, scaled with planet size) ───────────────
    const earth = planets[2];
    const moonRadius = MOON.radius / KM_PER_U;
    // Base orbit distance (without scale) = 1.1 Earth radii + 1 Moon radius
    const moonBaseDist = earth.pRadius * 1.1 + moonRadius;

    const moonSystem = new THREE.Group();  // scaled by currentScale
    earth.posGroup.add(moonSystem);

    // Moon orbit line (at base distance; scaled visually by moonSystem)
    const moonOrbitPts = [];
    for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        moonOrbitPts.push(
            new THREE.Vector3(moonBaseDist * Math.cos(a), 0, moonBaseDist * Math.sin(a))
        );
    }
    const moonOrbitLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(moonOrbitPts),
        new THREE.LineBasicMaterial({ color: 0x8cb8ce, transparent: true, opacity: 0.35 })
    );
    moonSystem.add(moonOrbitLine);

    // Moon position group (moves along orbit within moonSystem)
    const moonPosGroup = new THREE.Group();
    moonSystem.add(moonPosGroup);

    const moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(moonRadius, 16, 16),
        new THREE.MeshLambertMaterial({ color: MOON.color })
    );
    moonPosGroup.add(moonMesh);

    const moonObj = {
        system: moonSystem,
        posGroup: moonPosGroup,
        mesh: moonMesh,
        radius: moonRadius,
        baseDist: moonBaseDist,
        orbitLine: moonOrbitLine,
        meanAnomaly: Math.random() * Math.PI * 2,
        angularSpeed: 2 * Math.PI / MOON.period,
    };

    // ── Asteroid belt ──────────────────────────────────────────────
    const astParams = [];
    for (let i = 0; i < ASTEROID_COUNT; i++) {
        const a = ASTEROID_A_MIN + Math.random() * (ASTEROID_A_MAX - ASTEROID_A_MIN);
        const e = Math.random() * 0.15;
        const incl = (Math.random() - 0.5) * 10 * Math.PI / 180;
        const omega = Math.random() * Math.PI * 2;
        const Omega = Math.random() * Math.PI * 2;
        astParams.push({
            a: a * AU,
            e,
            incl,
            omega,
            Omega,
            M: Math.random() * Math.PI * 2,
            speed: 2 * Math.PI / (365.25 * Math.pow(a, 1.5)),
            r: 0,
        });
    }

    const astPos = new Float32Array(ASTEROID_COUNT * 3);
    const astGeo = new THREE.BufferGeometry();
    astGeo.setAttribute('position', new THREE.BufferAttribute(astPos, 3));
    const astMat = new THREE.PointsMaterial({
        color: 0x888877, size: 0.4, sizeAttenuation:true, transparent: true, opacity: 0.82,
    });
    const astPoints = new THREE.Points(astGeo, astMat);
    scene.add(astPoints);

    const asteroidBelt = { points: astPoints, params: astParams, geometry: astGeo };

    // ── Set initial positions ──────────────────────────────────────
    updateOrbits(0);

    // ── Public API ─────────────────────────────────────────────────

    /** @param {number} s - scale factor, 1..3000 */
    function setScale(s) {
        currentScale = Math.max(1, Math.min(MAX_SCALE, s));
        for (const p of planets) {
            p.scaleWrapper.scale.setScalar(currentScale);
            const lbl = p.posGroup.children.find(c => c.isCSS2DObject);
            if (lbl) lbl.position.set(0, p.pRadius * currentScale * 2 + 3, 0);
        }
        moonObj.system.scale.setScalar(currentScale);
    }

    /** @param {number} speedMul - multiplier (1 = 1 scene-second = 1 day) */
    function setSpeed(speedMul) {
        for (const p of planets) {
            p.angularSpeed = 2 * Math.PI / p.data.period * speedMul;
        }
        moonObj.angularSpeed = 2 * Math.PI / MOON.period * speedMul;
        for (const a of astParams) {
            const period = 365.25 * Math.pow(a.a / AU, 1.5);
            a.speed = 2 * Math.PI / period * speedMul;
        }
    }

    /** @param {boolean} v */
    function setLabelsVisible(v) {
        for (const lbl of allLabels) lbl.visible = v;
    }

    /** Advance the simulation by `days` (Earth days). */
    function updateOrbits(days) {
        // Planets
        for (const p of planets) {
            p.meanAnomaly += p.angularSpeed * days;
            const E = solveKepler(p.meanAnomaly, p.e);
            const x = p.orbitA * (Math.cos(E) - p.e);
            const z = p.orbitA * Math.sqrt(1 - p.e * p.e) * Math.sin(E);
            p.posGroup.position.set(x, 0, z);

            // Self-rotation (radians per Earth-day, signed for retrograde)
            const rot = p.data.rotPeriod;
            p.mesh.rotation.y += (rot > 0 ? 1 : -1)
                * 2 * Math.PI / Math.abs(rot) * days;
        }

        // Moon around Earth (orbit distance scales with planet size)
        moonObj.meanAnomaly += moonObj.angularSpeed * days;
        const ang = moonObj.meanAnomaly;
        moonObj.posGroup.position.set(
            moonObj.baseDist * Math.cos(ang), 0, moonObj.baseDist * Math.sin(ang)
        );

        // Asteroid belt — full 3D orbital geometry
        const pos = astGeo.attributes.position.array;
        for (let i = 0; i < ASTEROID_COUNT; i++) {
            const a = astParams[i];
            a.M += a.speed * days;
            const E = solveKepler(a.M, a.e);
            const x0 = a.a * (Math.cos(E) - a.e);
            const z0 = a.a * Math.sqrt(1 - a.e * a.e) * Math.sin(E);
            const ci = Math.cos(a.incl);
            const si = Math.sin(a.incl);
            const cw = Math.cos(a.omega);
            const sw = Math.sin(a.omega);
            const cO = Math.cos(a.Omega);
            const sO = Math.sin(a.Omega);
            // 1) Rotate by ω around Three.js Y (orbital plane rotation)
            const x1 = x0 * cw + z0 * sw;
            const z1 = -x0 * sw + z0 * cw;
            // 2) Rotate by i around X (inclination tilt)
            const x2 = x1;
            const y2 = -z1 * si;
            const z2 = z1 * ci;
            // 3) Rotate by Ω around Y (orient ascending node)
            pos[i * 3]     = x2 * cO + z2 * sO;
            pos[i * 3 + 1] = y2;
            pos[i * 3 + 2] = -x2 * sO + z2 * cO;
        }
        astGeo.attributes.position.needsUpdate = true;
    }

    // Initialise at 1x speed
    setSpeed(1);
    setLabelsVisible(true);

    return {
        scene, camera, renderer, labelRenderer,
        planets, moon: moonObj, sun, asteroidBelt,
        setScale, setSpeed, setLabelsVisible,
        update: updateOrbits,
        SUN_RADIUS, MAX_SCALE,
    };
}
