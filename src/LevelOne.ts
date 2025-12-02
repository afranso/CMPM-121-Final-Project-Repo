import * as THREE from "three";
import { GameScene } from "./GameScene.ts";

export class LevelOne extends GameScene {
  // Removed doorPivot, since the new logic uses a sliding door
  private doorMesh!: THREE.Mesh;
  private button!: THREE.Mesh;
  private marker!: THREE.Mesh;
  private floor!: THREE.Mesh; // The floor of the first room is used for raycasting

  private keyMesh!: THREE.Mesh;
  private hasKey = false;
  private readonly KEY_SIZE = 0.2;
  private readonly BUTTON_POS = new THREE.Vector3(0, 0.1, -6); // Position of the red button
  private readonly KEY_SPAWN_POS = new THREE.Vector3(1.5, 0.2, -6); // Key spawns next to button

  private blocks: Array<{
    mesh: THREE.Mesh;
    velY: number;
    onGround: boolean;
    hasLandedHandled: boolean;
  }> = [];

  private doorOpened = false;
  // Removed doorOpenAnim, as the new openDoor() uses requestAnimationFrame
  private wrongLandings = 0;
  private readonly MAX_WRONG = 3;
  private readonly DROP_HEIGHT = 5;
  private readonly BLOCK_SIZE = 1;
  private readonly BUTTON_SIZE = 1;

  private overlay!: HTMLDivElement;
  private message!: HTMLDivElement;
  private inventory!: HTMLDivElement;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  private backWallBody: Ammo.btRigidBody | null = null;

  private chest!: THREE.Mesh;
  private chestOpened = false;

  private bat!: THREE.Mesh;
  private batPickedUp = false;

  constructor() {
    super();
    this.setupLevel();
    this.setupUI();
    this.setupEventListeners();
  }

  protected setupPlayer(): void {
    const playerHeight = 1.8;
    const playerRadius = 0.5;

    // Player body mesh
    this.playerMesh = this.createBox(
      playerRadius * 2,
      playerHeight,
      playerRadius * 2,
      this.PLAYER_MASS,
      new THREE.Vector3(0, playerHeight / 2, 5), // Starting position
      0x00ff00,
    );

    // Get the physics body and configure it
    const body = this.playerMesh.userData.physicsBody as Ammo.btRigidBody;
    this.playerBody = body;

    // Prevent rotation (roll and pitch) but allow yaw
    body.setAngularFactor(new Ammo.btVector3(0, 1, 0));

    // Hide the player box, the camera will represent the player
    this.playerMesh.visible = false;

    // Initial camera position (synced in updatePlayer)
    this.camera.position.set(
      this.playerMesh.position.x,
      this.playerMesh.position.y + 0.5,
      this.playerMesh.position.z,
    );
    this.camera.lookAt(0, 1, 0);
  }

  private setupLevel() {
    // Scene background
    this.scene.background = new THREE.Color(0x222222);

    // Enhanced lighting
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemi.position.set(0, 20, 0);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 2);
    this.scene.add(dir);

    // Room setup
    this.createRoom();
    this.createDoor();
    this.createButton();
    this.createMarker();
    this.createKey(); // Add the key, initially hidden
    this.createSecondRoom(); // Add the second room
    this.createDoorway(); // Add a hole in the wall behind the door
    this.addFlooringBetweenRooms(); // Add flooring between the two rooms
    this.createChest(); // Add the treasure chest to room 2
    this.createBat(); // Add the bat item to the scene

    // Add debugging helpers to the scene
    this.addDebugHelpers();
  }

  private createRoom() {
    const room = new THREE.Group();
    this.scene.add(room);

    // Floor - using physics
    this.floor = this.createBox( // FIX: Assigned to this.floor
      20,
      1,
      20,
      0,
      new THREE.Vector3(0, -0.5, 0),
      0x808080,
    );

    // Walls (static visual only, no physics needed for now)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x666666 });

    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(20, 6, 0.5),
      wallMat,
    );
    backWall.position.set(0, 3, -10 + 0.25);
    room.add(backWall);

    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 6, 20),
      wallMat,
    );
    leftWall.position.set(-10 + 0.25, 3, 0);
    room.add(leftWall);

    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 6, 20),
      wallMat,
    );
    rightWall.position.set(10 - 0.25, 3, 0);
    room.add(rightWall);

    // Add physics to the back wall
    const backWallShape = new Ammo.btBoxShape(
      new Ammo.btVector3(10, 3, 0.25),
    );
    const backWallTransform = new Ammo.btTransform();
    backWallTransform.setIdentity();
    backWallTransform.setOrigin(new Ammo.btVector3(0, 3, -10 + 0.25));
    const backWallMotionState = new Ammo.btDefaultMotionState(
      backWallTransform,
    );
    const backWallRbInfo = new Ammo.btRigidBodyConstructionInfo(
      0,
      backWallMotionState,
      backWallShape,
      new Ammo.btVector3(0, 0, 0),
    );
    const backWallBody = new Ammo.btRigidBody(backWallRbInfo);
    this.physicsWorld.addRigidBody(backWallBody);

    // Store a reference to the back wall's physics body
    this.backWallBody = backWallBody;

    // Repeat for left and right walls
    const leftWallShape = new Ammo.btBoxShape(
      new Ammo.btVector3(0.25, 3, 10),
    );
    const leftWallTransform = new Ammo.btTransform();
    leftWallTransform.setIdentity();
    leftWallTransform.setOrigin(new Ammo.btVector3(-10 + 0.25, 3, 0));
    const leftWallMotionState = new Ammo.btDefaultMotionState(
      leftWallTransform,
    );
    const leftWallRbInfo = new Ammo.btRigidBodyConstructionInfo(
      0,
      leftWallMotionState,
      leftWallShape,
      new Ammo.btVector3(0, 0, 0),
    );
    const leftWallBody = new Ammo.btRigidBody(leftWallRbInfo);
    this.physicsWorld.addRigidBody(leftWallBody);

    const rightWallShape = new Ammo.btBoxShape(
      new Ammo.btVector3(0.25, 3, 10),
    );
    const rightWallTransform = new Ammo.btTransform();
    rightWallTransform.setIdentity();
    rightWallTransform.setOrigin(new Ammo.btVector3(10 - 0.25, 3, 0));
    const rightWallMotionState = new Ammo.btDefaultMotionState(
      rightWallTransform,
    );
    const rightWallRbInfo = new Ammo.btRigidBodyConstructionInfo(
      0,
      rightWallMotionState,
      rightWallShape,
      new Ammo.btVector3(0, 0, 0),
    );
    const rightWallBody = new Ammo.btRigidBody(rightWallRbInfo);
    this.physicsWorld.addRigidBody(rightWallBody);
  }

  private createDoor() {
    const doorWidth = 2;
    const doorHeight = 3;
    const doorDepth = 0.2;

    // Door material with a wooden appearance
    // Temporary material for debugging
    const doorMaterial = new THREE.MeshBasicMaterial({
      color: 0x552200,
    });

    // Create the door mesh
    this.doorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(doorWidth, doorHeight, doorDepth),
      doorMaterial,
    );
    this.doorMesh.position.set(0, doorHeight / 2, -10 + 0.25); // Position in the shared wall
    this.scene.add(this.doorMesh);

    // Add physics body to block the player
    const doorShape = new Ammo.btBoxShape(
      new Ammo.btVector3(doorWidth / 2, doorHeight / 2, doorDepth / 2),
    );
    const doorTransform = new Ammo.btTransform();
    doorTransform.setIdentity();
    doorTransform.setOrigin(new Ammo.btVector3(0, doorHeight / 2, -10 + 0.25));
    const motionState = new Ammo.btDefaultMotionState(doorTransform);
    const localInertia = new Ammo.btVector3(0, 0, 0);
    const rbInfo = new Ammo.btRigidBodyConstructionInfo(
      0,
      motionState,
      doorShape,
      localInertia,
    );
    const doorBody = new Ammo.btRigidBody(rbInfo);
    this.physicsWorld.addRigidBody(doorBody);

    // Link the physics body to the mesh
    this.doorMesh.userData.physicsBody = doorBody;
  }

  private openDoor() {
    if (this.doorOpened) return;
    this.doorOpened = true;

    // Remove the door's physics body to allow passage
    if (this.doorMesh.userData.physicsBody) {
      const body = this.doorMesh.userData.physicsBody;
      this.physicsWorld.removeRigidBody(body); // Correct method for removing rigid bodies
      this.doorMesh.userData.physicsBody = null;
    }

    // Animate the door sliding to the left
    const originalX = this.doorMesh.position.x;
    const slideDistance = originalX - 3; // Slide 3 units to the left
    const duration = 1.5; // Animation duration in seconds
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsedTime = (currentTime - startTime) / 1000; // Convert to seconds
      const progress = Math.min(elapsedTime / duration, 1); // Clamp progress to [0, 1]

      // LERP from originalX to slideDistance
      this.doorMesh.position.x = originalX +
        (slideDistance - originalX) * progress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);

    // Ensure the door does not block the player
    this.doorMesh.visible = false;
  }

  private createButton() {
    this.button = this.createBox(
      this.BUTTON_SIZE,
      0.2,
      this.BUTTON_SIZE,
      0,
      this.BUTTON_POS,
      0xff4444,
    );

    const buttonOutline = new THREE.LineSegments(
      new THREE.EdgesGeometry(
        new THREE.BoxGeometry(
          this.BUTTON_SIZE + 0.1,
          0.21,
          this.BUTTON_SIZE + 0.1,
        ),
      ),
      new THREE.LineBasicMaterial({ color: 0x000000 }),
    );
    buttonOutline.position.copy(this.button.position);
    this.scene.add(buttonOutline);
  }

  private createMarker() {
    this.marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0x444400 }),
    );
    this.marker.position.y = 0.05; // Slightly above ground for visibility
    this.marker.visible = true;
    this.scene.add(this.marker);
  }

  private createKey() {
    // Simple key visual (small yellow sphere, visual only)
    this.keyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(this.KEY_SIZE, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0x888800 }),
    );
    this.keyMesh.position.copy(this.KEY_SPAWN_POS); // Use the new key position
    this.keyMesh.visible = false; // Initially hidden
    this.scene.add(this.keyMesh);
  }

  private createSecondRoom() {
    const room = new THREE.Group();
    this.scene.add(room);

    // Floor for the second room
    const _floor2 = this.createBox(
      20,
      1,
      20,
      0,
      new THREE.Vector3(0, -0.5, -20), // Positioned directly behind the first room
      0x808080,
    );

    // Walls for the second room
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x666666 });

    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(20, 6, 0.5),
      wallMat,
    );
    backWall.position.set(0, 3, -30 + 0.25);
    room.add(backWall);

    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 6, 20),
      wallMat,
    );
    leftWall.position.set(-10 + 0.25, 3, -20);
    room.add(leftWall);

    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 6, 20),
      wallMat,
    );
    rightWall.position.set(10 - 0.25, 3, -20);
    room.add(rightWall);
  }

  private createDoorway() {
    // Create a hole in the shared wall for the door
    const holeWidth = 2;
    const holeHeight = 3;
    const holeDepth = 0.5;

    const hole = new THREE.Mesh(
      new THREE.BoxGeometry(holeWidth, holeHeight, holeDepth),
      new THREE.MeshStandardMaterial({ color: 0x222222 }), // Match background color
    );
    hole.position.set(0, holeHeight / 2, -10 + 0.25); // Align with the shared wall
    this.scene.add(hole);

    // Add the remaining parts of the shared wall
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x666666 });

    const leftWallPart = new THREE.Mesh(
      new THREE.BoxGeometry(9, 6, 0.5),
      wallMat,
    );
    leftWallPart.position.set(-5.5, 3, -10 + 0.25);
    this.scene.add(leftWallPart);

    const rightWallPart = new THREE.Mesh(
      new THREE.BoxGeometry(9, 6, 0.5),
      wallMat,
    );
    rightWallPart.position.set(5.5, 3, -10 + 0.25);
    this.scene.add(rightWallPart);

    // Remove the back wall's physics body using the stored reference
    if (this.backWallBody) {
      this.physicsWorld.removeRigidBody(this.backWallBody);
      this.backWallBody = null; // Clear the reference
    }

    // Add physics bodies for the left and right parts of the wall
    const leftWallPartShape = new Ammo.btBoxShape(
      new Ammo.btVector3(4.5, 3, 0.25),
    );
    const leftWallPartTransform = new Ammo.btTransform();
    leftWallPartTransform.setIdentity();
    leftWallPartTransform.setOrigin(new Ammo.btVector3(-5.5, 3, -10 + 0.25));
    const leftWallPartMotionState = new Ammo.btDefaultMotionState(
      leftWallPartTransform,
    );
    const leftWallPartRbInfo = new Ammo.btRigidBodyConstructionInfo(
      0,
      leftWallPartMotionState,
      leftWallPartShape,
      new Ammo.btVector3(0, 0, 0),
    );
    const leftWallPartBody = new Ammo.btRigidBody(leftWallPartRbInfo);
    this.physicsWorld.addRigidBody(leftWallPartBody);

    const rightWallPartShape = new Ammo.btBoxShape(
      new Ammo.btVector3(4.5, 3, 0.25),
    );
    const rightWallPartTransform = new Ammo.btTransform();
    rightWallPartTransform.setIdentity();
    rightWallPartTransform.setOrigin(new Ammo.btVector3(5.5, 3, -10 + 0.25));
    const rightWallPartMotionState = new Ammo.btDefaultMotionState(
      rightWallPartTransform,
    );
    const rightWallPartRbInfo = new Ammo.btRigidBodyConstructionInfo(
      0,
      rightWallPartMotionState,
      rightWallPartShape,
      new Ammo.btVector3(0, 0, 0),
    );
    const rightWallPartBody = new Ammo.btRigidBody(rightWallPartRbInfo);
    this.physicsWorld.addRigidBody(rightWallPartBody);
  }

  private addFlooringBetweenRooms() {
    // Add flooring to connect the two rooms
    const _floor3 = this.createBox(
      20,
      1,
      10,
      0,
      new THREE.Vector3(0, -0.5, -15), // Positioned between the two rooms
      0x808080,
    );
  }

  private createChest() {
    const chestGeometry = new THREE.BoxGeometry(1, 0.5, 1);
    const chestMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    this.chest = new THREE.Mesh(chestGeometry, chestMaterial);
    this.chest.position.set(0, 0.25, -15); // Place in room 2
    this.scene.add(this.chest);

    // Create a text sprite or label for the message
    const message = this.createTextSprite("Key Required", {
      fontSize: 24,
      color: "#FFFFFF",
    });
    message.position.set(0, 1.75, -15); // Adjust position above the chest
    this.scene.add(message);
  }

  // Helper method to create a text sprite
  private createTextSprite(
    text: string,
    { fontSize, color }: { fontSize: number; color: string },
  ): THREE.Sprite {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Failed to get 2D context for canvas");
    }

    context.font = `${fontSize}px Arial`;
    context.fillStyle = color;
    context.fillText(text, 0, fontSize);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(2, 1, 1); // Adjust scale as needed

    return sprite;
  }

  private createBat() {
    const batGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2);
    const batMaterial = new THREE.MeshStandardMaterial({ color: 0x964B00 });
    this.bat = new THREE.Mesh(batGeometry, batMaterial);
    this.bat.position.set(0, 1, -15); // Place near the chest
    this.bat.visible = false; // Initially hidden
    this.scene.add(this.bat);
  }

  private setupUI() {
    // --- Message Overlay (Top of Screen) ---
    this.overlay = document.createElement("div");
    this.overlay.style.cssText = `
      position: fixed;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      pointer-events: none;
      z-index: 10;
    `;
    document.body.appendChild(this.overlay);

    this.message = document.createElement("div");
    this.message.style.cssText = `
      margin-top: 10vh;
      padding: 24px 36px;
      background: rgba(0,0,0,0.8);
      color: white;
      font-family: sans-serif;
      font-size: 28px;
      border-radius: 8px;
      display: none;
    `;
    this.overlay.appendChild(this.message);

    // --- Inventory UI (Bottom Right) ---
    this.inventory = document.createElement("div");
    this.inventory.style.cssText = `
        position: fixed;
        right: 20px;
        bottom: 20px;
        padding: 10px;
        background: rgba(0,0,0,0.6);
        color: white;
        border-radius: 8px;
        font-family: sans-serif;
        font-size: 18px;
        min-width: 150px;
        text-align: center;
        z-index: 10;
    `;
    document.body.appendChild(this.inventory);

    this.updateInventoryUI(); // Initial inventory display
  }

  private updateInventoryUI() {
    if (this.hasKey) {
      this.inventory.innerHTML =
        'Inventory: <span style="color: yellow;">[Key]</span>';
    } else {
      this.inventory.innerHTML = "Inventory: (Empty)";
    }
  }

  private setupEventListeners() {
    globalThis.addEventListener("pointermove", (e: PointerEvent) => {
      this.updateMarkerFromPointer(e.clientX, e.clientY);
    });

    globalThis.addEventListener("pointerdown", (e: PointerEvent) => {
      if (e.button === 0) {
        const intersects = this.raycaster.intersectObject(this.chest);
        if (intersects.length > 0) {
          this.handleChestInteraction();
          return;
        }

        // Left click - check for key pickup OR spawn block
        if (!this.hasKey && this.keyMesh.visible) {
          // Check for key click before spawning a block
          this.handleClickInteraction(e.clientX, e.clientY);
        } else {
          this.spawnBlock(e.clientX, e.clientY);
        }

        // Check for bat pickup
        const batIntersects = this.raycaster.intersectObject(this.bat);
        if (batIntersects.length > 0) {
          this.handleBatPickup();
          return;
        }
      }
    });

    // WASD Movement and E Interaction
    globalThis.addEventListener("keydown", (e: KeyboardEvent) => {
      this.handleKeyEvent(e.key, true);
    });

    globalThis.addEventListener("keyup", (e: KeyboardEvent) => {
      this.handleKeyEvent(e.key, false);
    });

    // Initialize marker position
    this.updateMarkerFromPointer(
      globalThis.innerWidth / 2,
      globalThis.innerHeight / 2,
    );
  }

  private handleKeyEvent(key: string, isDown: boolean) {
    switch (key.toLowerCase()) {
      case "w":
        this.isPlayerMoving.forward = isDown;
        break;
      case "s":
        this.isPlayerMoving.backward = isDown;
        break;
      case "a":
        this.isPlayerMoving.left = isDown;
        break;
      case "d":
        this.isPlayerMoving.right = isDown;
        break;
      case "e": // 'E' key for door interaction
        if (isDown) this.handleInteraction();
        break;
    }
  }

  private handleClickInteraction(clientX: number, clientY: number) {
    this.pointer.x = (clientX / globalThis.innerWidth) * 2 - 1;
    this.pointer.y = -(clientY / globalThis.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    // Raycast only against the key mesh
    const intersects = this.raycaster.intersectObject(this.keyMesh);

    if (intersects.length > 0 && intersects[0].object === this.keyMesh) {
      // Player clicked the key! Equip it.
      this.hasKey = true;
      this.keyMesh.visible = false;
      this.updateInventoryUI();
      this.showMessage("Picked up the Key! Press 'E' near the door to unlock.");
      setTimeout(() => this.hideMessage(), 2000);
    }
  }

  private updateMarkerFromPointer(clientX: number, clientY: number) {
    this.pointer.x = (clientX / globalThis.innerWidth) * 2 - 1;
    this.pointer.y = -(clientY / globalThis.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    // Raycast against floor and button
    const intersects = this.raycaster.intersectObjects([
      this.floor,
      this.button,
    ]);

    if (intersects.length > 0) {
      // Position marker at the intersection point
      this.marker.position.copy(intersects[0].point);
      // Lift marker slightly above surface for visibility
      this.marker.position.y += 0.05;
    } else {
      // Fallback to plane intersection if no objects hit
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const pos = new THREE.Vector3();
      const intersect = this.raycaster.ray.intersectPlane(plane, pos);
      if (intersect) {
        this.marker.position.copy(pos);
        this.marker.position.y = 0.05;
      }
    }
  }

  private spawnBlock(clientX: number, clientY: number) {
    // Only allow spawning in the first room (Z > -10)
    if (this.camera.position.z < -10) {
      this.showMessage("Cannot spawn blocks in this room.");
      setTimeout(() => this.hideMessage(), 1000);
      return;
    }

    this.updateMarkerFromPointer(clientX, clientY);

    const spawnPos = this.marker.position.clone();
    // Spawn at marker position (ground level) + block center height + drop height
    spawnPos.y = this.BLOCK_SIZE / 2 + this.DROP_HEIGHT;

    // Create physics-enabled block
    const blockMesh = this.createCube(
      this.BLOCK_SIZE,
      1,
      spawnPos,
      Math.random() * 0xffffff,
    );

    // Track the created block
    const blockState = {
      mesh: blockMesh,
      velY: 0,
      onGround: false,
      hasLandedHandled: false,
    };
    this.blocks.push(blockState);

    // Auto-despawn after 6 seconds
    setTimeout(() => {
      const idx = this.blocks.indexOf(blockState);
      if (idx !== -1) {
        this.scene.remove(blockState.mesh);
        this.blocks.splice(idx, 1);
        const rbIdx = this.rigidBodies.indexOf(blockState.mesh);
        if (rbIdx !== -1) {
          // This removes the mesh from the list that gets synced, but the Ammo body remains in the world.
          // For a clean solution, the Ammo.btRigidBody needs to be explicitly destroyed and removed from physicsWorld.
          this.rigidBodies.splice(rbIdx, 1);
        }
      }
    }, 6000);
  }

  private handleInteraction() {
    if (this.doorOpened) return;

    // Check if the player has the key
    if (this.hasKey) {
      const playerPos = this.playerMesh.position;
      const doorPos = this.doorMesh.position;
      const distance = playerPos.distanceTo(doorPos);

      // Ensure the player is close enough to the door
      if (distance < 3) {
        this.openDoor();
        this.showMessage("Door unlocked! Proceed to the next room.");
        setTimeout(() => this.hideMessage(), 2000);
      } else {
        this.showMessage("You need to be closer to the door.");
        setTimeout(() => this.hideMessage(), 2000);
      }
    } else {
      this.showMessage("You need a key to unlock this door.");
      setTimeout(() => this.hideMessage(), 2000);
    }
  }

  private handleChestInteraction() {
    if (this.chestOpened) return;

    if (this.hasKey) {
      this.chestOpened = true;
      this.showMessage("The chest is now open! You can pick up the bat.");
      setTimeout(() => this.hideMessage(), 2000);

      // Change chest appearance to indicate it's open
      this.chest.material = new THREE.MeshStandardMaterial({ color: 0xD2B48C });

      // Make the bat visible when the chest is opened
      this.bat.visible = true;
    } else {
      this.showMessage("You need the key to open this chest.");
      setTimeout(() => this.hideMessage(), 2000);
    }
  }

  private handleBatPickup() {
    if (this.batPickedUp) return;

    this.batPickedUp = true;
    this.bat.visible = false;
    this.showMessage("You picked up a bat! It's now in your inventory.");
    setTimeout(() => this.hideMessage(), 2000);

    // Update inventory UI
    this.inventory.innerHTML =
      'Inventory: <span style="color: yellow;">[Key, Bat]</span>';
  }

  private showMessage(text: string) {
    this.message.textContent = text;
    this.message.style.display = "block";
  }

  private hideMessage() {
    this.message.style.display = "none";
  }

  private resetScene() {
    // Clear blocks
    this.blocks.forEach((b) => {
      this.scene.remove(b.mesh);
      const idx = this.rigidBodies.indexOf(b.mesh);
      if (idx !== -1) this.rigidBodies.splice(idx, 1);
    });
    this.blocks.length = 0;

    // The door is reset by resetting the physics body and mesh position
    this.doorOpened = false;
    this.doorMesh.position.x = 0;
    this.createDoor(); // Re-add physics body to the door

    // Reset key and state
    this.keyMesh.visible = false;
    this.hasKey = false;
    this.updateInventoryUI(); // RESET INVENTORY DISPLAY

    // Reset game state
    this.wrongLandings = 0;
    this.hideMessage();

    // Reset player position (optional, but good practice)
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    const startPos = new THREE.Vector3(0, 1.8 / 2, 5);
    transform.setOrigin(
      new Ammo.btVector3(startPos.x, startPos.y, startPos.z),
    );

    this.playerBody.setWorldTransform(transform);
    this.playerBody.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
    this.playerBody.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
  }

  public override update() {
    super.update();

    // Check for block landings
    for (const block of this.blocks) {
      if (!block.hasLandedHandled) {
        const body = block.mesh.userData.physicsBody;
        if (body) {
          const linVel = body.getLinearVelocity();
          const angVel = body.getAngularVelocity();
          // Check if block has settled (velocity is very low)
          const isSettled = linVel && Math.abs(linVel.y()) < 0.5 &&
            Math.abs(linVel.x()) < 0.5 && Math.abs(linVel.z()) < 0.5 &&
            angVel && Math.abs(angVel.x()) < 0.5 &&
            Math.abs(angVel.y()) < 0.5 && Math.abs(angVel.z()) < 0.5;
          const isNearGround = block.mesh.position.y < 2.0;

          if (isSettled && isNearGround && !block.onGround) {
            block.onGround = true;
            block.hasLandedHandled = true;

            // Check if landed on button (check X, Z, and Y position)
            const bx = block.mesh.position.x;
            const by = block.mesh.position.y;
            const bz = block.mesh.position.z;
            const btn = this.button.position;

            // Horizontal tolerance
            const half = this.BUTTON_SIZE / 2 + (this.BLOCK_SIZE / 2) * 0.9;
            const onButtonX = Math.abs(bx - btn.x) <= half;
            const onButtonZ = Math.abs(bz - btn.z) <= half;

            // Vertical check - block should be resting on button
            const buttonTopY = btn.y + 0.1;
            const blockOnButtonY = buttonTopY + this.BLOCK_SIZE / 2;

            // Check if block is resting correctly on top of the button
            const onButtonY = Math.abs(by - blockOnButtonY) < 0.2;

            if (
              onButtonX && onButtonZ && onButtonY && !this.keyMesh.visible &&
              !this.doorOpened
            ) {
              // Success: Spawn the key
              this.keyMesh.visible = true;
              this.showMessage(
                "Success! A Key has appeared. Click it to pick it up.",
              );
              setTimeout(() => this.hideMessage(), 2500);
            } else {
              // Wrong spot check
              if (!this.doorOpened && !this.keyMesh.visible) {
                this.wrongLandings++;
                if (this.wrongLandings >= this.MAX_WRONG) {
                  this.showMessage("You failed. Restarting...");
                  setTimeout(() => {
                    this.resetScene();
                  }, 3000);
                } else {
                  this.showMessage(
                    `Wrong spot (${this.wrongLandings}/${this.MAX_WRONG})`,
                  );
                  setTimeout(() => this.hideMessage(), 1000);
                }
              }
            }
          }
        }
      }
    }
  }

  // Correctly define and call the addDebugHelpers method
  private addDebugHelpers(): void {
    const gridHelper = new THREE.GridHelper(20, 20);
    this.scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(5);
    this.scene.add(axesHelper);
  }
}
