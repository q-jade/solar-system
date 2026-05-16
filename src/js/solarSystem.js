import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject }
    from 'three/examples/jsm/renderers/CSS2DRenderer.js';

// ── Scene scale constants ──────────────────────────────────────────────
const AU = 40;                      // 1 AU in scene units
const KM_PER_U = 149597870.7 / AU;  // km per scene unit
const SUN_RADIUS = 8;               // fixed sun size
const MAX_SCALE = 3000;             // max planet size multiplier

// ── Real planetary data (JPL HORIZONS, epoch J2000) ────────────────────
// radius: km | orbitA: AU | e: eccentricity | incl: ° |
// argPeri (ω): ° | node (Ω): ° | m0 (M at J2000): rad |
// period: Earth days | rotPeriod: Earth days
const PLANET_DATA = [
    {
        name: '水星', english: 'Mercury', color: 0xaaaaaa,
        radius: 2439.7, orbitA: 0.3871, e: 0.2056, incl: 7.0,
        argPeri: 29.1, node: 48.3, m0: 3.2,
        period: 87.969, rotPeriod: 58.646,
    },
    {
        name: '金星', english: 'Venus', color: 0xe6b800,
        radius: 6051.8, orbitA: 0.7233, e: 0.0068, incl: 3.39,
        argPeri: 54.9, node: 76.7, m0: 2.1,
        period: 224.701, rotPeriod: -243.025,
    },
    {
        name: '地球', english: 'Earth', color: 0x2266cc,
        radius: 6371.0, orbitA: 1.0, e: 0.0167, incl: 0.0,
        argPeri: 102.9, node: 348.7, m0: 1.0,
        period: 365.256, rotPeriod: 1.0,
    },
    {
        name: '火星', english: 'Mars', color: 0xcc4422,
        radius: 3389.5, orbitA: 1.5237, e: 0.0934, incl: 1.85,
        argPeri: 286.5, node: 49.6, m0: 5.4,
        period: 686.98, rotPeriod: 1.025,
    },
    {
        name: '木星', english: 'Jupiter', color: 0xddbb99,
        radius: 69911, orbitA: 5.2028, e: 0.0484, incl: 1.30,
        argPeri: 273.9, node: 100.5, m0: 0.7,
        period: 4332.59, rotPeriod: 0.4135,
    },
    {
        name: '土星', english: 'Saturn', color: 0xeeddbb,
        radius: 58232, orbitA: 9.5388, e: 0.0541, incl: 2.49,
        argPeri: 339.4, node: 113.7, m0: 4.1,
        period: 10759.22, rotPeriod: 0.444,
        rings: true,
    },
    {
        name: '天王星', english: 'Uranus', color: 0x88ccdd,
        radius: 25362, orbitA: 19.1914, e: 0.0472, incl: 0.77,
        argPeri: 96.7, node: 74.0, m0: 2.8,
        period: 30685.4, rotPeriod: -0.718,
    },
    {
        name: '海王星', english: 'Neptune', color: 0x4466ff,
        radius: 24622, orbitA: 30.0611, e: 0.0086, incl: 1.77,
        argPeri: 273.2, node: 131.8, m0: 5.6,
        period: 60189.0, rotPeriod: 0.671,
    },
];

// ── Axial tilts (degrees from orbital plane normal) ─────────────────
const AXIAL_TILTS = {
    earth: 23.44, mars: 25.19, jupiter: 3.13,
    saturn: 26.73, uranus: 97.77, neptune: 28.32,
    venus: 177.4,  mercury: 0.034,
};

const MOON = {
    name: '月球', color: 0xcccccc,
    radius: 1737.4, orbitKm: 384400, period: 27.322,
    e: 0.0549, incl: 5.145, node: 125.08, argPeri: 0, m0: 0,
};

// ── Comet data (JPL HORIZONS orbital elements) ──────────────────────
const COMET_DATA = [
    {
        name: '哈雷彗星', english: 'Halley', color: 0x88ccff,
        a: 17.834, e: 0.967, i: 162.3,
        Omega: 58.42, omega: 111.33, M0: 0.6699,
        period: 75.3 * 365.25, // days
    },
    {
        name: '海尔波普', english: 'HaleBopp', color: 0xffcc88,
        a: 186, e: 0.995, i: 89.4,
        Omega: 282.5, omega: 130.6, M0: 0.015,
        period: 2533 * 365.25, // days
    },
];

const ASTEROID_COUNT = 5000;
const ASTEROID_A_MIN = 2.2;
const ASTEROID_A_MAX = 3.2;

// ── Kepler solver (Newton's method) ────────────────────────────────────
function solveKepler(M, e) {
    M = M - Math.PI * 2 * Math.floor(M / (Math.PI * 2));
    // Better initial guess for high eccentricity
    let E = e > 0.9 ? M + Math.sign(Math.sin(M)) * e * 0.8 : M;
    if (Math.abs(Math.sin(M)) < 1e-10) E = M + e;
    for (let i = 0; i < 50; i++) {
        const s = E - e * Math.sin(E) - M;
        const c = 1 - e * Math.cos(E);
        let dE = s / c;
        // Clamp step to prevent overshoot
        dE = Math.max(-0.6, Math.min(0.6, dE));
        E -= dE;
        if (Math.abs(dE) < 1e-12) break;
    }
    return E;
}

// ── Entry point ────────────────────────────────────────────────────────
export function initSolarSystem(textures) {
    // textures: optional { key: THREE.Texture } map from textureLoader
    const tex = textures || {};

    const scene = new THREE.Scene();

    // ── Camera ──────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(
        60, window.innerWidth / window.innerHeight, 0.1, 20000
    );
    camera.position.set(0, 120, 200);
    camera.lookAt(0, 0, 0);

    // ── WebGL renderer ──────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        logarithmicDepthBuffer: true,
    });
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

    // ── Reference ecliptic plane disc (visual aid for inclination) ──
    const eclipticDisc = new THREE.Mesh(
        new THREE.RingGeometry(6, 160, 64),
        new THREE.MeshBasicMaterial({
            color: 0x778833,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthWrite: false,
        })
    );
    eclipticDisc.rotation.x = -Math.PI / 2;
    eclipticDisc.visible = false;
    scene.add(eclipticDisc);

    // ── Stars ───────────────────────────────────────────────────────
    // Background sphere stars (8000) with color & size variation
    const bgStarCount = 8000;
    const bgPos = new Float32Array(bgStarCount * 3);
    const bgColors = new Float32Array(bgStarCount * 3);
    const bgSizes = new Float32Array(bgStarCount);
    // Approx spectral type distribution: 76% red/orange, 12% yellow, 8% white, 4% blue
    const starTypes = [
        { weight: 0.04, r: 0.75, g: 0.85, b: 1.0, sizeBase: 0.6, sizeRange: 0.3 }, // O/B hot blue
        { weight: 0.08, r: 0.9,  g: 0.95, b: 1.0, sizeBase: 0.5, sizeRange: 0.3 }, // A/F white-blue
        { weight: 0.12, r: 1.0,  g: 1.0,  b: 0.8, sizeBase: 0.4, sizeRange: 0.3 }, // G yellow
        { weight: 0.40, r: 1.0,  g: 0.85, b: 0.6, sizeBase: 0.35, sizeRange: 0.25 }, // K orange
        { weight: 0.36, r: 1.0,  g: 0.7,  b: 0.5, sizeBase: 0.3, sizeRange: 0.2 }, // M red
    ];
    for (let i = 0; i < bgStarCount; i++) {
        const r = 10000 + Math.random() * 3000;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        bgPos[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
        bgPos[i * 3 + 1] = r * Math.cos(phi);
        bgPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
        // Pick spectral type
        const roll = Math.random();
        let cum = 0;
        let st = starTypes[0];
        for (const t of starTypes) {
            cum += t.weight;
            if (roll < cum) { st = t; break; }
        }
        const brightness = 0.6 + Math.random() * 0.4;
        bgColors[i * 3 + 0] = st.r * brightness;
        bgColors[i * 3 + 1] = st.g * brightness;
        bgColors[i * 3 + 2] = st.b * brightness;
        bgSizes[i] = st.sizeBase + Math.random() * st.sizeRange;
    }
    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
    bgGeo.setAttribute('color', new THREE.BufferAttribute(bgColors, 3));
    bgGeo.setAttribute('size', new THREE.BufferAttribute(bgSizes, 1));
    const bgMat = new THREE.PointsMaterial({
        size: 0.5, vertexColors: true, sizeAttenuation: true,
    });
    scene.add(new THREE.Points(bgGeo, bgMat));

    // Milky Way band — extra stars concentrated on galactic plane
    const mwCount = 2000;
    const mwPos = new Float32Array(mwCount * 3);
    const mwColors = new Float32Array(mwCount * 3);
    const mwSizes = new Float32Array(mwCount);
    for (let i = 0; i < mwCount; i++) {
        const dist = 9000 + Math.random() * 4000;     // distance range
        const angle = Math.random() * Math.PI * 2;       // around galaxy center
        // Gaussian spread above/below galactic plane (tight band)
        const spread = 800 + Math.random() * 500;
        const up = (Math.random() - 0.5) * spread;
        // Tilt galactic plane ~60° relative to ecliptic (visual approximation)
        const tilt = 60 * Math.PI / 180;
        const flatX = dist * Math.cos(angle);
        const flatZ = dist * Math.sin(angle);
        mwPos[i * 3 + 0] = flatX * Math.cos(tilt);
        mwPos[i * 3 + 1] = flatX * Math.sin(tilt) + up;
        mwPos[i * 3 + 2] = flatZ;
        // Milky Way stars: more blue-white, dust-reddened toward center
        const reddish = 0.5 + 0.5 * ((dist - 9000) / 4000);
        const br = 0.5 + Math.random() * 0.5;
        mwColors[i * 3 + 0] = 1.0 * br;
        mwColors[i * 3 + 1] = (0.8 + 0.2 * (1 - reddish)) * br;
        mwColors[i * 3 + 2] = (0.6 + 0.4 * (1 - reddish)) * br;
        mwSizes[i] = 0.15 + Math.random() * 0.3;
    }
    const mwGeo = new THREE.BufferGeometry();
    mwGeo.setAttribute('position', new THREE.BufferAttribute(mwPos, 3));
    mwGeo.setAttribute('color', new THREE.BufferAttribute(mwColors, 3));
    mwGeo.setAttribute('size', new THREE.BufferAttribute(mwSizes, 1));
    const mwMat = new THREE.PointsMaterial({
        size: 0.35, vertexColors: true, sizeAttenuation: true,
        transparent: true, opacity: 0.8,
    });
    scene.add(new THREE.Points(mwGeo, mwMat));

    // ── Sun ─────────────────────────────────────────────────────────
    // Glow texture
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 256;
    glowCanvas.height = 256;
    const gctx = glowCanvas.getContext('2d');
    const grad = gctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,200,80,1)');
    grad.addColorStop(0.15, 'rgba(255,160,30,0.7)');
    grad.addColorStop(0.4, 'rgba(255,100,10,0.25)');
    grad.addColorStop(1, 'rgba(255,100,10,0)');
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, 256, 256);
    const glowTexture = new THREE.CanvasTexture(glowCanvas);

    const sunGeo = new THREE.SphereGeometry(SUN_RADIUS, 48, 48);
    const sunMat = tex.sun
        ? new THREE.MeshBasicMaterial({ map: tex.sun })
        : new THREE.MeshBasicMaterial({ color: 0xffcc44 });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sun);

    const glowMat = new THREE.SpriteMaterial({
        map: glowTexture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const sunGlow = new THREE.Sprite(glowMat);
    sunGlow.scale.set(SUN_RADIUS * 4, SUN_RADIUS * 4, 1);
    scene.add(sunGlow);

    const sunLight = new THREE.PointLight(0xffcc66, 3, 0, 2);
    sunLight.castShadow = true;
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight(0x222244, 0.15));

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(100, 200, 200);
    scene.add(dirLight);

    // ── State ───────────────────────────────────────────────────────
    let currentScale = 1;
    let eMultiplier = 1;
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
        const omegaRad = d.argPeri * Math.PI / 180;
        const OmegaRad = d.node * Math.PI / 180;

        // Group hierarchy for full Euler rotation R_y(Ω)·R_x(i)·R_y(ω):
        //   outerGroup (Y-rot Ω) ── inclGroup (X-rot i) ── orbitGroup (Y-rot ω)
        const outerGroup = new THREE.Group();
        outerGroup.rotation.y = OmegaRad;
        scene.add(outerGroup);

        // ── Node line (dashed line along ascending-node direction) ──
        const nodeLen = orbitA * 1.6;
        const nodeLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-nodeLen, 0, 0),
                new THREE.Vector3(nodeLen, 0, 0),
            ]),
            new THREE.LineDashedMaterial({
                color: 0x67b8ff, transparent: true, opacity: 0.35,
                dashSize: 1.2, gapSize: 0.8,
            })
        );
        nodeLine.computeLineDistances();
        outerGroup.add(nodeLine);

        const inclGroup = new THREE.Group();
        inclGroup.rotation.x = inclRad;
        outerGroup.add(inclGroup);

        const orbitGroup = new THREE.Group();
        orbitGroup.rotation.y = omegaRad;
        inclGroup.add(orbitGroup);

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

        // ── Axial tilt group (inside scaleWrapper) ──
        const bodyId = (d.english || '').toLowerCase();
        const tiltDeg = AXIAL_TILTS[bodyId] || 0;
        const tiltSign = Math.cos(tiltDeg * Math.PI / 180) >= 0 ? 1 : -1;
        const tiltGroup = new THREE.Group();
        if (tiltDeg) tiltGroup.rotation.x = tiltDeg * Math.PI / 180;
        scaleWrapper.add(tiltGroup);
        const planetTex = tex[bodyId];
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(pRadius, planetTex ? 48 : 32, planetTex ? 48 : 32),
            planetTex
                ? new THREE.MeshStandardMaterial({ map: planetTex, roughness: 0.7 })
                : new THREE.MeshLambertMaterial({ color: d.color })
        );
        tiltGroup.add(mesh);

        // ── Saturn rings ──
        let ringMesh = null;
        if (d.rings) {
            const ringTex = bodyId === 'saturn' ? tex.saturnRing : null;
            let innerR;
            let outerR;
            if (ringTex) {
                // 纹理有透明通道，环的内径从 ×1.3 缩到 ×1.1、外径从 ×2.2 扩到 ×2.3
                innerR = pRadius * 1.1;
                outerR = pRadius * 2.3;
            } else {
                innerR = pRadius * 1.3;
                outerR = pRadius * 2.2;
            }
            const ringGeo = new THREE.RingGeometry(innerR, outerR, 64, 48);
            ringGeo.rotateX(-Math.PI / 2);

            if (ringTex) {
                const pos = ringGeo.attributes.position;
                const ruv = ringGeo.attributes.uv;
                const v3 = new THREE.Vector3();

                for (let i = 0; i < pos.count; i++) {
                    v3.fromBufferAttribute(pos, i);

                    // 半径 -> 纹理水平方向（环带）
                    const radius = v3.length();
                    const u = (radius - innerR) / (outerR - innerR);

                    // 角度 -> 纹理垂直方向（环绕一周）
                    // atan2 范围是 -PI ~ PI，映射到 0 ~ 1
                    const angle = Math.atan2(v3.y, v3.x);
                    const v = (angle + Math.PI) / (2 * Math.PI);

                    ruv.setXY(i, u, v);
                }
                ruv.needsUpdate = true;

                // 关键：角度方向（v）是循环的，必须设为 Repeat，否则接缝处会断裂
                ringTex.wrapT = THREE.RepeatWrapping;
                ringTex.wrapS = THREE.ClampToEdgeWrapping; // 径向方向不需要重复
            }
            ringMesh = new THREE.Mesh(
                ringGeo,
                ringTex
                    ? new THREE.MeshBasicMaterial({
                        map: ringTex,
                        side: THREE.DoubleSide,
                        transparent: true,
                        opacity: 0.9,
                    })
                    : new THREE.MeshLambertMaterial({
                        color: 0xbba87f, side: THREE.DoubleSide,
                        transparent: true, opacity: 0.6,
                    })
            );
            tiltGroup.add(ringMesh);
        }

        // ── Atmospheric glow (planet-specific colors) ──
        let atmoMesh = null;
        const ATMO_CONFIG = {
            earth:  { color: [0.3, 0.6, 1.0], scale: 1.025, power: 3.0, intensity: 0.55 },
            venus:  { color: [0.9, 0.7, 0.3], scale: 1.02,  power: 4.0, intensity: 0.25 },
            mars:   { color: [0.8, 0.3, 0.2], scale: 1.015, power: 4.0, intensity: 0.2 },
        };
        const ac = ATMO_CONFIG[bodyId];
        if (ac) {
            const [r, g, b] = ac.color;
            atmoMesh = new THREE.Mesh(
                new THREE.SphereGeometry(pRadius * ac.scale, 36, 36),
                new THREE.ShaderMaterial({
                    vertexShader: `
                        varying vec3 vNormal;
                        varying vec3 vPosition;
                        void main() {
                            vNormal = normalize(normalMatrix * normal);
                            vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
                    fragmentShader: `
                        uniform vec3 uColor;
                        uniform float uPower;
                        uniform float uIntensity;
                        varying vec3 vNormal;
                        varying vec3 vPosition;
                        void main() {
                            vec3 viewDir = normalize(-vPosition);
                            float rim = 1.0 - max(0.0, dot(viewDir, vNormal));
                            float alpha = pow(rim, uPower) * uIntensity;
                            gl_FragColor = vec4(uColor, alpha);
                        }
                    `,
                    uniforms: {
                        uColor: { value: new THREE.Color(r, g, b) },
                        uPower: { value: ac.power },
                        uIntensity: { value: ac.intensity },
                    },
                    transparent: true,
                    side: THREE.FrontSide,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                })
            );
            tiltGroup.add(atmoMesh);
        }

        // ── Earth special layers (clouds + night lights) ──
        let cloudMesh = null;
        if (bodyId === 'earth' && tex.earthClouds) {
            const cloudR = pRadius * 1.015;
            cloudMesh = new THREE.Mesh(
                new THREE.SphereGeometry(cloudR, 48, 48),
                new THREE.MeshPhongMaterial({
                    map: tex.earthClouds,
                    transparent: true,
                    opacity: 0.35,
                    blending: THREE.AdditiveBlending,
                    side: THREE.DoubleSide,
                    depthWrite: false,
                })
            );
            tiltGroup.add(cloudMesh);
        }
        let nightMesh = null;
        if (bodyId === 'earth' && tex.earthNight) {
            nightMesh = new THREE.Mesh(
                new THREE.SphereGeometry(pRadius * 1.002, 48, 48),
                new THREE.MeshBasicMaterial({
                    map: tex.earthNight,
                    blending: THREE.AdditiveBlending,
                    transparent: true,
                    opacity: 0.6,
                    depthWrite: false,
                })
            );
            tiltGroup.add(nightMesh);
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
            orbitGroup,
            orbitLine,
            mesh,
            atmoMesh,
            cloudMesh,
            nightMesh,
            pRadius,
            tiltSign,
            orbitA,
            originalE: d.e,
            inclRad,
            omegaRad,
            OmegaRad,
            nodeLine,
            meanAnomaly: d.m0,
            angularSpeed: 2 * Math.PI / d.period, // rad / Earth day
        });
    }

    // ── Moon (orbits Earth, scaled with planet size) ───────────────
    const earth = planets[2];
    const moonRadius = MOON.radius / KM_PER_U;
    // Semi-major axis (dynamic, keeps moon close at all scales)
    const moonBaseDist = earth.pRadius * 1.1 + moonRadius;
    const moonE = MOON.e;
    const moonInclRad = MOON.incl * Math.PI / 180;
    const moonOmegaRad = MOON.argPeri * Math.PI / 180;
    const moonOmegaNodeRad = MOON.node * Math.PI / 180;

    const moonSystem = new THREE.Group();  // scaled by currentScale
    earth.posGroup.add(moonSystem);

    // Orbital element group hierarchy for the Moon:
    //   moonSystem ── outerGroup (Ω) ── inclGroup (i) ── orbitGroup (ω)
    const moonOuterGroup = new THREE.Group();
    moonOuterGroup.rotation.y = moonOmegaNodeRad;
    moonSystem.add(moonOuterGroup);

    const moonInclGroup = new THREE.Group();
    moonInclGroup.rotation.x = moonInclRad;
    moonOuterGroup.add(moonInclGroup);

    const moonOrbitGroup = new THREE.Group();
    moonOrbitGroup.rotation.y = moonOmegaRad;
    moonInclGroup.add(moonOrbitGroup);

    // Moon orbit line (elliptical, at base distance; scaled by moonSystem)
    const moonOrbitPts = [];
    for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const r = moonBaseDist * (1 - moonE * moonE) / (1 + moonE * Math.cos(a));
        moonOrbitPts.push(
            new THREE.Vector3(r * Math.cos(a), 0, r * Math.sin(a))
        );
    }
    const moonOrbitLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(moonOrbitPts),
        new THREE.LineBasicMaterial({ color: 0x8cb8ce, transparent: true, opacity: 0.35 })
    );
    moonOrbitGroup.add(moonOrbitLine);

    // Moon position group (moves along elliptical orbit)
    const moonPosGroup = new THREE.Group();
    moonOrbitGroup.add(moonPosGroup);

    const moonMat = tex.moon
        ? new THREE.MeshStandardMaterial({ map: tex.moon, roughness: 0.8 })
        : new THREE.MeshLambertMaterial({ color: MOON.color });
    const moonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(moonRadius, moonMat ? 32 : 16, moonMat ? 32 : 16),
        moonMat
    );
    moonPosGroup.add(moonMesh);

    const moonObj = {
        system: moonSystem,
        orbitGroup: moonOrbitGroup,
        posGroup: moonPosGroup,
        mesh: moonMesh,
        radius: moonRadius,
        baseDist: moonBaseDist,
        e: moonE,
        orbitLine: moonOrbitLine,
        meanAnomaly: Math.random() * Math.PI * 2,
        angularSpeed: 2 * Math.PI / MOON.period,
        orbitalE: moonE,
    };

    // ── Comets ─────────────────────────────────────────────────────
    const comets = [];
    const cometLabels = [];
    for (const cd of COMET_DATA) {
        const orbitA = cd.a * AU;
        const inclRad = cd.i * Math.PI / 180;
        const omegaRad = cd.omega * Math.PI / 180;
        const OmegaRad = cd.Omega * Math.PI / 180;

        const outerGroup = new THREE.Group();
        outerGroup.rotation.y = OmegaRad;
        scene.add(outerGroup);

        const inclGroup = new THREE.Group();
        inclGroup.rotation.x = inclRad;
        outerGroup.add(inclGroup);

        const orbitGroup = new THREE.Group();
        orbitGroup.rotation.y = omegaRad;
        inclGroup.add(orbitGroup);

        // Comet orbit line
        const segs = 256;
        const pts = [];
        for (let i = 0; i <= segs; i++) {
            const a = (i / segs) * Math.PI * 2;
            const r = orbitA * (1 - cd.e * cd.e) / (1 + cd.e * Math.cos(a));
            pts.push(new THREE.Vector3(r * Math.cos(a), 0, r * Math.sin(a)));
        }
        const orbitLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({
                color: cd.color, transparent: true, opacity: 0.25,
            })
        );
        orbitGroup.add(orbitLine);

        // Comet position group
        const posGroup = new THREE.Group();
        orbitGroup.add(posGroup);

        // Comet mesh (small glowing sphere)
        const cometRadius = 0.5; // fixed visual size
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(cometRadius, 12, 12),
            new THREE.MeshBasicMaterial({ color: cd.color })
        );
        posGroup.add(mesh);

        // Comet tail (single cone with per-vertex alpha for smooth fading)
        const tailH = 10;
        const tailR = 0.8;
        const tailGeo = new THREE.ConeGeometry(tailR, tailH, 16);
        // Orient: apex (+Y) → -Z, base (-Y) → +Z. Then apex at origin.
        tailGeo.rotateX(-Math.PI / 2);
        tailGeo.translate(0, 0, tailH / 2);

        // Per-vertex alpha: fade radially (center→edge) AND axially (apex→base)
        const pos = tailGeo.attributes.position;
        const alpha = new Float32Array(pos.count);
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
            const radialDist = Math.sqrt(x * x + y * y);
            const axialFrac = z / tailH; // 0 at apex, 1 at base
            // Radial fade: 1 (center) → 0 (edge)
            const radialFade = Math.max(0, 0.5 - radialDist / tailR);
            // Axial fade: 1 (apex) → 0 (base)
            const axialFade = Math.max(0, 1 - axialFrac * 0.97);
            alpha[i] = radialFade * axialFade;
        }
        tailGeo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));

        const tailMesh = new THREE.Mesh(tailGeo, new THREE.ShaderMaterial({
            uniforms: { uColor: { value: new THREE.Color(cd.color) } },
            vertexShader: `
                attribute float alpha;
                varying float vAlpha;
                void main() {
                    vAlpha = alpha;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                varying float vAlpha;
                void main() {
                    gl_FragColor = vec4(uColor, vAlpha);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
        }));
        scene.add(tailMesh);

        // Comet label
        const label = makeLabel(cd.name, 12);
        label.position.set(0, 4, 0);
        posGroup.add(label);
        cometLabels.push(label);
        allLabels.push(label); // controlled by label toggle

        comets.push({
            data: cd,
            orbitA,
            originalE: cd.e,
            posGroup,
            mesh,
            tailMesh,
            orbitLine,
            meanAnomaly: cd.M0,
            angularSpeed: 2 * Math.PI / cd.period,
            label,
        });
    }

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

    let currentSpeedMul = 1;

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
        currentSpeedMul = speedMul;
        for (const p of planets) {
            p.angularSpeed = 2 * Math.PI / p.data.period * speedMul;
        }
        moonObj.angularSpeed = 2 * Math.PI / MOON.period * speedMul;
        if (comets) {
            for (const c of comets) {
                c.angularSpeed = 2 * Math.PI / c.data.period * speedMul;
            }
        }
        for (const a of astParams) {
            const period = 365.25 * Math.pow(a.a / AU, 1.5);
            a.speed = 2 * Math.PI / period * speedMul;
        }
    }

    /** @param {boolean} v */
    function setLabelsVisible(v) {
        for (const lbl of allLabels) lbl.visible = v;
    }

    /** @param {number} mult - eccentricity multiplier, ≧0 (1 = real) */
    function setEccentricityMultiplier(mult) {
        eMultiplier = Math.max(0, mult);
        for (const p of planets) {
            const effE = Math.min(p.originalE * mult, 0.99);
            // Rebuild orbit line geometry
            p.orbitGroup.remove(p.orbitLine);
            const segs = 128;
            const pts = [];
            for (let i = 0; i <= segs; i++) {
                const a = (i / segs) * Math.PI * 2;
                const r = p.orbitA * (1 - effE * effE) / (1 + effE * Math.cos(a));
                pts.push(new THREE.Vector3(r * Math.cos(a), 0, r * Math.sin(a)));
            }
            const newLine = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(pts),
                new THREE.LineBasicMaterial({
                    color: 0x8cb8ce, transparent: true, opacity: 0.4,
                })
            );
            // Preserve orbit visibility state
            const orbitToggle = document.getElementById('orbits-toggle');
            if (orbitToggle && !orbitToggle.checked) newLine.visible = false;
            p.orbitGroup.add(newLine);
            p.orbitLine = newLine;
        }
        // Rebuild Moon orbit line
        if (moonObj) {
            const effE = Math.min(moonObj.orbitalE * mult, 0.99);
            moonObj.orbitGroup.remove(moonObj.orbitLine);
            const segs = 64;
            const pts = [];
            for (let i = 0; i <= segs; i++) {
                const a = (i / segs) * Math.PI * 2;
                const r = moonObj.baseDist * (1 - effE * effE) / (1 + effE * Math.cos(a));
                pts.push(new THREE.Vector3(r * Math.cos(a), 0, r * Math.sin(a)));
            }
            const newLine = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(pts),
                new THREE.LineBasicMaterial({ color: 0x8cb8ce, transparent: true, opacity: 0.35 })
            );
            const orbitToggle = document.getElementById('orbits-toggle');
            if (orbitToggle && !orbitToggle.checked) newLine.visible = false;
            moonObj.orbitGroup.add(newLine);
            moonObj.orbitLine = newLine;
        }
    }

    /** Advance the simulation by `days` (Earth days). */
    function updateOrbits(days) {
        // Planets
        for (const p of planets) {
            const effE = Math.min(p.originalE * eMultiplier, 0.99);
            p.meanAnomaly += p.angularSpeed * days;
            const E = solveKepler(p.meanAnomaly, effE);
            const x = p.orbitA * (Math.cos(E) - effE);
            const z = p.orbitA * Math.sqrt(1 - effE * effE) * Math.sin(E);
            p.posGroup.position.set(x, 0, z);

            // Self-rotation (radians per Earth-day, signed for retrograde)
            // tiltSign: for axial tilts > 90°, local Y is inverted vs world Y,
            // so rotation direction must be flipped to compensate
            const rot = p.data.rotPeriod;
            const rotDir = rot > 0 ? 1 : -1;
            const rotRate = 2 * Math.PI / Math.abs(rot) * days * currentSpeedMul;
            p.mesh.rotation.y += rotDir * p.tiltSign * rotRate;

            // Earth clouds (faster) and night lights (same as surface)
            if (p.cloudMesh) {
                p.cloudMesh.rotation.y += rotDir * p.tiltSign * rotRate * 1.2;
            }
            if (p.nightMesh) {
                p.nightMesh.rotation.y += rotDir * p.tiltSign * rotRate;
            }
        }

        // Moon around Earth — elliptical orbit with real orbital elements
        moonObj.meanAnomaly += moonObj.angularSpeed * days;
        const effMoonE = Math.min(moonObj.orbitalE * eMultiplier, 0.99);
        const ME = solveKepler(moonObj.meanAnomaly, effMoonE);
        const mx = moonObj.baseDist * (Math.cos(ME) - effMoonE);
        const mz = moonObj.baseDist * Math.sqrt(1 - effMoonE * effMoonE) * Math.sin(ME);
        moonObj.posGroup.position.set(mx, 0, mz);

        // Comets — Kepler orbit with trail
        for (const c of comets) {
            c.meanAnomaly += c.angularSpeed * days;
            const E = solveKepler(c.meanAnomaly, c.originalE);
            const x = c.orbitA * (Math.cos(E) - c.originalE);
            const z = c.orbitA * Math.sqrt(1 - c.originalE * c.originalE) * Math.sin(E);
            c.posGroup.position.set(x, 0, z);

            // Comet world position
            const worldPos = new THREE.Vector3();
            c.posGroup.getWorldPosition(worldPos);

            // Tail: cone pointing away from sun
            const sunDir = new THREE.Vector3().copy(worldPos).normalize();
            // Orient tail cone: apex at comet, base extends away from sun
            c.tailMesh.position.copy(worldPos);
            c.tailMesh.lookAt(worldPos.clone().add(sunDir));
        }

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
        planets, moon: moonObj, comets, sun, asteroidBelt, eclipticDisc,
        setScale, setSpeed, setLabelsVisible, setEccentricityMultiplier,
        update: updateOrbits,
        SUN_RADIUS, MAX_SCALE,
    };
}
