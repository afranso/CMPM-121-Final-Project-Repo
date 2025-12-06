import * as THREE from "three";
import { GameScene } from "./GameScene.ts";
import { UIManager } from "./UIManager.ts";
import { GameState } from "./saveManager.ts";

/**
 * LevelTwo - a lightweight second level that demonstrates scene switching.
 * Objective: reach and interact with the green goal cube.
 */
export class LevelTwo extends GameScene {
  private ui: UIManager;
  private goal!: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private centerPoint = new THREE.Vector2(0, 0);

  constructor() {
    super();
    this.ui = new UIManager();
    this.ui.showStandardControls();
    this.ui.showTopCenter(
      "LEVEL 2: Reach the green goal and interact to finish.",
    );

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
      0xdddddd,
    );

    // Walls
    this.createBody(
      { x: 0.5, y: 6, z: 20 },
      0,
      new THREE.Vector3(-10 + 0.25, 3, 0),
      0x999999,
    );
    this.createBody(
      { x: 0.5, y: 6, z: 20 },
      0,
      new THREE.Vector3(10 - 0.25, 3, 0),
      0x999999,
    );
    this.createBody(
      { x: 20, y: 6, z: 0.5 },
      0,
      new THREE.Vector3(0, 3, -10 + 0.25),
      0x999999,
    );

    // A goal cube to interact with
    this.goal = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x00cc00 }),
    );
    this.goal.position.set(0, 0.5, -8);
    this.scene.add(this.goal);

    // Lighting
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemi.position.set(0, 20, 0);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 0.4);
    dir.position.set(5, 10, 5);
    this.scene.add(dir);
  }

  private setupInteractions() {
    this.ui.createInteractButton(() => this.inputManager.queueInteract());
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
      if (hits.length > 0 && hits[0].object === this.goal) {
        this.onGoalReached();
      }
    }
  }

  private onGoalReached() {
    this.ui.showOverlay("🎉 LEVEL 2 COMPLETE 🎉", "You reached the goal!");
    this.inputManager.clear();
    // notify global listeners (optional)
    try {
      (globalThis as unknown as Window).dispatchEvent(
        new CustomEvent("levelComplete", { detail: { level: 2 } }),
      );
    } catch (e) {
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
