import * as THREE from "three";
import { GameScene } from "./GameScene.ts";

export class LevelOne extends GameScene {
  private doorPivot!: THREE.Group;
  private doorMesh!: THREE.Mesh;
  private button!: THREE.Mesh;
  private marker!: THREE.Mesh;
  private floor!: THREE.Mesh;
  private blocks: Array<{
    mesh: THREE.Mesh;
    velY: number;
    onGround: boolean;
    hasLandedHandled: boolean;
  }> = [];

  private doorOpened = false;
  private doorOpenAnim = 0;
  private wrongLandings = 0;
  private readonly MAX_WRONG = 3;
  private readonly DROP_HEIGHT = 5;
  private readonly BLOCK_SIZE = 1;
  private readonly BUTTON_SIZE = 1;

  private overlay!: HTMLDivElement;
  private message!: HTMLDivElement;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  constructor() {
    super();
    this.setupLevel();
    this.setupUI();
    this.setupEventListeners();
  }

  private setupLevel() {
    // Camera position
    this.camera.position.set(0, 4, 8);
    this.camera.lookAt(0, 1, 0);

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
  }

  private createRoom() {
    const room = new THREE.Group();
    this.scene.add(room);

    // Floor - using physics
    // Create a large flat floor (20x20 horizontal, 1 unit thick)
    // Position it so the top surface is at y=0
    this.floor = this.createBox(
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
  }

  private createDoor() {
    const doorWidth = 2;
    const doorHeight = 3;
    const doorDepth = 0.2;

    this.doorPivot = new THREE.Group();
    this.doorPivot.position.set(
      -doorWidth / 2 + 1,
      doorHeight / 2,
      -9 + 0.26,
    );
    this.scene.add(this.doorPivot);

    this.doorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(doorWidth, doorHeight, doorDepth),
      new THREE.MeshStandardMaterial({ color: 0x552200 }),
    );
    this.doorMesh.position.set(doorWidth / 2, 0, 0);
    this.doorPivot.add(this.doorMesh);
  }

  private createButton() {
    // Create button with physics (static object, mass = 0)
    this.button = this.createBox(
      this.BUTTON_SIZE,
      0.2,
      this.BUTTON_SIZE,
      0,
      new THREE.Vector3(0, 0.1, -6),
      0xff4444,
    );

    // Button outline
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

  private setupUI() {
    this.overlay = document.createElement("div");
    this.overlay.style.cssText = `
      position: fixed;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 10;
    `;
    document.body.appendChild(this.overlay);

    this.message = document.createElement("div");
    this.message.style.cssText = `
      padding: 24px 36px;
      background: rgba(0,0,0,0.8);
      color: white;
      font-family: sans-serif;
      font-size: 28px;
      border-radius: 8px;
      display: none;
    `;
    this.overlay.appendChild(this.message);
  }

  private setupEventListeners() {
    globalThis.addEventListener("pointermove", (e: PointerEvent) => {
      this.updateMarkerFromPointer(e.clientX, e.clientY);
    });

    globalThis.addEventListener("pointerdown", (e: PointerEvent) => {
      if (e.button === 0) {
        // Left click - spawn block
        this.spawnBlock(e.clientX, e.clientY);
      }
    });

    // Initialize marker position
    this.updateMarkerFromPointer(
      globalThis.innerWidth / 2,
      globalThis.innerHeight / 2,
    );
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
          this.rigidBodies.splice(rbIdx, 1);
        }
      }
    }, 6000);
  }

  private showMessage(text: string) {
    this.message.textContent = text;
    this.message.style.display = "block";
  }

  private hideMessage() {
    this.message.style.display = "none";
  }

  private resetScene() {
    this.blocks.forEach((b) => {
      this.scene.remove(b.mesh);
      const idx = this.rigidBodies.indexOf(b.mesh);
      if (idx !== -1) this.rigidBodies.splice(idx, 1);
    });
    this.blocks.length = 0;
    this.doorPivot.rotation.y = 0;
    this.doorOpened = false;
    this.doorOpenAnim = 0;
    this.wrongLandings = 0;
    this.hideMessage();
  }

  private startOpenDoor() {
    if (this.doorOpened) return;
    this.doorOpened = true;
    this.doorOpenAnim = 0;
    this.showMessage("Victory!");
  }

  public override update() {
    super.update();

    const deltaTime = this.clock.getDelta();

    // Check for block landings
    for (const block of this.blocks) {
      if (!block.hasLandedHandled) {
        // Check if block has settled (velocity is very low)
        const body = block.mesh.userData.physicsBody;
        if (body) {
          const linVel = body.getLinearVelocity();
          const angVel = body.getAngularVelocity();
          // More lenient velocity check and ensure block is near ground
          const isSettled = linVel && Math.abs(linVel.y()) < 1.0 &&
            Math.abs(linVel.x()) < 1.0 && Math.abs(linVel.z()) < 1.0 &&
            angVel && Math.abs(angVel.x()) < 1.0 &&
            Math.abs(angVel.y()) < 1.0 && Math.abs(angVel.z()) < 1.0;
          const isNearGround = block.mesh.position.y < 2.0; // Within reasonable height from floor

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
            // Button: center at y=0.1, height=0.2, so top at y=0.2
            // Block on button: center at 0.2 + 0.5 = 0.7
            const buttonTopY = btn.y + 0.1; // 0.1 + 0.1 = 0.2
            const blockOnButtonY = buttonTopY + this.BLOCK_SIZE / 2; // 0.2 + 0.5 = 0.7

            // Check if block is on button (must be elevated above floor)
            const onButtonY = Math.abs(by - blockOnButtonY) < 0.3;

            if (onButtonX && onButtonZ && onButtonY && !this.doorOpened) {
              this.startOpenDoor();
            } else {
              if (!this.doorOpened) {
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

    // Door opening animation
    if (this.doorOpened && this.doorOpenAnim < 1) {
      this.doorOpenAnim = Math.min(1, this.doorOpenAnim + deltaTime * 1.2);
      const t = 1 - Math.pow(1 - this.doorOpenAnim, 3);
      this.doorPivot.rotation.y = -Math.PI / 2 * t;
    }
  }
}
