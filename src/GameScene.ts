/// <reference types="./types/ammo-js.d.ts" />
import * as THREE from "three";
import { InputManager } from "./inputManager.ts";

export abstract class GameScene {
  protected scene: THREE.Scene;
  protected camera: THREE.PerspectiveCamera;
  protected physicsWorld!: Ammo.btDiscreteDynamicsWorld;
  protected clock: THREE.Clock;
  protected inputManager: InputManager;

  protected rigidBodies: THREE.Mesh[] = [];
  protected tmpTrans: Ammo.btTransform;

  protected playerBody!: Ammo.btRigidBody;
  protected playerMesh!: THREE.Mesh;
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
    this.inputManager = new InputManager();
    this.tmpTrans = new Ammo.btTransform();

    this.initPhysics();
    this.initLights();
    this.setupPlayer();
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

  protected abstract setupPlayer(): void;

  // Unified body creation (DRY replacement for createCube/createBox)
  protected createBody(
    size: { x: number; y: number; z: number },
    mass: number,
    pos: THREE.Vector3,
    color: number | THREE.Color,
  ): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const material = new THREE.MeshPhongMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(pos);
    this.scene.add(mesh);

    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));

    const motionState = new Ammo.btDefaultMotionState(transform);
    const colShape = new Ammo.btBoxShape(
      new Ammo.btVector3(size.x * 0.5, size.y * 0.5, size.z * 0.5),
    );
    const localInertia = new Ammo.btVector3(0, 0, 0);
    if (mass > 0) colShape.calculateLocalInertia(mass, localInertia);

    const rbInfo = new Ammo.btRigidBodyConstructionInfo(
      mass,
      motionState,
      colShape,
      localInertia,
    );
    const body = new Ammo.btRigidBody(rbInfo);
    this.physicsWorld.addRigidBody(body);

    mesh.userData.physicsBody = body;
    if (mass > 0) this.rigidBodies.push(mesh);
    return mesh;
  }

  // Backwards compatibility helpers (retain old names if referenced elsewhere)
  protected createCube(
    size: number,
    mass: number,
    pos: THREE.Vector3,
    color: number,
  ): THREE.Mesh {
    return this.createBody({ x: size, y: size, z: size }, mass, pos, color);
  }
  protected createBox(
    width: number,
    height: number,
    depth: number,
    mass: number,
    pos: THREE.Vector3,
    color: number,
  ): THREE.Mesh {
    return this.createBody({ x: width, y: height, z: depth }, mass, pos, color);
  }

  protected updateCameraLook() {
    const rotationSpeed = 0.002;
    this.camera.rotation.y -= this.inputManager.mouseDelta.x * rotationSpeed;
    this.camera.rotation.x -= this.inputManager.mouseDelta.y * rotationSpeed;
    this.camera.rotation.x = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, this.camera.rotation.x),
    );
    this.inputManager.mouseDelta.set(0, 0);
  }

  protected handlePlayerMovement() {
    if (!this.playerBody) return;

    const direction = new THREE.Vector3();
    const { keys } = this.inputManager;

    if (keys["w"] || keys["ArrowUp"]) direction.z -= 1;
    if (keys["s"] || keys["ArrowDown"]) direction.z += 1;
    if (keys["a"] || keys["ArrowLeft"]) direction.x -= 1;
    if (keys["d"] || keys["ArrowRight"]) direction.x += 1;

    direction.normalize();

    const cameraDir = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDir);
    cameraDir.y = 0;
    cameraDir.normalize();

    const right = new THREE.Vector3().crossVectors(
      new THREE.Vector3(0, 1, 0),
      cameraDir,
    );
    const moveVector = new THREE.Vector3()
      .addScaledVector(cameraDir, -direction.z)
      .addScaledVector(right, -direction.x);

    const impulse = new Ammo.btVector3(
      moveVector.x * this.PLAYER_SPEED,
      0,
      moveVector.z * this.PLAYER_SPEED,
    );
    this.playerBody.applyCentralImpulse(impulse);

    const ms = this.playerBody.getMotionState();
    if (ms) {
      ms.getWorldTransform(this.tmpTrans);
      const p = this.tmpTrans.getOrigin();
      this.camera.position.set(p.x(), p.y() + 0.5, p.z());
    }
  }

  public update() {
    const deltaTime = this.clock.getDelta();
    this.updateCameraLook();
    this.handlePlayerMovement();

    this.physicsWorld.stepSimulation(Math.min(deltaTime, 0.1), 10, 1 / 60);

    for (const objThree of this.rigidBodies) {
      const objPhys = objThree.userData.physicsBody as Ammo.btRigidBody;
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

  public dispose() {
    this.inputManager.dispose();
    // Physics cleanup would go here
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }
  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }
}
