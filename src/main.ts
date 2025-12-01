import * as THREE from "three";
import { GameScene } from "./GameScene.ts";
import { LevelOne } from "./LevelOne.ts";

// 1. Wait for Ammo to initialize
Ammo().then(() => {
  initApp();
});

function initApp() {
  // Renderer Setup
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Scene Management
  const currentScene: GameScene = new LevelOne();

  // Resize Handler
  globalThis.addEventListener("resize", () => {
    const camera = currentScene.getCamera();
    camera.aspect = globalThis.innerWidth / globalThis.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
  });

  // The Render Loop
  function animate() {
    requestAnimationFrame(animate);

    // Update physics and game logic
    currentScene.update();

    // Render
    renderer.render(currentScene.getScene(), currentScene.getCamera());
  }

  animate();
}
