import * as THREE from 'three';

/**
 * Planet data: name, color (hex), radius, orbit radius, orbital speed (rad/frame),
 * rotation speed (rad/frame), rings (optional)
 */
const PLANET_DATA = [
  { name: '水星', color: 0xaaaaaa, radius: 1.0, orbit: 15, speed: 0.040, rotSpeed: 0.004 },
  { name: '金星', color: 0xe6b800, radius: 1.8, orbit: 22, speed: 0.015, rotSpeed: 0.002 },
  { name: '地球', color: 0x2266cc, radius: 2.0, orbit: 30, speed: 0.010, rotSpeed: 0.010 },
  { name: '火星', color: 0xcc4422, radius: 1.4, orbit: 38, speed: 0.008, rotSpeed: 0.009 },
  { name: '木星', color: 0xddbb99, radius: 4.5, orbit: 50, speed: 0.005, rotSpeed: 0.020 },
  { name: '土星', color: 0xeeddbb, radius: 3.8, orbit: 65, speed: 0.003, rotSpeed: 0.018, rings: true },
  { name: '天王星', color: 0x88ccdd, radius: 2.8, orbit: 80, speed: 0.002, rotSpeed: 0.015 },
  { name: '海王星', color: 0x4466ff, radius: 2.7, orbit: 95, speed: 0.0018, rotSpeed: 0.012 },
];

export function initSolarSystem() {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 60, 120);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  document.getElementById('solar-system-container').appendChild(renderer.domElement);

  // --- Stars background ---
  const starsGeo = new THREE.BufferGeometry();
  const starsCount = 4000;
  const starsPos = new Float32Array(starsCount * 3);
  for (let i = 0; i < starsCount * 3; i++) {
    starsPos[i] = (Math.random() - 0.5) * 800;
  }
  starsGeo.setAttribute('position', new THREE.BufferAttribute(starsPos, 3));
  const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.4 });
  const stars = new THREE.Points(starsGeo, starsMat);
  scene.add(stars);

  // --- Sun ---
  const sunGeo = new THREE.SphereGeometry(8, 48, 48);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffaa33 });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  scene.add(sun);

  // Sun glow via point light
  const sunLight = new THREE.PointLight(0xffcc66, 2, 300);
  scene.add(sunLight);
  const ambientLight = new THREE.AmbientLight(0x222244, 0.5);
  scene.add(ambientLight);

  // --- Planets ---
  const planets = [];
  for (const data of PLANET_DATA) {
    // Orbit ring
    const orbitMat = new THREE.LineBasicMaterial({ color: 0x444466 });
    const orbitPoints = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      orbitPoints.push(
        new THREE.Vector3(data.orbit * Math.cos(angle), 0, data.orbit * Math.sin(angle))
      );
    }
    const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitLine = new THREE.Line(orbitGeo, orbitMat);
    scene.add(orbitLine);

    // Planet mesh
    const planetGeo = new THREE.SphereGeometry(data.radius, 32, 32);
    const planetMat = new THREE.MeshLambertMaterial({ color: data.color });
    const planet = new THREE.Mesh(planetGeo, planetMat);
    planet.position.x = data.orbit;
    scene.add(planet);

    // Saturn's rings
    if (data.rings) {
      const ringGeo = new THREE.RingGeometry(data.radius * 1.3, data.radius * 2.2, 48);
      const ringMat = new THREE.MeshLambertMaterial({
        color: 0xbba87f,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 3;
      planet.add(ring);
    }

    planets.push({
      mesh: planet,
      data: data,
      angle: Math.random() * Math.PI * 2,
    });
  }

  // Store scene, camera, renderer and planets on a shared object for the animation loop
  return { scene, camera, renderer, planets, stars };
}