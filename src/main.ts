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

  // Create save/load buttons using UIManager
  currentScene.getUI().createSaveLoadButtons(
    () => {
      console.log("Save button clicked");
      saveLoadUI.show("save");
    },
    () => {
      console.log("Load button clicked");
      saveLoadUI.show("load");
    },
    () => {
      if (confirm("Start a new game? This will reset all progress.")) {
        console.log("New game button clicked");
        currentScene.resetToInitialState();
      }
    },
  );

  // Keyboard handlers for save/load menus - capture at document level
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape" || e.code === "Escape") {
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
