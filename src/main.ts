import * as THREE from "three";
import { GameScene } from "./GameScene.ts";
import { LevelOne } from "./LevelOne.ts";
import { SaveLoadUI } from "./saveLoadUI.ts";
import { SaveManager } from "./saveManager.ts";
import "./style.css";

// 1. Wait for Ammo to initialize
import("ammo.js").then((AmmoModule: unknown) => {
  // Vite pre-processes ammo.js - mod.default is already the Ammo instance
  const mod = AmmoModule as { default?: unknown };

  console.log("Ammo.js loaded and initialized successfully");
  // Make Ammo available globally - it's already initialized by Vite
  (globalThis as unknown as { Ammo: typeof mod.default }).Ammo = mod.default;
  initApp();
}).catch((error: unknown) => {
  console.error("Failed to load Ammo.js:", error);
  throw error;
});

function initApp() {
  // Renderer Setup
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Scene Management
  const currentScene: GameScene = new LevelOne();

  // Save System Setup
  const saveManager = new SaveManager();
  const saveLoadUI = new SaveLoadUI(saveManager);

  // Set up save callback to capture current game state
  saveManager.setSaveCallback(() => {
    return currentScene.saveState();
  });

  // Set up load callback
  saveLoadUI.setLoadCallback((slotId: number) => {
    const state = saveManager.load(slotId);
    if (state) {
      currentScene.loadState(state);
    }
  });

  // Set up save callback for UI
  saveLoadUI.setSaveCallback((slotId: number) => {
    saveManager.save(slotId);
  });

  // Add instructions for save/load
  const instructionsDiv = document.createElement("div");
  instructionsDiv.className = "ui-save-instructions";
  instructionsDiv.innerHTML = `
    <div>F5: Save Menu | F9: Load Menu</div>
    <div style="margin-top: 8px;">
      <button class="quick-save-btn" style="margin-right: 5px;">💾 Save</button>
      <button class="quick-load-btn">📂 Load</button>
    </div>
  `;
  document.body.appendChild(instructionsDiv);

  // Add click handlers for the buttons
  instructionsDiv.querySelector(".quick-save-btn")?.addEventListener(
    "click",
    () => {
      console.log("Save button clicked");
      saveLoadUI.show("save");
    },
  );

  instructionsDiv.querySelector(".quick-load-btn")?.addEventListener(
    "click",
    () => {
      console.log("Load button clicked");
      saveLoadUI.show("load");
    },
  );

  // Keyboard handlers for save/load menus - capture at document level
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    console.log("Key pressed:", e.key, "Code:", e.code); // Debug all keys

    if (e.key === "F5" || e.code === "F5") {
      e.preventDefault();
      e.stopPropagation();
      console.log("F5 pressed - Opening save menu");
      saveLoadUI.show("save");
    } else if (e.key === "F9" || e.code === "F9") {
      e.preventDefault();
      e.stopPropagation();
      console.log("F9 pressed - Opening load menu");
      saveLoadUI.show("load");
    } else if (e.key === "Escape" || e.code === "Escape") {
      console.log("ESC pressed - Closing save/load menu");
      saveLoadUI.hide();
    }
  }, true); // Use capture phase to get events before other handlers

  // Try to load auto-save on startup
  const autoSave = saveManager.load(0);
  if (autoSave) {
    console.log("Auto-save found, loading...");
    setTimeout(() => {
      currentScene.loadState(autoSave);
    }, 500);
  }

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
