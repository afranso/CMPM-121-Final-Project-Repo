/// <reference types="./types/ammo-js.d.ts" />
import * as THREE from "three";

export abstract class GameScene {
  protected scene: THREE.Scene;
  protected camera: THREE.PerspectiveCamera;
  protected physicsWorld!: Ammo.btDiscreteDynamicsWorld;
  protected clock: THREE.Clock;

  // Arrays to keep track of objects to update
  protected rigidBodies: THREE.Mesh[] = [];
  protected tmpTrans: Ammo.btTransform;

  // Player properties
  protected playerBody!: Ammo.btRigidBody;
  protected playerMesh!: THREE.Mesh;
  protected isPlayerMoving = {
    forward: false,
    backward: false,
    left: false,
    right: false,
  };
  protected readonly PLAYER_SPEED = 5;
  protected readonly PLAYER_MASS = 50;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      globalThis.innerWidth / globalThis.innerHeight,
      0.1,
      1000,
    );
    this.clock = new THREE.Clock();

    // Initialize Ammo temporary transform helper (for optimization)
    this.tmpTrans = new Ammo.btTransform();

    this.initPhysics();
    this.initLights();
    this.setupPlayer(); // Setup the physics body for the player
    this.setupInputListeners(); // Add input listeners
    this.setupMouseLook(); // Add mouse look functionality
  }

  private initPhysics() {
    // Standard Ammo boilerplate
    const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
    const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
    const broadphase = new Ammo.btDbvtBroadphase();
    const solver = new Ammo.btSequentialImpulseConstraintSolver();

    this.physicsWorld = new Ammo.btDiscreteDynamicsWorld(
      dispatcher,
      broadphase,
      solver,
      collisionConfiguration,
    );
    this.physicsWorld.setGravity(new Ammo.btVector3(0, -9.82, 0));
  }

  private initLights() {
    const ambientLight = new THREE.AmbientLight(0x404040);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 10, 10);
    this.scene.add(ambientLight, dirLight);
  }

  // Abstract method to be implemented by subclasses for player initialization
  protected abstract setupPlayer(): void;

  // Helper to create a physics object
  protected createCube(
    size: number,
    mass: number,
    pos: THREE.Vector3,
    color: number,
  ): THREE.Mesh {
    // 1. Three.js Visuals
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshPhongMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(pos);
    this.scene.add(mesh);

    // 2. Ammo.js Physics
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));

    const motionState = new Ammo.btDefaultMotionState(transform);
    const colShape = new Ammo.btBoxShape(
      new Ammo.btVector3(size * 0.5, size * 0.5, size * 0.5),
    );
    const localInertia = new Ammo.btVector3(0, 0, 0);

    if (mass > 0) {
      colShape.calculateLocalInertia(mass, localInertia);
    }

    const rbInfo = new Ammo.btRigidBodyConstructionInfo(
      mass,
      motionState,
      colShape,
      localInertia,
    );
    const body = new Ammo.btRigidBody(rbInfo);

    this.physicsWorld.addRigidBody(body);

    // 3. Link them
    if (mass > 0) {
      mesh.userData.physicsBody = body;
      this.rigidBodies.push(mesh);
    }

    return mesh;
  }

  // Helper to create a box with custom dimensions
  protected createBox(
    width: number,
    height: number,
    depth: number,
    mass: number,
    pos: THREE.Vector3,
    color: number,
  ): THREE.Mesh {
    // 1. Three.js Visuals
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshPhongMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(pos);
    this.scene.add(mesh);

    // 2. Ammo.js Physics
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));

    const motionState = new Ammo.btDefaultMotionState(transform);
    const colShape = new Ammo.btBoxShape(
      new Ammo.btVector3(width * 0.5, height * 0.5, depth * 0.5),
    );
    const localInertia = new Ammo.btVector3(0, 0, 0);

    if (mass > 0) {
      colShape.calculateLocalInertia(mass, localInertia);
    }

    const rbInfo = new Ammo.btRigidBodyConstructionInfo(
      mass,
      motionState,
      colShape,
      localInertia,
    );
    const body = new Ammo.btRigidBody(rbInfo);

    this.physicsWorld.addRigidBody(body);

    // 3. Link them
    if (mass > 0) {
      mesh.userData.physicsBody = body;
      this.rigidBodies.push(mesh);
    }

    return mesh;
  }

  private setupInputListeners() {
    globalThis.addEventListener("keydown", (event) => {
      switch (event.key) {
        case "w":
        case "ArrowUp":
          this.isPlayerMoving.forward = true;
          break;
        case "s":
        case "ArrowDown":
          this.isPlayerMoving.backward = true;
          break;
        case "a":
        case "ArrowLeft":
          this.isPlayerMoving.left = true;
          break;
        case "d":
        case "ArrowRight":
          this.isPlayerMoving.right = true;
          break;
      }
    });

    globalThis.addEventListener("keyup", (event) => {
      switch (event.key) {
        case "w":
        case "ArrowUp":
          this.isPlayerMoving.forward = false;
          break;
        case "s":
        case "ArrowDown":
          this.isPlayerMoving.backward = false;
          break;
        case "a":
        case "ArrowLeft":
          this.isPlayerMoving.left = false;
          break;
        case "d":
        case "ArrowRight":
          this.isPlayerMoving.right = false;
          break;
      }
    });

    // Ensure the canvas retains focus for keyboard input after clicking
    globalThis.addEventListener("click", () => {
      globalThis.focus();
    });
  }

  private setupMouseLook() {
    let isMouseDown = false;

    globalThis.addEventListener("mousedown", (event) => {
      // Only enable mouse look for the right mouse button (button === 2)
      if (event.button === 2) {
        isMouseDown = true;
      }
    });

    globalThis.addEventListener("mouseup", (event) => {
      // Only disable mouse look for the right mouse button
      if (event.button === 2) {
        isMouseDown = false;
      }
    });

    globalThis.addEventListener("mousemove", (event) => {
      if (!isMouseDown) return;

      // Adjust camera rotation based on mouse movement
      const rotationSpeed = 0.002;
      this.camera.rotation.y -= event.movementX * rotationSpeed;
      this.camera.rotation.x -= event.movementY * rotationSpeed;

      // Clamp the vertical rotation to prevent flipping
      this.camera.rotation.x = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, this.camera.rotation.x),
      );
    });

    // Prevent context menu from appearing on right-click
    globalThis.addEventListener(
      "contextmenu",
      (event) => event.preventDefault(),
    );
  }

  private handlePlayerMovement(_deltaTime: number) {
    if (!this.playerBody) return;

    const moveSpeed = this.PLAYER_SPEED;
    const direction = new THREE.Vector3();

    if (this.isPlayerMoving.forward) {
      direction.z -= 1;
    }
    if (this.isPlayerMoving.backward) {
      direction.z += 1;
    }
    if (this.isPlayerMoving.left) {
      direction.x -= 1;
    }
    if (this.isPlayerMoving.right) {
      direction.x += 1;
    }

    // Normalize direction to prevent faster diagonal movement
    direction.normalize();

    // Rotate movement direction based on camera orientation
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0; // Keep movement horizontal
    cameraDirection.normalize();

    const right = new THREE.Vector3().crossVectors(
      new THREE.Vector3(0, 1, 0),
      cameraDirection,
    );

    // Correct movement direction based on camera orientation
    const moveVector = new THREE.Vector3()
      .addScaledVector(cameraDirection, -direction.z) // Invert forward/backward
      .addScaledVector(right, -direction.x); // Invert left/right

    // Apply movement as a force to the player's physics body
    const impulse = new Ammo.btVector3(
      moveVector.x * moveSpeed,
      0,
      moveVector.z * moveSpeed,
    );
    this.playerBody.applyCentralImpulse(impulse);

    // Sync camera to player position
    const ms = this.playerBody.getMotionState();
    if (ms) {
      ms.getWorldTransform(this.tmpTrans);
      const p = this.tmpTrans.getOrigin();
      this.camera.position.set(p.x(), p.y() + 0.5, p.z());
    }
  }

  public update() {
    const deltaTime = this.clock.getDelta();

    // Call the new movement handler
    this.handlePlayerMovement(deltaTime);

    // Step Physics World with fixed timestep to prevent tunneling
    // Clamp deltaTime to prevent spiral of death and use fixed substeps
    const clampedDelta = Math.min(deltaTime, 0.1);
    this.physicsWorld.stepSimulation(clampedDelta, 10, 1 / 60);

    // Sync Visuals to Physics
    for (let i = 0; i < this.rigidBodies.length; i++) {
      const objThree = this.rigidBodies[i];
      const objPhys = objThree.userData.physicsBody;
      const ms = objPhys.getMotionState();

      if (ms) {
        ms.getWorldTransform(this.tmpTrans);
        const p = this.tmpTrans.getOrigin();
        const q = this.tmpTrans.getRotation();

        objThree.position.set(p.x(), p.y(), p.z());
        objThree.quaternion.set(q.x(), q.y(), q.z(), q.w());
      }
    }
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }
  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }
}
