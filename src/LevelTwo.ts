import * as THREE from "three";
import { GameScene } from "./GameScene.ts";
import { UIManager } from "./UIManager.ts";
import { GameState } from "./saveManager.ts";

const BASE_COLORS = {
  LIGHT: {
    WALL: 0x999999,
    FLOOR: 0xdddddd,
    PLATES: [0x3366ff, 0x33cc33, 0xcc3333, 0xffcc33],
    GATE: 0x552200,
    GOAL: 0x00cc00,
  },
  DARK: {
    WALL: 0x222222,
    FLOOR: 0x333333,
    PLATES: [0x2244ff, 0x228822, 0x882222, 0x886622],
    GATE: 0x553322,
    GOAL: 0x228822,
  },
};

/**
 * LevelTwo - a lightweight second level that demonstrates scene switching.
 * Objective: reach and interact with the green goal cube.
 */
export class LevelTwo extends GameScene {
  private ui: UIManager;
  private goal!: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private centerPoint = new THREE.Vector2(0, 0);
  // Theme/colors
  private COLORS = BASE_COLORS.LIGHT;
  private hemisphereLight!: THREE.HemisphereLight;
  private directionalLight!: THREE.DirectionalLight;
  // Puzzle: sequence plates + gate
  private plates: THREE.Mesh[] = [];
  private platePressed: boolean[] = [];
  private targetSequence: number[] = [2, 0, 3, 1];
  private sequenceIndex = 0;
  private gate!: THREE.Mesh;
  private gateBodyInWorld = true;

  constructor() {
    super();
    this.ui = new UIManager();
    this.ui.showStandardControls();
    this.ui.showTopCenter(
      "LEVEL 2: Reach the green goal and interact to finish.",
    );

    // Initialize theme from UI preference
    this.COLORS = this.ui.isDark() ? BASE_COLORS.DARK : BASE_COLORS.LIGHT;

    // Listen for system theme changes
    const darkModeQuery = globalThis.matchMedia?.(
      "(prefers-color-scheme: dark)",
    );
    darkModeQuery?.addEventListener("change", (e: MediaQueryListEvent) => {
      this.COLORS = e.matches ? BASE_COLORS.DARK : BASE_COLORS.LIGHT;
      this.updateVisualTheme();
    });

    this.setupLevel();
    this.setupInteractions();
  }

  public getUI(): UIManager {
    return this.ui;
  }

  protected setupPlayer(): void {
    const startPos = new THREE.Vector3(0, 0.9, 5);
    this.playerMesh = this.createBody(
      { x: 1, y: 1.8, z: 1 },
      this.PLAYER_MASS,
      startPos,
      0x00ff00,
    );
    this.playerBody = this.playerMesh.userData.physicsBody as Ammo.btRigidBody;
    this.playerBody.setAngularFactor(new Ammo.btVector3(0, 1, 0));
    this.playerMesh.visible = false;

    this.camera.position.set(startPos.x, startPos.y + 0.5, startPos.z);
    this.camera.lookAt(0, 1, 0);
    this.initPlayerController();
  }

  private setupLevel() {
    // Floor
    this.createBody(
      { x: 20, y: 1, z: 20 },
      0,
      new THREE.Vector3(0, -0.5, 0),
      this.COLORS.FLOOR,
    );

    // Walls
    this.createBody(
      { x: 0.5, y: 6, z: 20 },
      0,
      new THREE.Vector3(-10 + 0.25, 3, 0),
      this.COLORS.WALL,
    );
    this.createBody(
      { x: 0.5, y: 6, z: 20 },
      0,
      new THREE.Vector3(10 - 0.25, 3, 0),
      this.COLORS.WALL,
    );
    this.createBody(
      { x: 20, y: 6, z: 0.5 },
      0,
      new THREE.Vector3(0, 3, -10 + 0.25),
      this.COLORS.WALL,
    );

    // Gate that blocks access to the goal until puzzle is solved
    this.gate = this.createBody(
      { x: 4, y: 2, z: 0.5 },
      0,
      new THREE.Vector3(0, 1, -4),
      this.COLORS.GATE,
    );

    // Create four colored sequence plates in front of the gate
    const plateColors = this.COLORS.PLATES;
    const platePositions = [-3, -1, 1, 3];
    for (let i = 0; i < 4; i++) {
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.2, 1.2),
        new THREE.MeshStandardMaterial({ color: plateColors[i] }),
      );
      plate.position.set(platePositions[i], 0.1, -2);
      this.plates.push(plate);
      this.platePressed.push(false);
      this.scene.add(plate);
    }

    // A goal cube to interact with (behind the gate)
    this.goal = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: this.COLORS.GOAL }),
    );
    this.goal.position.set(0, 0.5, -8);
    this.scene.add(this.goal);

    // Lighting (theme-aware)
    this.setupLighting();

    // Initial objective text describes the new puzzle
    this.ui.showTopCenter(
      "LEVEL 2: Solve the plate sequence to open the gate. Interact with plates in order.",
    );
  }

  private setupInteractions() {
    this.ui.createInteractButton(() => this.inputManager.queueInteract());
  }

  private setupLighting() {
    const isDark = this.COLORS === BASE_COLORS.DARK;

    this.hemisphereLight = new THREE.HemisphereLight(
      isDark ? 0x222244 : 0xffffff,
      isDark ? 0x111111 : 0x444444,
      isDark ? 0.3 : 0.6,
    );
    this.hemisphereLight.position.set(0, 20, 0);
    this.scene.add(this.hemisphereLight);

    this.directionalLight = new THREE.DirectionalLight(
      isDark ? 0x666666 : 0xffffff,
      isDark ? 0.2 : 0.4,
    );
    this.directionalLight.position.set(5, 10, 5);
    this.scene.add(this.directionalLight);
  }

  private updateVisualTheme() {
    const isDark = this.COLORS === BASE_COLORS.DARK;
    if (this.hemisphereLight) {
      this.hemisphereLight.color.set(isDark ? 0x222244 : 0xffffff);
      this.hemisphereLight.groundColor.set(isDark ? 0x111111 : 0x444444);
      this.hemisphereLight.intensity = isDark ? 0.3 : 0.6;
    }
    if (this.directionalLight) {
      this.directionalLight.color.set(isDark ? 0x666666 : 0xffffff);
      this.directionalLight.intensity = isDark ? 0.2 : 0.4;
    }

    // Update plates
    this.plates.forEach((p, i) => {
      const mat = p.material as THREE.MeshStandardMaterial;
      mat.color.set(this.COLORS.PLATES[i]);
    });

    // Update gate and goal
    if (this.gate) {
      (this.gate.material as THREE.MeshStandardMaterial).color.set(
        this.COLORS.GATE,
      );
    }
    if (this.goal) {
      (this.goal.material as THREE.MeshStandardMaterial).color.set(
        this.COLORS.GOAL,
      );
    }
  }

  public override update() {
    super.update();

    // If player requested an interaction, raycast forward from center
    if (this.inputManager.consumeInteractRequest()) {
      this.raycaster.setFromCamera(this.centerPoint, this.camera);
      const objects = this.scene.children.filter((obj) =>
        obj !== this.playerMesh
      );
      const hits = this.raycaster.intersectObjects(objects);
      if (hits.length > 0) {
        const hit = hits[0].object as THREE.Mesh;
        // Plate interaction
        const plateIndex = this.plates.indexOf(hit);
        if (plateIndex >= 0) {
          this.handlePlateInteraction(plateIndex);
          return;
        }
        // Goal interaction (only reachable after gate opens)
        if (hit === this.goal) {
          this.onGoalReached();
          return;
        }
      }
    }
  }

  private handlePlateInteraction(index: number) {
    // If already pressed, ignore
    if (this.platePressed[index]) return;

    const expected = this.targetSequence[this.sequenceIndex];
    if (index === expected) {
      // Correct plate
      this.platePressed[index] = true;
      (this.plates[index].material as THREE.MeshStandardMaterial).emissive =
        new THREE.Color(0x222222);
      this.sequenceIndex++;
      this.ui.showMessage(`Good! (${this.sequenceIndex}/4)`);
      this.ui.showTopCenter(
        `Sequence Progress: ${"●".repeat(this.sequenceIndex)}${
          "○".repeat(4 - this.sequenceIndex)
        }`,
      );
      if (this.sequenceIndex >= this.targetSequence.length) {
        this.onSequenceComplete();
      }
    } else {
      // Wrong plate - reset
      this.ui.showMessage("Wrong plate! Sequence reset.", 1500);
      this.resetPlates();
    }
  }

  private resetPlates() {
    this.platePressed.fill(false);
    for (const p of this.plates) {
      (p.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(
        0x000000,
      );
    }
    this.sequenceIndex = 0;
    this.ui.showTopCenter(
      "LEVEL 2: Solve the plate sequence to open the gate. Interact with plates in order.",
    );
  }

  private onSequenceComplete() {
    this.ui.showMessage("Sequence complete! Gate opening...");
    // Remove gate physics and hide mesh
    if (this.gate.userData.physicsBody && this.gateBodyInWorld) {
      this.physicsWorld.removeRigidBody(this.gate.userData.physicsBody);
      this.gateBodyInWorld = false;
    }
    this.gate.visible = false;
    this.ui.showTopCenter("Gate opened! Reach the green cube to finish.");
  }

  private onGoalReached() {
    this.ui.showOverlay("🎉 LEVEL 2 COMPLETE 🎉", "You reached the goal!");
    this.inputManager.clear();
    // Wait 4 seconds so the overlay is visible, then notify global listeners to load LevelThree
    try {
      setTimeout(() => {
        (globalThis as unknown as Window).dispatchEvent(
          new CustomEvent("levelComplete", { detail: { level: 3 } }),
        );
      }, 4000);
    } catch {
      // ignore in non-browser environments
    }
  }

  public saveState(): GameState {
    // Minimal save state for LevelTwo - keep compatibility with SaveManager.GameState
    const pos = this.playerMesh.position;
    const rot = this.camera.rotation;
    const vel = this.playerBody.getLinearVelocity();

    return {
      timestamp: Date.now(),
      playerState: {
        position: { x: pos.x, y: pos.y, z: pos.z },
        rotation: { x: rot.x, y: rot.y, z: rot.z },
        velocity: { x: vel.x(), y: vel.y(), z: vel.z() },
      },
      inventory: [],
      levelState: {
        doorOpened: false,
        chestOpened: false,
        wrongLandings: 0,
        blockSpawningEnabled: false,
        boardBroken: false,
        boardHits: 0,
      },
      batsCollected: 0,
      keyVisible: false,
      batsVisible: [],
    };
  }

  public loadState(state: GameState): void {
    // Restore basic player transform + velocity
    const pos = state.playerState.position;
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
    this.playerBody.setWorldTransform(transform);

    const vel = state.playerState.velocity;
    this.playerBody.setLinearVelocity(new Ammo.btVector3(vel.x, vel.y, vel.z));
    this.playerBody.setAngularVelocity(new Ammo.btVector3(0, 0, 0));

    this.camera.position.set(pos.x, pos.y + 0.5, pos.z);
    const rot = state.playerState.rotation;
    this.camera.rotation.set(rot.x, rot.y, rot.z);

    this.ui.showMessage("Game loaded into Level 2", 2000);
  }

  public resetToInitialState(): void {
    // Reset player
    const startPos = new THREE.Vector3(0, 0.9, 5);
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(startPos.x, startPos.y, startPos.z));
    this.playerBody.setWorldTransform(transform);
    this.playerBody.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
    this.playerBody.setAngularVelocity(new Ammo.btVector3(0, 0, 0));

    this.camera.position.set(startPos.x, startPos.y + 0.5, startPos.z);
    this.camera.lookAt(0, 1, 0);

    this.ui.showMessage("New game started (Level 2)", 1500);
  }

  public override dispose() {
    super.dispose();
    this.ui.dispose();
  }
}
