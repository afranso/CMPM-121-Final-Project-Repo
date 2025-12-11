import * as THREE from "three";
import { GameScene } from "./GameScene.ts";
import { UIManager } from "./UIManager.ts";
import { GameState } from "./saveManager.ts";

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

const CONSTANTS = {
  ROOM_WIDTH: 20,
  WALL_HEIGHT: 6,
  WALL_THICKNESS: 0.5,
  DOOR_Z: -9.5,
  KEY_POS: new THREE.Vector3(1.5, 0.2, -6),
  BUTTON_POS: new THREE.Vector3(0, 0.1, -6),
};

export class LevelOne extends GameScene {
  private ui: UIManager;
  private raycaster = new THREE.Raycaster();
  private doorMesh!: THREE.Mesh;
  private doorBodyInWorld = true; // Track if door physics body is in world
  private button!: THREE.Mesh;
  private marker!: THREE.Mesh;
  private keyMesh!: THREE.Mesh;
  private chest!: THREE.Mesh;
  private readonly centerPoint = new THREE.Vector2(0, 0);
  private tmpDir = new THREE.Vector3();

  // MULTIPLE bats
  private bats: THREE.Mesh[] = [];
  private batCount = 0; // ⭐ NEW: stacked bat count

  private board!: THREE.Mesh;
  private inventory: string[] = [];

  private state = {
    doorOpened: false,
    chestOpened: false,
    wrongLandings: 0,
    blockSpawningEnabled: true,
    boardBroken: false,
    boardHits: 0,
  };

  private blocks: THREE.Mesh[] = [];
  private blockBodies: Map<THREE.Mesh, Ammo.btRigidBody> = new Map();
  private blocksInUse: Set<THREE.Mesh> = new Set();
  private blocksEvaluated: Set<THREE.Mesh> = new Set();
  private blockTimeouts: Map<THREE.Mesh, number> = new Map();
  private isResetting = false;
  private readonly BLOCK_HIDDEN_POSITION = new THREE.Vector3(0, -100, 0);
  private COLORS = BASE_COLORS.LIGHT;
  private hemisphereLight!: THREE.HemisphereLight;
  private directionalLight!: THREE.DirectionalLight;
  private floors: THREE.Mesh[] = [];
  private walls: THREE.Mesh[] = [];

  constructor() {
    super();
    this.ui = new UIManager();

    // Set initial theme based on browser preference
    this.COLORS = this.ui.isDark() ? BASE_COLORS.DARK : BASE_COLORS.LIGHT;

    // Listen for theme changes
    const darkModeQuery = globalThis.matchMedia?.(
      "(prefers-color-scheme: dark)",
    );
    darkModeQuery?.addEventListener("change", (e: MediaQueryListEvent) => {
      this.COLORS = e.matches ? BASE_COLORS.DARK : BASE_COLORS.LIGHT;
      this.updateVisualTheme();
    });

    this.setupLevel();
    this.setupInteractions();

    // NEW HUD TEXT
    this.ui.showStandardControls();
    this.ui.showTopCenter(
      "CURRENT OBJECTIVE:\nCollect all 3 bats to break the barricade.",
    );
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
    this.createRoom(0, true);
    this.createRoom(-20, false);

    this.createDoor();
    this.createButton();
    this.createMarker();
    this.createKey();
    this.createChest();

    this.createBats(); // 3 bats
    this.createBoard();
    this.createStaticBlocks(); // Create the 3 static blocks

    this.setupLighting();
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
      isDark ? 0.2 : 0.6,
    );
    this.directionalLight.position.set(5, 10, 5);
    this.scene.add(this.directionalLight);
  }

  private updateVisualTheme() {
    const isDark = this.COLORS === BASE_COLORS.DARK;

    // Update hemisphere light
    this.hemisphereLight.color.set(isDark ? 0x222244 : 0xffffff);
    this.hemisphereLight.groundColor.set(isDark ? 0x111111 : 0x444444);
    this.hemisphereLight.intensity = isDark ? 0.3 : 0.6;

    // Update directional light
    this.directionalLight.color.set(isDark ? 0x666666 : 0xffffff);
    this.directionalLight.intensity = isDark ? 0.2 : 0.6;

    this.floors.forEach((mesh) => {
      const material = mesh.material as THREE.MeshPhongMaterial;
      material.color.set(this.COLORS.FLOOR);
    });
    this.walls.forEach((mesh) => {
      const material = mesh.material as THREE.MeshPhongMaterial;
      material.color.set(this.COLORS.WALL);
    });

    // Update object colors
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const material = obj.material;
        if (
          material instanceof THREE.MeshPhongMaterial ||
          material instanceof THREE.MeshStandardMaterial
        ) {
          // Update specific objects
          if (obj === this.board) {
            material.color.set(this.COLORS.BOARD);
          } else if (obj === this.chest) {
            material.color.set(this.COLORS.CHEST);
          } else if (obj === this.button) {
            material.color.set(this.COLORS.BUTTON);
          } else if (obj === this.keyMesh) {
            material.color.set(this.COLORS.KEY);
          } else if (this.bats.includes(obj as THREE.Mesh)) {
            material.color.set(this.COLORS.BAT);
          }
        }
      }
    });
  }

  private createRoom(zOffset: number, hasDoor: boolean) {
    const floor = this.createBody(
      { x: CONSTANTS.ROOM_WIDTH, y: 1, z: CONSTANTS.ROOM_WIDTH },
      0,
      new THREE.Vector3(0, -0.5, zOffset),
      this.COLORS.FLOOR,
    );
    this.floors.push(floor);

    const W = CONSTANTS.ROOM_WIDTH;
    const H = CONSTANTS.WALL_HEIGHT;
    const T = CONSTANTS.WALL_THICKNESS;

    if (!(hasDoor && zOffset === 0)) {
      const back = this.createBody(
        { x: W, y: H, z: T },
        0,
        new THREE.Vector3(0, 3, zOffset - 10 + 0.25),
        this.COLORS.WALL,
      );
      this.walls.push(back);
    }
    const left = this.createBody(
      { x: T, y: H, z: W },
      0,
      new THREE.Vector3(-10 + 0.25, 3, zOffset),
      this.COLORS.WALL,
    );
    const right = this.createBody(
      { x: T, y: H, z: W },
      0,
      new THREE.Vector3(10 - 0.25, 3, zOffset),
      this.COLORS.WALL,
    );
    this.walls.push(left, right);

    if (hasDoor) {
      const wallA = this.createBody(
        { x: 9, y: 6, z: 0.5 },
        0,
        new THREE.Vector3(-5.5, 3, CONSTANTS.DOOR_Z),
        this.COLORS.WALL,
      );
      const wallB = this.createBody(
        { x: 9, y: 6, z: 0.5 },
        0,
        new THREE.Vector3(5.5, 3, CONSTANTS.DOOR_Z),
        this.COLORS.WALL,
      );
      const wallTop = this.createBody(
        { x: 2, y: 3, z: 0.5 },
        0,
        new THREE.Vector3(0, 4.5, CONSTANTS.DOOR_Z),
        this.COLORS.WALL,
      );
      this.walls.push(wallA, wallB, wallTop);
    }
  }

  private createDoor() {
    this.doorMesh = this.createBody(
      { x: 2, y: 3, z: 0.2 },
      0,
      new THREE.Vector3(0, 1.5, CONSTANTS.DOOR_Z),
      0x552200,
    );
  }

  private openDoor() {
    if (this.state.doorOpened) return;
    this.state.doorOpened = true;
    if (this.doorMesh.userData.physicsBody && this.doorBodyInWorld) {
      this.physicsWorld.removeRigidBody(this.doorMesh.userData.physicsBody);
      this.doorBodyInWorld = false;
    }
    this.doorMesh.visible = false;
    this.ui.showMessage("Door Unlocked!");
  }

  private createButton() {
    this.button = this.createBody(
      { x: 1, y: 0.2, z: 1 },
      0,
      CONSTANTS.BUTTON_POS,
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
    this.keyMesh.position.copy(CONSTANTS.KEY_POS);
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
    this.board.position.set(0, 1, -4);
    this.board.visible = true;
    this.scene.add(this.board);
  }

  private createStaticBlocks() {
    // Create 3 persistent blocks that will be reused throughout the level
    for (let i = 0; i < 3; i++) {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshPhongMaterial({
        color: Math.random() * 0xffffff,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(this.BLOCK_HIDDEN_POSITION);
      this.scene.add(mesh);

      // Create physics body
      const transform = new Ammo.btTransform();
      transform.setIdentity();
      transform.setOrigin(
        new Ammo.btVector3(
          this.BLOCK_HIDDEN_POSITION.x,
          this.BLOCK_HIDDEN_POSITION.y,
          this.BLOCK_HIDDEN_POSITION.z,
        ),
      );

      const motionState = new Ammo.btDefaultMotionState(transform);
      const shape = new Ammo.btBoxShape(new Ammo.btVector3(0.5, 0.5, 0.5));
      const localInertia = new Ammo.btVector3(0, 0, 0);
      const mass = 1;
      shape.calculateLocalInertia(mass, localInertia);
      const rbInfo = new Ammo.btRigidBodyConstructionInfo(
        mass,
        motionState,
        shape,
        localInertia,
      );
      const body = new Ammo.btRigidBody(rbInfo);
      this.physicsWorld.addRigidBody(body);

      mesh.userData.physicsBody = body;
      this.blocks.push(mesh);
      this.blockBodies.set(mesh, body);
      this.allBodies.push({ mesh, body });
      this.physicsObjects.push({ mesh, body });
    }
  }

  private setupInteractions() {
    this.ui.createInteractButton(() => {
      this.inputManager.queueInteract();
    });
  }

  private raycastUpdateMarkerFromCenter() {
    this.raycaster.setFromCamera(this.centerPoint, this.camera);
    const objects = this.scene.children.filter((obj) =>
      obj !== this.marker && obj !== this.playerMesh
    );
    const hits = this.raycaster.intersectObjects(objects);
    if (hits.length > 0) {
      this.marker.position.copy(hits[0].point).add(
        new THREE.Vector3(0, 0.05, 0),
      );
    } else {
      // If nothing is hit, project a point forward so the cursor stays visible.
      this.camera.getWorldDirection(this.tmpDir.set(0, 0, -1));
      this.tmpDir.normalize().multiplyScalar(10);
      this.marker.position.copy(this.camera.position).add(this.tmpDir);
    }
  }

  //---------------------------------------------------------
  //  ⭐ NEW: Can only break board once you have ALL 3 bats
  //---------------------------------------------------------
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

    // Hit the board - requires 6 hits total, each depletes 50%
    this.state.boardHits++;
    const newStrength = Math.max(
      0,
      this.batCount * 100 - (this.state.boardHits * 50),
    );

    // Update inventory with new percentage
    if (newStrength > 0) {
      const batLabel = `Bat (${newStrength}%)`;
      this.inventory = this.inventory.filter((i) => !i.startsWith("Bat"));
      this.inventory.push(batLabel);
      this.ui.updateInventory(this.inventory);
      this.ui.showMessage(`Board hit! (${this.state.boardHits}/6)`);
    } else {
      // Remove bat from inventory when depleted
      this.inventory = this.inventory.filter((i) => !i.startsWith("Bat"));
      this.ui.updateInventory(this.inventory);
    }

    if (this.state.boardHits >= 6) {
      // Board is broken after 6 hits
      this.board.visible = false;
      this.state.boardBroken = true;
      this.ui.showMessage("You smashed the board!", 2000);
      setTimeout(() => this.gameOver(), 1000);
    }
  }

  private handleInteractionAtMarker() {
    this.raycaster.setFromCamera(this.centerPoint, this.camera);
    const visible = this.scene.children.filter((obj) =>
      (obj as THREE.Mesh).visible !== false &&
      obj !== this.marker && obj !== this.playerMesh
    );
    const intersects = this.raycaster.intersectObjects(visible);
    if (intersects.length === 0) return;

    // PICK UP KEY
    if (intersects.find((i) => i.object === this.keyMesh)) {
      if (this.keyMesh.visible) {
        this.keyMesh.visible = false;
        this.inventory.push("Key");
        this.ui.updateInventory(this.inventory);
        this.ui.showMessage("Picked up Key!");
      }
      return;
    }

    // DOOR
    if (intersects.find((i) => i.object === this.doorMesh)) {
      this.tryOpenDoor();
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

    //---------------------------------------------------------
    // PICK UP BATS (stacking)
    //---------------------------------------------------------
    for (const bat of this.bats) {
      if (intersects.find((i) => i.object === bat) && bat.visible) {
        bat.visible = false;
        this.batCount++;

        // Update inventory to show bat percentage
        const batStrength = this.batCount * 100 - (this.state.boardHits * 50);
        const batLabel = `Bat (${batStrength}%)`;
        this.inventory = this.inventory.filter((i) => !i.startsWith("Bat"));
        this.inventory.push(batLabel);

        this.ui.updateInventory(this.inventory);
        this.ui.showMessage(`Picked up Bat (${this.batCount}/3)`);
        return;
      }
    }

    //---------------------------------------------------------
    // HIT BOARD (only works once you have all 3 bats)
    //---------------------------------------------------------
    if (intersects.find((i) => i.object === this.board) && this.batCount > 0) {
      this.tryBreakBoard();
      return;
    }

    // BLOCK PUZZLE
    if (this.state.blockSpawningEnabled) {
      this.spawnBlock(this.marker.position);
    }
  }

  private spawnBlock(pos: THREE.Vector3) {
    if (this.camera.position.z < -10) {
      this.ui.showMessage("Cannot spawn here.");
      return;
    }

    // Find an available block (one not currently in use)
    let blockToSpawn: THREE.Mesh | null = null;
    for (const block of this.blocks) {
      if (!this.blocksInUse.has(block)) {
        blockToSpawn = block;
        break;
      }
    }

    if (!blockToSpawn) {
      this.ui.showMessage("All blocks in use.");
      return;
    }

    // Clear any existing timeout for this block
    const existingTimeout = this.blockTimeouts.get(blockToSpawn);
    if (existingTimeout !== undefined) {
      clearTimeout(existingTimeout);
      this.blockTimeouts.delete(blockToSpawn);
    }

    // Move block to spawn position and mark as in use
    const spawnPos = pos.clone().setY(5);
    blockToSpawn.position.copy(spawnPos);
    blockToSpawn.visible = true;
    this.blocksInUse.add(blockToSpawn);

    // Reset physics state
    const body = this.blockBodies.get(blockToSpawn)!;
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(
      new Ammo.btVector3(spawnPos.x, spawnPos.y, spawnPos.z),
    );
    body.setWorldTransform(transform);
    body.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
    body.setAngularVelocity(new Ammo.btVector3(0, 0, 0));

    // Store the block reference for the timeout
    const block = blockToSpawn;

    // Auto-hide block after 6 seconds
    const timeoutId = setTimeout(() => {
      this.blockTimeouts.delete(block);
      if (this.blocksInUse.has(block)) {
        this.blocksInUse.delete(block);
        block.position.copy(this.BLOCK_HIDDEN_POSITION);
        block.visible = false;
        const body = this.blockBodies.get(block);
        if (body) {
          const transform = new Ammo.btTransform();
          transform.setIdentity();
          transform.setOrigin(
            new Ammo.btVector3(
              this.BLOCK_HIDDEN_POSITION.x,
              this.BLOCK_HIDDEN_POSITION.y,
              this.BLOCK_HIDDEN_POSITION.z,
            ),
          );
          body.setWorldTransform(transform);
          body.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
          body.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
        }
      }
    }, 6000);

    this.blockTimeouts.set(block, timeoutId);
  }

  public override update() {
    super.update();
    this.raycastUpdateMarkerFromCenter();
    if (this.inputManager.consumeInteractRequest()) {
      this.handleInteractionAtMarker();
    }
    this.checkBlockPuzzles();
  }

  private tryOpenDoor() {
    if (this.state.doorOpened) return;
    if (this.playerMesh.position.distanceTo(this.doorMesh.position) < 3) {
      if (this.inventory.includes("Key")) {
        this.openDoor();
      } else {
        this.ui.showMessage("Need Key!");
      }
    }
  }

  private checkBlockPuzzles() {
    // Don't check blocks while resetting
    if (this.isResetting) return;

    this.blocks.forEach((block) => {
      // Skip blocks that have already been evaluated or aren't visible
      if (this.blocksEvaluated.has(block) || !block.visible) return;

      const body = this.blockBodies.get(block);
      if (!body) return;

      const vel = body.getLinearVelocity();
      // Check all velocity components to ensure block has truly settled
      const isSettled = Math.abs(vel.x()) < 0.1 &&
        Math.abs(vel.y()) < 0.1 &&
        Math.abs(vel.z()) < 0.1;

      if (isSettled && block.position.y < 2.0 && this.blocksInUse.has(block)) {
        // Block has settled on the ground - mark as evaluated so it only counts once
        this.blocksEvaluated.add(block);

        if (block.position.distanceTo(CONSTANTS.BUTTON_POS) < 1.0) {
          this.keyMesh.visible = true;
          this.state.blockSpawningEnabled = false;
          this.ui.showMessage("Key Spawned!");
        } else {
          this.state.wrongLandings++;
          this.ui.showMessage(`Missed! (${this.state.wrongLandings}/3)`);
          if (this.state.wrongLandings >= 3) {
            this.resetGameState();
          }
        }
      }
    });
  }

  private resetGameState() {
    // Prevent further block checks during reset
    this.isResetting = true;

    // Reset all game state and player position
    this.ui.showMessage("3 Misses! Level Reset!", 3000);

    // Reset state flags
    this.state = {
      doorOpened: false,
      chestOpened: false,
      wrongLandings: 0,
      blockSpawningEnabled: true,
      boardBroken: false,
      boardHits: 0,
    };

    // Clear inventory
    this.inventory = [];
    this.ui.updateInventory(this.inventory);

    // Reset bat count
    this.batCount = 0;

    // Reset key visibility
    this.keyMesh.visible = false;

    // Reset board
    this.board.visible = true;

    // Reset bats visibility
    this.bats.forEach((bat) => {
      bat.visible = true;
    });

    // Reset door
    this.doorMesh.visible = true;
    this.doorMesh.position.set(0, 1.5, CONSTANTS.DOOR_Z);
    if (this.doorMesh.userData.physicsBody && !this.doorBodyInWorld) {
      this.physicsWorld.addRigidBody(this.doorMesh.userData.physicsBody);
      this.doorBodyInWorld = true;
    }
    if (this.doorMesh.userData.physicsBody) {
      const doorBody = this.doorMesh.userData.physicsBody as Ammo.btRigidBody;
      const doorTransform = new Ammo.btTransform();
      doorTransform.setIdentity();
      doorTransform.setOrigin(new Ammo.btVector3(0, 1.5, CONSTANTS.DOOR_Z));
      doorBody.setWorldTransform(doorTransform);
    }

    // Reset chest appearance
    if (this.chest) {
      (this.chest.material as THREE.MeshStandardMaterial).color.set(
        this.COLORS.CHEST,
      );
      this.chest.scale.set(1, 1, 1);
    }

    // Clear all spawned blocks and move them back to hidden position
    this.blocksInUse.clear();
    this.blocksEvaluated.clear();

    // Clear all pending timeouts
    for (const [_block, timeoutId] of this.blockTimeouts.entries()) {
      clearTimeout(timeoutId);
    }
    this.blockTimeouts.clear();

    for (const block of this.blocks) {
      block.position.copy(this.BLOCK_HIDDEN_POSITION);
      block.visible = false;
      const body = this.blockBodies.get(block);
      if (body) {
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(
          new Ammo.btVector3(
            this.BLOCK_HIDDEN_POSITION.x,
            this.BLOCK_HIDDEN_POSITION.y,
            this.BLOCK_HIDDEN_POSITION.z,
          ),
        );
        body.setWorldTransform(transform);
        body.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
        body.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
      }
    }

    // Reset player position
    const startPos = new THREE.Vector3(0, 0.9, 5);
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(startPos.x, startPos.y, startPos.z));
    this.playerBody.setWorldTransform(transform);
    this.playerBody.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
    this.playerBody.setAngularVelocity(new Ammo.btVector3(0, 0, 0));

    // Reset camera
    this.camera.position.set(startPos.x, startPos.y + 0.5, startPos.z);
    this.camera.lookAt(0, 1, 0);

    // Reset UI state
    this.ui.showTopCenter(
      "CURRENT OBJECTIVE:\nCollect all 3 bats to break the barricade.",
    );

    // Re-enable block checking after a short delay to ensure physics has updated
    setTimeout(() => {
      this.isResetting = false;
    }, 100);
  }

  public override dispose() {
    super.dispose();
    // Clear all pending timeouts
    for (const timeoutId of this.blockTimeouts.values()) {
      clearTimeout(timeoutId);
    }
    // Blocks will be cleaned up by physics world disposal
    this.blocks.length = 0;
    this.blocksInUse.clear();
    this.blocksEvaluated.clear();
    this.blockBodies.clear();
    this.blockTimeouts.clear();
  }

  private gameOver() {
    this.ui.showOverlay("🎉 LEVEL 1 COMPLETE 🎉", "You smashed the board!");
    this.state.blockSpawningEnabled = false;
    this.inputManager.clear();
    // Dispatch a global event so the app can transition to the next level.
    try {
      setTimeout(() => {
        (globalThis as unknown as Window).dispatchEvent(
          new CustomEvent("levelComplete", { detail: { level: 1 } }),
        );
      }, 3000);
    } catch {
      // ignore in non-browser environments
    }
  }

  // Save current game state
  public saveState(): GameState {
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
      inventory: [...this.inventory],
      levelState: { ...this.state },
      batsCollected: this.batCount,
      keyVisible: this.keyMesh.visible,
      batsVisible: this.bats.map((bat) => bat.visible),
    };
  }

  // Load saved game state
  public loadState(state: GameState): void {
    // Restore player position
    const pos = state.playerState.position;
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
    this.playerBody.setWorldTransform(transform);

    // Restore velocity
    const vel = state.playerState.velocity;
    this.playerBody.setLinearVelocity(new Ammo.btVector3(vel.x, vel.y, vel.z));
    this.playerBody.setAngularVelocity(new Ammo.btVector3(0, 0, 0));

    // Restore camera position and rotation
    this.camera.position.set(pos.x, pos.y + 0.5, pos.z);
    const rot = state.playerState.rotation;
    this.camera.rotation.set(rot.x, rot.y, rot.z);

    // Restore inventory and UI
    this.inventory = [...state.inventory];
    this.ui.updateInventory(this.inventory);

    // Restore level state (with defaults for new properties from old saves)
    this.state = {
      doorOpened: state.levelState.doorOpened,
      chestOpened: state.levelState.chestOpened,
      wrongLandings: state.levelState.wrongLandings,
      blockSpawningEnabled: state.levelState.blockSpawningEnabled,
      boardBroken: state.levelState.boardBroken,
      boardHits: state.levelState.boardHits ?? 0,
    };
    this.batCount = state.batsCollected;
    this.keyMesh.visible = state.keyVisible;

    // Restore bat visibility
    state.batsVisible.forEach((visible, index) => {
      if (index < this.bats.length) {
        this.bats[index].visible = visible;
      }
    });

    // Restore door state
    if (this.state.doorOpened) {
      this.doorMesh.visible = false;
      if (this.doorMesh.userData.physicsBody && this.doorBodyInWorld) {
        this.physicsWorld.removeRigidBody(this.doorMesh.userData.physicsBody);
        this.doorBodyInWorld = false;
      }
    } else {
      this.doorMesh.visible = true;
      if (this.doorMesh.userData.physicsBody && !this.doorBodyInWorld) {
        this.physicsWorld.addRigidBody(this.doorMesh.userData.physicsBody);
        this.doorBodyInWorld = true;
      }
    }

    // Restore chest state
    if (this.state.chestOpened && this.chest) {
      this.chest.scale.y = 0.3;
    }

    // Restore board state
    if (this.state.boardBroken) {
      this.board.visible = false;
    }

    // Update bat in inventory with correct percentage
    if (this.batCount > 0) {
      const currentStrength = Math.max(
        0,
        this.batCount * 100 - (this.state.boardHits * 50),
      );
      if (currentStrength > 0) {
        const batLabel = `Bat (${currentStrength}%)`;
        this.inventory = this.inventory.filter((i) => !i.startsWith("Bat"));
        this.inventory.push(batLabel);
        this.ui.updateInventory(this.inventory);
      }
    }

    this.ui.showMessage("Game loaded successfully!", 2000);
  }
}
