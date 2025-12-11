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

export class LevelThree extends GameScene {
  private ui: UIManager;
  private raycaster = new THREE.Raycaster();
  private doorMesh!: THREE.Mesh;
  private doorBodyInWorld = true;
  private marker!: THREE.Mesh;
  private keyMesh: THREE.Mesh | null = null;
  private keyholeMesh: THREE.Mesh | null = null;
  private readonly centerPoint = new THREE.Vector2(0, 0);
  private tmpDir = new THREE.Vector3();
  private elevatorMesh!: THREE.Mesh;
  private elevatorBody: Ammo.btRigidBody | null = null;
  private elevatorTargetY: number | null = null;
  private elevatorMoving = false;
  private elevatorFrame: THREE.Group | null = null;

  // MULTIPLE bats
  private bats: THREE.Mesh[] = [];
  private batCount = 3;

  // Breakable boxes the player must destroy with a metal bat
  private breakableBoxes: THREE.Mesh[] = [];
  private craftTable!: THREE.Mesh;
  private hasMetalBat = false;
  private keyBoxIndex: number | null = null;

  private inventory: string[] = [];

  private state = {
    doorOpened: false,
  };

  private COLORS = BASE_COLORS.LIGHT;
  private hemisphereLight!: THREE.HemisphereLight;
  private directionalLight!: THREE.DirectionalLight;

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

    // Give the player 3 bats in inventory at level start
    this.batCount = 3;
    const batLabel = `Bat x${this.batCount}`;
    this.inventory = this.inventory.filter((i) => !i.startsWith("Bat"));
    this.inventory.push(batLabel);
    this.ui.updateInventory(this.inventory);

    this.ui.showStandardControls();
    this.ui.showTopCenter(
      "CURRENT OBJECTIVE:\nUpgrade bats into metal bat.",
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

    // Create breakable boxes that the player must destroy with a metal bat
    this.createBreakableBoxes();

    // Create a crafting table used to combine bats into a metal bat
    this.createCraftTable();

    // Create a keyhole in the second room for inserting the key
    this.createKeyhole();

    this.createElevator();
    this.createMarker();
    this.createKey();

    this.setupLighting();
  }

  private createCraftTable() {
    // A simple static table mesh (no physics) placed in the first room
    const table = this.createBox(
      3, // width
      0.75, // height
      1.5, // depth
      0, // mass 0 -> static
      new THREE.Vector3(6, 0.375, -2),
      0x0077ff, // blue table color
    );
    table.userData.type = "craftTable";
    this.craftTable = table;
  }

  // Attempt to craft a metal bat when player presses F near the table
  private attemptCraftMetalBat() {
    if (!this.craftTable) return;
    const camPos = this.camera.position;
    const dist = camPos.distanceTo(this.craftTable.position);
    if (dist > 3) {
      this.ui.showMessage("Stand closer to the table to craft.", 1500);
      return;
    }

    if (this.batCount >= 3 && !this.hasMetalBat) {
      // Consume bats and give metal bat
      this.batCount = 0;
      this.hasMetalBat = true;
      // Update inventory UI to show Metal Bat
      this.inventory = this.inventory.filter((i) => !i.startsWith("Bat"));
      this.inventory.push("Metal Bat");
      this.ui.updateInventory(this.inventory);
      this.ui.setBatStrength(100);
      this.ui.showMessage("Crafted Metal Bat! Press [SPACE] to strike.", 2500);
      // Update objective to instruct player to destroy boxes and find the key
      this.ui.showTopCenter(
        "CURRENT OBJECTIVE:\nDestroy the boxes for to find the key",
      );
    } else if (this.hasMetalBat) {
      this.ui.showMessage("You already have a Metal Bat.", 1500);
    } else {
      this.ui.showMessage("You need 3 bats to craft a Metal Bat.", 1500);
    }
  }

  // Handle attacking breakable boxes with the metal bat (triggered by Space)
  private handleAttack() {
    if (!this.hasMetalBat) return;
    // Raycast from center to find the first breakable box in front of the player
    this.raycaster.setFromCamera(this.centerPoint, this.camera);
    const objects = this.scene.children.filter((obj) =>
      (obj as THREE.Object3D).visible !== false && obj !== this.marker &&
      obj !== this.playerMesh
    );
    const hits = this.raycaster.intersectObjects(objects);
    for (const hit of hits) {
      const obj = hit.object as THREE.Mesh;
      if (obj.userData && obj.userData.breakable) {
        // Apply damage
        obj.userData.health = (obj.userData.health ?? 1) - 1;
        if (obj.userData.health <= 0) {
          // Remove physics body if present
          const body = obj.userData.physicsBody as Ammo.btRigidBody | undefined;
          if (body) {
            try {
              this.physicsWorld.removeRigidBody(body);
            } catch (_e) {
              // ignore
            }
          }
          obj.visible = false;
          // Remove from our breakable list
          const idx = this.breakableBoxes.indexOf(obj);
          if (idx !== -1) this.breakableBoxes.splice(idx, 1);
          // If this box contained the key, create a physics key so it falls out
          if (obj.userData.containsKey) {
            const spawnPos = obj.position.clone().add(
              new THREE.Vector3(0, 0.6, 0),
            );
            this.createAndPlaceKey(spawnPos);
            this.ui.showMessage("A key fell out of the box!", 1500);
            // clear the flag
            obj.userData.containsKey = false;
            this.keyBoxIndex = null;
          } else {
            this.ui.showMessage("Box destroyed!", 1200);
          }
        } else {
          this.ui.showMessage(
            `Box damaged (${obj.userData.health} left)`,
            1000,
          );
        }
        return; // only affect the first breakable hit
      }
    }
    // If nothing breakable was hit
    this.ui.showMessage("No breakable object in range.", 1000);
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

    // Update object colors
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const material = obj.material;
        if (
          material instanceof THREE.MeshPhongMaterial ||
          material instanceof THREE.MeshStandardMaterial
        ) {
          // Update specific objects
          if (obj === this.keyMesh) {
            material.color.set(this.COLORS.KEY);
          } else if (this.bats.includes(obj as THREE.Mesh)) {
            material.color.set(this.COLORS.BAT);
          }
        }
      }
    });
  }

  private createRoom(zOffset: number, hasDoor: boolean) {
    this.createBody(
      { x: CONSTANTS.ROOM_WIDTH, y: 1, z: CONSTANTS.ROOM_WIDTH },
      0,
      new THREE.Vector3(0, -0.5, zOffset),
      this.COLORS.FLOOR,
    );

    const W = CONSTANTS.ROOM_WIDTH;
    const H = CONSTANTS.WALL_HEIGHT;
    const T = CONSTANTS.WALL_THICKNESS;

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
        new THREE.Vector3(-5.5, 3, CONSTANTS.DOOR_Z),
        this.COLORS.WALL,
      );
      this.createBody(
        { x: 9, y: 6, z: 0.5 },
        0,
        new THREE.Vector3(5.5, 3, CONSTANTS.DOOR_Z),
        this.COLORS.WALL,
      );
      this.createBody(
        { x: 2, y: 3, z: 0.5 },
        0,
        new THREE.Vector3(0, 4.5, CONSTANTS.DOOR_Z),
        this.COLORS.WALL,
      );
    }
  }

  // Create a cluster/grid of breakable boxes (30 total).
  // Boxes have a small mass so they can be knocked over and carry a `breakable` flag
  // and simple `health` counter on their userData for later interaction logic.
  private createBreakableBoxes() {
    const cols = 6;
    const rows = 5; // cols * rows = 30
    const size = 1;
    const mass = 2;
    const spacing = 1.15;

    // Position the grid in the first room near the center, slightly forward
    const startX = -((cols - 1) * spacing) / 2;
    const startZ = -3; // slightly in front of the player start area

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * spacing;
        const z = startZ - r * spacing;
        const y = size / 2; // sit on the floor

        const mesh = this.createBox(
          size,
          size,
          size,
          mass,
          new THREE.Vector3(x, y, z),
          this.COLORS.BOARD,
        );

        // Mark as breakable and give a small health value
        mesh.userData.breakable = true;
        mesh.userData.health = 3;
        mesh.userData.type = "breakableBox";

        this.breakableBoxes.push(mesh);
      }
    }
  }

  private createElevator() {
    // Create an elevator platform that starts hidden below the floor in the second room.
    // We'll place it in the center of the second room (z ~ -20).
    const platformSize = { x: 3, y: 0.2, z: 3 };
    // Start it below the floor so it's hidden initially
    const startPos = new THREE.Vector3(0, -7.0, -20);
    const platform = this.createBody(platformSize, 0, startPos, 0x555555);
    platform.userData.type = "elevator";
    // Hide the solid physics platform; we'll render a cabin (walls + roof)
    // visually and keep the platform for collisions.
    platform.visible = false;
    this.elevatorMesh = platform;
    this.elevatorBody = platform.userData.physicsBody as Ammo.btRigidBody ??
      null;

    // Build a simple elevator cabin (back wall, two side walls, roof, and a
    // thin floor outline). Front is left open so the player can step in.
    const cabin = new THREE.Group();
    const mat = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    const wallThickness = 0.12;
    const wallHeight = 6.2;
    const size = 3;

    // Floor outline pieces
    const frameHeight = 0.16;
    const longGeo = new THREE.BoxGeometry(size, frameHeight, wallThickness);
    const shortGeo = new THREE.BoxGeometry(wallThickness, frameHeight, size);
    const backFrame = new THREE.Mesh(longGeo, mat);
    backFrame.position.set(0, -0.06, -(size / 2) + (wallThickness / 2));
    const leftFrame = new THREE.Mesh(shortGeo, mat);
    leftFrame.position.set(-(size / 2) + (wallThickness / 2), -0.06, 0);
    const rightFrame = new THREE.Mesh(shortGeo, mat);
    rightFrame.position.set((size / 2) - (wallThickness / 2), -0.06, 0);

    // Walls (back + sides)
    const backWallGeo = new THREE.BoxGeometry(size, wallHeight, wallThickness);
    const sideWallGeo = new THREE.BoxGeometry(wallThickness, wallHeight, size);
    const backWall = new THREE.Mesh(backWallGeo, mat);
    backWall.position.set(
      0,
      wallHeight / 2 - 0.04,
      -(size / 2) + (wallThickness / 2),
    );
    const leftWall = new THREE.Mesh(sideWallGeo, mat);
    leftWall.position.set(
      -(size / 2) + (wallThickness / 2),
      wallHeight / 2 - 0.04,
      0,
    );
    const rightWall = new THREE.Mesh(sideWallGeo, mat);
    rightWall.position.set(
      (size / 2) - (wallThickness / 2),
      wallHeight / 2 - 0.04,
      0,
    );

    // Roof
    const roofGeo = new THREE.BoxGeometry(size, wallThickness, size);
    const roof = new THREE.Mesh(roofGeo, mat);
    roof.position.set(0, wallHeight - 0.04, 0);

    cabin.add(
      backFrame,
      leftFrame,
      rightFrame,
      backWall,
      leftWall,
      rightWall,
      roof,
    );
    cabin.position.copy(startPos);
    this.scene.add(cabin);
    this.elevatorFrame = cabin;
  }

  private openElevator() {
    // Start moving the elevator up to floor level
    if (!this.elevatorMesh) return;
    // target Y for platform center so top sits slightly above floor (floor top at y=0)
    this.elevatorTargetY = .3;
    this.elevatorMoving = true;
  }

  private createMarker() {
    this.marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.1),
      new THREE.MeshStandardMaterial({ color: 0xffff00 }),
    );
    this.scene.add(this.marker);
  }

  private createKey() {
    // Decide which box will contain the key (random). The key mesh will be
    // created as a physics object only when the box is destroyed so it can fall.
    if (this.breakableBoxes.length > 0) {
      const idx = Math.floor(Math.random() * this.breakableBoxes.length);
      this.keyBoxIndex = idx;
      const box = this.breakableBoxes[idx];
      box.userData.containsKey = true;
    } else {
      // If no boxes exist, spawn the key immediately on the floor.
      const pos = new THREE.Vector3(
        CONSTANTS.KEY_POS.x,
        CONSTANTS.KEY_POS.y + 0.2,
        CONSTANTS.KEY_POS.z,
      );
      this.createAndPlaceKey(pos);
    }
  }

  private createKeyhole() {
    // Place a simple keyhole plate flush on the back wall of the second room
    // The back wall for room at zOffset=-20 is at z = zOffset - 10 + 0.25
    const wallZ = -20 - 10 + 0.25; // matches createRoom logic for wall placement
    // Place the plate slightly in front of the wall surface so it's visible from inside
    const inset = (CONSTANTS.WALL_THICKNESS / 2) + 0.025;
    const pos = new THREE.Vector3(0, 2, wallZ + inset);
    // Light gray color for the keyhole plate
    const plate = this.createBox(0.8, 0.6, 0.08, 0, pos, 0xcccccc);
    plate.userData.type = "keyhole";
    this.keyholeMesh = plate;
  }

  // Create a physics-enabled key mesh at `pos` that looks like a door key.
  private createAndPlaceKey(pos: THREE.Vector3) {
    // Create the physics body as a thin box to approximate collisions
    const keyMesh = this.createBody(
      { x: 0.6, y: 0.12, z: 0.2 },
      1,
      pos,
      this.COLORS.KEY,
    );
    keyMesh.userData.type = "key";

    // Decorative shaft (cylinder) along X axis
    const shaftGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.55, 12);
    const shaftMat = new THREE.MeshPhongMaterial({ color: this.COLORS.KEY });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.rotation.z = Math.PI / 2;
    shaft.position.set(0, 0, 0);
    keyMesh.add(shaft);

    // Ring/head using a torus geometry
    const ringGeo = new THREE.TorusGeometry(0.18, 0.05, 8, 30);
    const ring = new THREE.Mesh(ringGeo, shaftMat);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(-0.28, 0, 0);
    keyMesh.add(ring);

    // Teeth - small boxes at the tip
    const toothGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const tooth1 = new THREE.Mesh(toothGeo, shaftMat);
    tooth1.position.set(0.28, -0.02, 0.06);
    keyMesh.add(tooth1);
    const tooth2 = new THREE.Mesh(toothGeo, shaftMat);
    tooth2.position.set(0.28, 0.02, -0.06);
    keyMesh.add(tooth2);

    this.keyMesh = keyMesh;
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
  // Returns true if an interaction was handled (picked up key / used keyhole)
  private handleInteractionAtMarker(): boolean {
    this.raycaster.setFromCamera(this.centerPoint, this.camera);
    const visible = this.scene.children.filter((obj) =>
      (obj as THREE.Mesh).visible !== false && obj !== this.marker &&
      obj !== this.playerMesh
    );
    const intersects = this.raycaster.intersectObjects(visible);
    if (intersects.length === 0) return false;

    // If player is pointing at the key (or any of its children), pick it up
    const keyHit = intersects.find((i) =>
      i.object === this.keyMesh || i.object.parent === this.keyMesh
    );
    if (keyHit) {
      if (this.keyMesh && this.keyMesh.visible) {
        // Remove physics body if present and remove the mesh from the scene
        const body = this.keyMesh.userData.physicsBody as
          | Ammo.btRigidBody
          | undefined;
        if (body) {
          try {
            this.physicsWorld.removeRigidBody(body);
          } catch (_e) {
            // ignore
          }
        }
        try {
          this.scene.remove(this.keyMesh);
        } catch (_e) {
          // ignore
        }
        this.keyMesh = null;
        this.inventory.push("Key");
        this.ui.updateInventory(this.inventory);
        this.ui.showMessage("Picked up Key!");
        // Update objective: instruct player to put key into keyhole
        this.ui.showTopCenter(
          "CURRENT OBJECTIVE:\nPut key inside the keyhole.",
        );
        return true;
      }
    }

    // If player is pointing at the keyhole, attempt to use the key
    const keyholeHit = this.keyholeMesh &&
      intersects.find((i) =>
        i.object === this.keyholeMesh || i.object.parent === this.keyholeMesh
      );
    if (keyholeHit) {
      // Check if player has a Key in inventory
      const keyIndex = this.inventory.indexOf("Key");
      if (keyIndex !== -1) {
        // Consume key
        this.inventory.splice(keyIndex, 1);
        this.ui.updateInventory(this.inventory);
        this.ui.showMessage("Key inserted into keyhole! The lock opens.", 2000);
        // Change keyhole appearance to show used state
        try {
          (this.keyholeMesh!.material as THREE.MeshPhongMaterial).color.set(
            0x444444,
          );
        } catch (_e) {
          // ignore
        }
        // Update objective
        this.ui.showTopCenter(
          "CURRENT OBJECTIVE:\n Use the elevator to escape!",
        );
        // Mark door opened in state (for potential save/load)
        this.state.doorOpened = true;
        // Also trigger the elevator to rise when the key is used
        try {
          this.openElevator();
        } catch (_e) {
          // elevator may not exist yet (ignore safely)
        }
        return true;
      } else {
        this.ui.showMessage("You need a key to use this.", 1400);
      }
    }

    // If player is pointing at the elevator platform (and it's raised), treat
    // pressing Space on it as completing the level.
    if (this.elevatorMesh) {
      const elevatorHit = intersects.find((i) =>
        i.object === this.elevatorMesh ||
        i.object.parent === this.elevatorMesh ||
        i.object === this.elevatorFrame ||
        i.object.parent === this.elevatorFrame
      );
      if (elevatorHit) {
        // Only allow finishing if the elevator has been raised close to floor level
        if (this.elevatorMesh.position.y > -0.5) {
          this.gameOver();
          return true;
        }
      }
    }

    return false;
  }

  public override update() {
    super.update();
    this.raycastUpdateMarkerFromCenter();
    // Crafting: press F near the table to craft a Metal Bat
    if (
      this.inputManager.consumeKey("f") || this.inputManager.consumeKey("F")
    ) {
      this.attemptCraftMetalBat();
    }

    if (this.inputManager.consumeInteractRequest()) {
      // First, try to handle interactions (pickup key / use keyhole).
      const handled = this.handleInteractionAtMarker();
      if (!handled && this.hasMetalBat) {
        // If nothing was handled, and player has a Metal Bat, attack.
        this.handleAttack();
      }
    }

    // Animate elevator if it's moving
    if (
      this.elevatorMoving && this.elevatorMesh && this.elevatorTargetY !== null
    ) {
      const currentY = this.elevatorMesh.position.y;
      const targetY = this.elevatorTargetY;
      // Smoothly interpolate towards target
      const newY = THREE.MathUtils.lerp(currentY, targetY, 0.08);
      this.elevatorMesh.position.y = newY;

      // Sync physics body transform if present
      if (this.elevatorBody) {
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(
          new Ammo.btVector3(
            this.elevatorMesh.position.x,
            this.elevatorMesh.position.y,
            this.elevatorMesh.position.z,
          ),
        );
        this.elevatorBody.setWorldTransform(transform);
      }

      // Sync visual cabin position/rotation with the physics platform
      if (this.elevatorFrame) {
        this.elevatorFrame.position.copy(this.elevatorMesh.position);
        this.elevatorFrame.quaternion.copy(this.elevatorMesh.quaternion);
      }

      // Stop if close enough
      if (Math.abs(newY - targetY) < 0.01) {
        this.elevatorMesh.position.y = targetY;
        this.elevatorMoving = false;
        this.elevatorTargetY = null;
        if (this.elevatorFrame) {
          this.elevatorFrame.position.copy(this.elevatorMesh.position);
          this.elevatorFrame.quaternion.copy(this.elevatorMesh.quaternion);
        }
      }
    }
  }

  private resetLevel() {
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
  }

  private gameOver() {
    this.ui.showOverlay("🎉🎉 LEVEL 3 COMPLETE 🎉🎉", "You have escaped!!");
    this.inputManager.clear();
    setTimeout(() => {
      (globalThis as unknown as Window).dispatchEvent(
        new CustomEvent("levelComplete", { detail: { level: 3 } }),
      );
    }, 20000);
  }

  // Save current game state
  public saveState(): GameState {
    const pos = this.playerMesh.position;
    const rot = this.camera.rotation;
    const vel = this.playerBody.getLinearVelocity();

    // Prepare inventory for saving: do not persist a crafted Metal Bat.
    // Ensure the saved inventory contains three basic bats.
    const saveInventory = [...this.inventory]
      // remove Metal Bat if present
      .filter((it) => it !== "Metal Bat")
      // remove any Bat entries (we'll replace with a canonical Bat x3 entry)
      .filter((it) => !it.startsWith("Bat"));
    // Ensure Bat x3 is present
    saveInventory.push(`Bat x3`);

    return {
      timestamp: Date.now(),
      playerState: {
        position: { x: pos.x, y: pos.y, z: pos.z },
        rotation: { x: rot.x, y: rot.y, z: rot.z },
        velocity: { x: vel.x(), y: vel.y(), z: vel.z() },
      },
      inventory: saveInventory,
      levelState: {
        doorOpened: this.state.doorOpened,
        chestOpened: false,
        wrongLandings: 0,
        blockSpawningEnabled: false,
        boardBroken: false,
        boardHits: 0,
      },
      // Persist batsCollected as 3 so loads will show three bats
      batsCollected: 3,
      keyVisible: this.keyMesh ? this.keyMesh.visible : false,
      batsVisible: this.bats.map((b) => b.visible),
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
    };
    this.batCount = state.batsCollected;
    if (this.keyMesh) this.keyMesh.visible = state.keyVisible;

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
      // If the door was already opened in the saved state, ensure the elevator
      // is raised so the player can proceed immediately.
      if (this.elevatorMesh) {
        const raisedY = 0.12;
        this.elevatorMesh.position.y = raisedY;
        this.elevatorMoving = false;
        this.elevatorTargetY = null;
        if (this.elevatorBody) {
          const t = new Ammo.btTransform();
          t.setIdentity();
          t.setOrigin(
            new Ammo.btVector3(
              this.elevatorMesh.position.x,
              this.elevatorMesh.position.y,
              this.elevatorMesh.position.z,
            ),
          );
          this.elevatorBody.setWorldTransform(t);
          // Also sync the visual cabin if present
          if (this.elevatorFrame) {
            this.elevatorFrame.position.copy(this.elevatorMesh.position);
            this.elevatorFrame.quaternion.copy(this.elevatorMesh.quaternion);
          }
        }
      }
    } else {
      this.doorMesh.visible = true;
      if (this.doorMesh.userData.physicsBody && !this.doorBodyInWorld) {
        this.physicsWorld.addRigidBody(this.doorMesh.userData.physicsBody);
        this.doorBodyInWorld = true;
      }
    }

    // Update bat in inventory with correct percentage
    if (this.batCount > 0) {
      const currentStrength = Math.max(
        0,
        this.batCount * 100,
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

  // Reset to initial game state
  public resetToInitialState(): void {
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

    // Clear inventory
    // Give the player 3 bats at new-game start
    this.batCount = 3;
    this.hasMetalBat = false;
    this.inventory = this.inventory.filter((i) => !i.startsWith("Bat"));
    this.inventory.push(`Bat x${this.batCount}`);
    this.ui.updateInventory(this.inventory);

    // Reset game state
    this.state = {
      doorOpened: false,
    };

    this.ui.showMessage("New game started!", 2000);
  }
}
