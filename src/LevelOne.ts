/// <reference types="./types/ammo-js.d.ts" />

import * as THREE from "three";
import { GameScene } from "./GameScene.ts";

export class LevelOne extends GameScene {
  private doorPivot!: THREE.Group;
  private doorMesh!: THREE.Mesh;
  private button!: THREE.Mesh;
  private marker!: THREE.Mesh;
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

    // Enhanced lighting
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemi.position.set(0, 20, 0);
    this.scene.add(hemi);

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
    this.createCube(20, 0, new THREE.Vector3(0, -0.25, 0), 0x808080);

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
    this.button = new THREE.Mesh(
      new THREE.BoxGeometry(this.BUTTON_SIZE, 0.2, this.BUTTON_SIZE),
      new THREE.MeshStandardMaterial({ color: 0xff4444 }),
    );
    this.button.position.set(0, 0.1, -6);
    this.scene.add(this.button);

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
    this.marker.position.y = this.BLOCK_SIZE / 2;
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

    const plane = new THREE.Plane(
      new THREE.Vector3(0, 1, 0),
      -this.BLOCK_SIZE / 2,
    );
    const pos = new THREE.Vector3();
    const intersect = this.raycaster.ray.intersectPlane(plane, pos);

    if (intersect) {
      this.marker.position.set(pos.x, this.BLOCK_SIZE / 2, pos.z);
    } else {
      const fallback = this.raycaster.ray.origin.clone().add(
        this.raycaster.ray.direction.clone().multiplyScalar(6),
      );
      this.marker.position.set(fallback.x, this.BLOCK_SIZE / 2, fallback.z);
    }
  }

  private spawnBlock(clientX: number, clientY: number) {
    this.updateMarkerFromPointer(clientX, clientY);

    const spawnPos = this.marker.position.clone();
    spawnPos.y += this.DROP_HEIGHT;

    // Create physics-enabled block
    this.createCube(
      this.BLOCK_SIZE,
      1,
      spawnPos,
      Math.random() * 0xffffff,
    );

    // Track the last created block
    const blockMesh = this.rigidBodies[this.rigidBodies.length - 1];
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
          if (linVel && Math.abs(linVel.y()) < 0.1 && !block.onGround) {
            block.onGround = true;
            block.hasLandedHandled = true;

            // Check if landed on button
            const bx = block.mesh.position.x;
            const bz = block.mesh.position.z;
            const btn = this.button.position;
            const half = this.BUTTON_SIZE / 2 + (this.BLOCK_SIZE / 2) * 0.9;
            const onButtonX = Math.abs(bx - btn.x) <= half;
            const onButtonZ = Math.abs(bz - btn.z) <= half;

            if (onButtonX && onButtonZ && !this.doorOpened) {
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
      if (this.doorOpenAnim >= 1) {
        this.showMessage("Victory!");
      }
    }
  }
}
