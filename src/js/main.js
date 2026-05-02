import '../css/style.css';
import { initSolarSystem } from './solarSystem.js';
import { initControls } from './controls.js';

const sys = initSolarSystem();
const { scene, camera, renderer, planets } = sys;
const controls = initControls(camera, renderer);

function animate() {
  requestAnimationFrame(animate);
  controls.update();

  // Animate planets
  for (const p of planets) {
    p.angle += p.data.speed;
    p.mesh.position.x = p.data.orbit * Math.cos(p.angle);
    p.mesh.position.z = p.data.orbit * Math.sin(p.angle);
    p.mesh.rotation.y += p.data.rotSpeed;
  }

  renderer.render(scene, camera);
}
animate();

// Window resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});