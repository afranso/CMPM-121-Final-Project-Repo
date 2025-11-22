import * as THREE from "three";
import AmmoPromise from "./ammoLoader.ts";
import "./style.css";

// Minimal Three.js scene: camera, renderer, cube, and animation loop.
// DELETE ONCE WE START WORKING ON CODE
const canvas = document.createElement("canvas");
canvas.id = "three-canvas";
document.body.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

const camera = new THREE.PerspectiveCamera(
  60,
  globalThis.innerWidth / globalThis.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 1.5, 3);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7.5);
scene.add(light);

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x00aaff });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

function onWindowResize() {
  camera.aspect = globalThis.innerWidth / globalThis.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
}
globalThis.addEventListener("resize", onWindowResize, false);

function animate() {
  requestAnimationFrame(animate);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}

animate();

// Initialize Ammo (optional here — only required where physics are needed)
// Initialize Ammo (optional here — only required where physics are needed)
AmmoPromise
  .then((AmmoModule: unknown) => {
    console.log("Ammo initialized:", !!AmmoModule);
    // Initialize physics world or call into a physics module here.
  })
  .catch((err: unknown) => {
    console.error("Failed to initialize Ammo:", err);
  });
