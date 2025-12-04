import * as THREE from "three";
import { GameScene } from "./GameScene.ts";
import { UIManager } from "./UIManager.ts";
import { BlockPool, PooledBlock } from "./objectPool.ts";

const BASE_COLORS = {
  LIGHT: {
    WALL: 0xcccccc,
    FLOOR: 0xeeeeee,
    BUTTON: 0xff4444,
    KEY: 0xffff00,
    BOARD: 0x775533,
    CHEST: 0x8B4513,
    BAT: 0x964B00,
  },
  DARK: {
    WALL: 0x222222,
    FLOOR: 0x333333,
    BUTTON: 0xff4444,
    KEY: 0xffff00,
    BOARD: 0x553322,
    CHEST: 0x4B2E1D,
    BAT: 0x5C2E1D,
  },
};

export class LevelOne extends GameScene {
  private ui: UIManager;
  private raycaster = new THREE.Raycaster();
  private doorMesh!: THREE.Mesh;
  private button!: THREE.Mesh;
  private marker!: THREE.Mesh;
  private keyMesh!: THREE.Mesh;
  private chest!: THREE.Mesh;
  private bats: THREE.Mesh[] = [];
  private batCount = 0;
  private board!: THREE.Mesh;
  private inventory: string[] = [];
  private state = {
    doorOpened: false,
    chestOpened: false,
    wrongLandings: 0,
    blockSpawningEnabled: true,
    boardBroken: false,
  };
  private blocks: Array<{
    mesh: THREE.Mesh;
    body: Ammo.btRigidBody;
    pooled?: PooledBlock;
    handled: boolean;
  }> = [];
  private blockPool!: BlockPool;
  private COLORS = BASE_COLORS.LIGHT;

  // FPS look
  private yaw = 0;
  private pitch = 0;
  private sensitivity = 0.002;

  constructor() {
    super();
    this.ui = new UIManager();

    const darkModeQuery = globalThis.matchMedia?.(
      "(prefers-color-scheme: dark)",
    );
    if (darkModeQuery?.matches) this.COLORS = BASE_COLORS.DARK;

    darkModeQuery?.addEventListener("change", (e: MediaQueryListEvent) => {
      this.COLORS = e.matches ? BASE_COLORS.DARK : BASE_COLORS.LIGHT;
      this.updateVisualTheme();
    });

    this.blockPool = new BlockPool(this.physicsWorld, this.scene, 25);

    this.setupLevel();
    this.setupInteractions();

    this.ui.showTopLeft(
      "Objective: Collect all 3 bats to break the barricade.",
    );
    this.ui.showTopRight(
      "Controls:\n- WASD: Move\n- Mouse: Look\n- Left Click: Interact / Pick Up\n- E: Open Door",
    );
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

    this.initPlayerController(); // keeps WASD movement
  }

  private setupLevel() {
    this.createRoom(0, true);
    this.createRoom(-20, false);

    this.createDoor();
    this.createButton();
    this.createMarker();
    this.createKey();
    this.createChest();

    this.createBats();
    this.createBoard(); // board moved to bats room
    this.setupLighting();
  }

  private setupLighting() {
    const hemi = new THREE.HemisphereLight(
      this.COLORS === BASE_COLORS.DARK ? 0x222244 : 0xffffff,
      this.COLORS === BASE_COLORS.DARK ? 0x111111 : 0x444444,
      this.COLORS === BASE_COLORS.DARK ? 0.3 : 0.6,
    );
    hemi.position.set(0, 20, 0);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(
      this.COLORS === BASE_COLORS.DARK ? 0x666666 : 0xffffff,
      this.COLORS === BASE_COLORS.DARK ? 0.2 : 0.6,
    );
    dir.position.set(5, 10, 5);
    this.scene.add(dir);
  }

  private updateVisualTheme() {
    this.scene.traverse((obj) => {
      if (
        obj instanceof THREE.Mesh &&
        obj.material instanceof THREE.MeshStandardMaterial
      ) {
        switch (obj) {
          case this.board:
            obj.material.color.set(this.COLORS.BOARD);
            break;
          case this.chest:
            obj.material.color.set(this.COLORS.CHEST);
            break;
          case this.button:
            obj.material.color.set(this.COLORS.BUTTON);
            break;
          case this.keyMesh:
            obj.material.color.set(this.COLORS.KEY);
            break;
          default:
            if (
              obj.geometry instanceof THREE.BoxGeometry && obj !== this.doorMesh
            ) {
              obj.material.color.set(this.COLORS.WALL);
            }
        }
      }
    });

    this.scene.children.forEach((obj) => {
      if (obj instanceof THREE.HemisphereLight) {
        obj.color.set(this.COLORS === BASE_COLORS.DARK ? 0x222244 : 0xffffff);
        obj.groundColor.set(
          this.COLORS === BASE_COLORS.DARK ? 0x111111 : 0x444444,
        );
        obj.intensity = this.COLORS === BASE_COLORS.DARK ? 0.3 : 0.6;
      }
      if (obj instanceof THREE.DirectionalLight) {
        obj.color.set(this.COLORS === BASE_COLORS.DARK ? 0x666666 : 0xffffff);
        obj.intensity = this.COLORS === BASE_COLORS.DARK ? 0.2 : 0.6;
      }
    });
  }

  private createRoom(zOffset: number, hasDoor: boolean) {
    this.createBody(
      { x: 20, y: 1, z: 20 },
      0,
      new THREE.Vector3(0, -0.5, zOffset),
      this.COLORS.FLOOR,
    );

    const W = 20,
      H = 6,
      T = 0.5;

    if (!(hasDoor && zOffset === 0)) {
      this.createBody(
        { x: W, y: H, z: T },
        0,
        new THREE.Vector3(0, 3, zOffset - 10 + 0.25),
        this.COLORS.WALL,
      );
    }
    this.createBody(
      { x: T, y: H, z: W },
      0,
      new THREE.Vector3(-10 + 0.25, 3, zOffset),
      this.COLORS.WALL,
    );
    this.createBody(
      { x: T, y: H, z: W },
      0,
      new THREE.Vector3(10 - 0.25, 3, zOffset),
      this.COLORS.WALL,
    );

    if (hasDoor) {
      this.createBody(
        { x: 9, y: 6, z: 0.5 },
        0,
        new THREE.Vector3(-5.5, 3, -9.5),
        this.COLORS.WALL,
      );
      this.createBody(
        { x: 9, y: 6, z: 0.5 },
        0,
        new THREE.Vector3(5.5, 3, -9.5),
        this.COLORS.WALL,
      );
      this.createBody(
        { x: 2, y: 3, z: 0.5 },
        0,
        new THREE.Vector3(0, 4.5, -9.5),
        this.COLORS.WALL,
      );
    }
  }

  private createDoor() {
    this.doorMesh = this.createBody(
      { x: 2, y: 3, z: 0.2 },
      0,
      new THREE.Vector3(0, 1.5, -9.5),
      0x552200,
    );
  }

  private openDoor() {
    if (this.state.doorOpened) return;
    this.state.doorOpened = true;
    if (this.doorMesh.userData.physicsBody) {
      this.physicsWorld.removeRigidBody(this.doorMesh.userData.physicsBody);
    }
    this.doorMesh.visible = false;
    this.ui.showMessage("Door Unlocked!");
  }

  private createButton() {
    this.button = this.createBody(
      { x: 1, y: 0.2, z: 1 },
      0,
      new THREE.Vector3(0, 0.1, -6),
      this.COLORS.BUTTON,
    );
  }

  private createMarker() {
    this.marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.1),
      new THREE.MeshStandardMaterial({ color: 0xffff00 }),
    );
    this.scene.add(this.marker);
  }

  private createKey() {
    this.keyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.2),
      new THREE.MeshStandardMaterial({ color: this.COLORS.KEY }),
    );
    this.keyMesh.position.set(1.5, 0.2, -6);
    this.keyMesh.visible = false;
    this.scene.add(this.keyMesh);
  }

  private createChest() {
    this.chest = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.5, 1),
      new THREE.MeshStandardMaterial({ color: this.COLORS.CHEST }),
    );
    this.chest.position.set(0, 0.25, -15);
    this.scene.add(this.chest);
  }

  private createBats() {
    const positions = [
      new THREE.Vector3(-2, 1, -15),
      new THREE.Vector3(0, 1, -15),
      new THREE.Vector3(2, 1, -15),
    ];
    positions.forEach((p) => {
      const bat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 2),
        new THREE.MeshStandardMaterial({ color: this.COLORS.BAT }),
      );
      bat.position.copy(p);
      this.bats.push(bat);
      this.scene.add(bat);
    });
  }

  private createBoard() {
    this.board = new THREE.Mesh(
      new THREE.BoxGeometry(3, 2, 0.3),
      new THREE.MeshStandardMaterial({ color: this.COLORS.BOARD }),
    );
    this.board.position.set(0, 1, -18.5); // front of back wall in bats room
    this.board.visible = true;
    this.scene.add(this.board);
  }

  private setupInteractions() {
    // Mouse look + WASD already handled by initPlayerController
    globalThis.addEventListener("pointermove", (event: MouseEvent) => {
      this.yaw -= event.movementX * this.sensitivity;
      this.pitch -= event.movementY * this.sensitivity;
      this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
      this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");

      const coords = this.inputManager.getNormalizedMousePosition();
      this.raycastUpdateMarker(coords);
    });

    globalThis.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const coords = this.inputManager.getNormalizedMousePosition();
      this.handleLeftClick(coords);
    });
  }

  private raycastUpdateMarker(coords: THREE.Vector2) {
    this.raycaster.setFromCamera(coords, this.camera);
    const objects = this.scene.children.filter((obj) => obj !== this.marker);
    const hits = this.raycaster.intersectObjects(objects);
    if (hits.length > 0) {
      this.marker.position.copy(hits[0].point).add(
        new THREE.Vector3(0, 0.05, 0),
      );
    }
  }

  private tryBreakBoard() {
    if (!this.board.visible) return;
    if (this.batCount < 3) {
      this.ui.showMessage("You need all 3 bats to break the board!");
      return;
    }
    const dist = this.playerMesh.position.distanceTo(this.board.position);
    if (dist > 3) {
      this.ui.showMessage("Move closer to hit the board.");
      return;
    }
    this.board.visible = false;
    this.state.boardBroken = true;
    this.ui.showMessage("You smashed the board!", 2000);
    setTimeout(() => this.gameOver(), 1000);
  }

  private handleLeftClick(coords: THREE.Vector2) {
    this.raycaster.setFromCamera(coords, this.camera);
    const visible = this.scene.children.filter((obj) =>
      (obj as THREE.Mesh).visible !== false
    );
    const intersects = this.raycaster.intersectObjects(visible);
    if (intersects.length === 0) return;

    // PICK UP KEY
    if (
      intersects.find((i) => i.object === this.keyMesh) && this.keyMesh.visible
    ) {
      this.keyMesh.visible = false;
      this.inventory.push("Key");
      this.ui.updateInventory(this.inventory);
      this.ui.showMessage("Picked up Key!");
      return;
    }

    // CHEST
    if (intersects.find((i) => i.object === this.chest)) {
      if (this.inventory.includes("Key")) {
        (this.chest.material as THREE.MeshStandardMaterial).color.set(0xD2B48C);
        this.state.chestOpened = true;
        this.ui.showMessage("Chest Opened!");
      } else {
        this.ui.showMessage("Locked. Needs Key.");
      }
      return;
    }

    // PICK UP BATS
    for (const bat of this.bats) {
      if (intersects.find((i) => i.object === bat) && bat.visible) {
        bat.visible = false;
        this.batCount++;
        const batLabel = `Bat ×${this.batCount}`;
        this.inventory = this.inventory.filter((i) => !i.startsWith("Bat"));
        this.inventory.push(batLabel);
        this.ui.updateInventory(this.inventory);
        this.ui.showMessage(`Picked up Bat (${this.batCount}/3)`);
        return;
      }
    }

    // HIT BOARD
    if (intersects.find((i) => i.object === this.board) && this.batCount > 0) {
      this.tryBreakBoard();
      return;
    }

    if (this.state.blockSpawningEnabled) this.spawnBlock(this.marker.position);
  }

  private spawnBlock(pos: THREE.Vector3) {
    if (this.camera.position.z < -10) {
      this.ui.showMessage("Cannot spawn here.");
      return;
    }
    const spawnPos = pos.clone().setY(5);
    const pooled = this.blockPool.acquire(spawnPos, Math.random() * 0xffffff);
    if (!pooled) {
      this.ui.showMessage("Block pool exhausted.");
      return;
    }
    if (!this.allBodies.some((po) => po.mesh === pooled.mesh)) {
      this.allBodies.push({ mesh: pooled.mesh, body: pooled.body });
    }
    if (!this.physicsObjects.some((po) => po.mesh === pooled.mesh)) {
      this.physicsObjects.push({ mesh: pooled.mesh, body: pooled.body });
    }
    const blockData = {
      mesh: pooled.mesh,
      body: pooled.body,
      pooled,
      handled: false,
    };
    this.blocks.push(blockData);
    setTimeout(() => this.releaseBlock(blockData), 6000);
  }

  private releaseBlock(
    block: {
      mesh: THREE.Mesh;
      body: Ammo.btRigidBody;
      pooled?: PooledBlock;
      handled: boolean;
    },
  ) {
    if (block.pooled) this.blockPool.release(block.pooled);
    this.blocks = this.blocks.filter((b) => b !== block);
    this.physicsObjects = this.physicsObjects.filter((po) =>
      po.mesh !== block.mesh
    );
  }

  public override update() {
    super.update();
    if (this.inputManager.consumeKey("e")) this.tryOpenDoor();
    this.checkBlockPuzzles();
  }

  private tryOpenDoor() {
    if (this.state.doorOpened) return;
    if (this.playerMesh.position.distanceTo(this.doorMesh.position) < 3) {
      if (this.inventory.includes("Key")) this.openDoor();
      else this.ui.showMessage("Need Key!");
    }
  }

  private checkBlockPuzzles() {
    this.blocks.forEach((b) => {
      if (b.handled) return;
      const vel = b.body.getLinearVelocity();
      if (Math.abs(vel.y()) < 0.1 && Math.abs(vel.x()) < 0.1) {
        b.handled = true;
        if (b.mesh.position.distanceTo(this.button.position) < 1.0) {
          this.keyMesh.visible = true;
          this.state.blockSpawningEnabled = false;
          this.ui.showMessage("Key Spawned!");
        } else {
          this.state.wrongLandings++;
          this.ui.showMessage(`Missed! (${this.state.wrongLandings}/3)`);
          if (this.state.wrongLandings >= 3) this.resetLevel();
        }
      }
    });
  }

  private resetLevel() {
    this.ui.showMessage("3 Misses! Level Reset!", 3000);
    this.state.wrongLandings = 0;
    this.state.blockSpawningEnabled = true;
    for (const b of this.blocks) if (b.pooled) this.blockPool.release(b.pooled);
    this.blocks.length = 0;
    this.keyMesh.visible = false;

    const startPos = new THREE.Vector3(0, 0.9, 5);
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(startPos.x, startPos.y, startPos.z));
    this.playerBody.setWorldTransform(transform);
    this.playerBody.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
    this.playerBody.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
    this.camera.position.set(startPos.x, startPos.y + 0.5, startPos.z);
    this.camera.lookAt(0, 1, 0);
  }

  public override dispose() {
    super.dispose();
    for (const b of this.blocks) if (b.pooled) this.blockPool.release(b.pooled);
    this.blocks.length = 0;
    this.blockPool.dispose();
  }

  private gameOver() {
    this.ui.showOverlay("🎉 LEVEL 1 COMPLETE 🎉", "You smashed the board!");
    this.state.blockSpawningEnabled = false;
    this.inputManager.clear();
  }
}
