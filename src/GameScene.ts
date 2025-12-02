/// <reference types="./types/ammo-js.d.ts" />
import * as THREE from "three";
import { InputManager } from "./inputManager.ts";
import { PlayerController } from "./playerController.ts";

export abstract class GameScene {
  protected scene: THREE.Scene;
  protected camera: THREE.PerspectiveCamera;
  protected physicsWorld!: Ammo.btDiscreteDynamicsWorld;
  protected clock: THREE.Clock;
  protected inputManager: InputManager;
  protected playerController?: PlayerController;

  protected rigidBodies: THREE.Mesh[] = [];
  protected tmpTrans: Ammo.btTransform;

  protected playerBody!: Ammo.btRigidBody;
  protected playerMesh!: THREE.Mesh;
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

  protected initPlayerController() {
    if (this.playerBody) {
      this.playerController = new PlayerController(
        this.camera,
        this.playerBody,
        this.inputManager,
      );
    }
  }

  public update() {
    const deltaTime = this.clock.getDelta();
    if (this.playerController) this.playerController.update();

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

/* example for refactor
/// <reference types="./types/ammo-js.d.ts" />
import * as THREE from "three";
import { InputManager } from "./inputManager";

export abstract class GameScene {
  protected scene: THREE.Scene;
  protected camera: THREE.PerspectiveCamera;
  protected physicsWorld!: Ammo.btDiscreteDynamicsWorld;
  protected clock: THREE.Clock;
  protected inputManager: InputManager;

  protected rigidBodies: { mesh: THREE.Mesh; body: Ammo.btRigidBody }[] = [];
  protected tmpTrans: Ammo.btTransform;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, globalThis.innerWidth / globalThis.innerHeight, 0.1, 1000);
    this.clock = new THREE.Clock();
    this.inputManager = new InputManager();
    this.tmpTrans = new Ammo.btTransform();

    this.initPhysics();
    this.initLights();
    this.setupLevel(); // Renamed from setupPlayer to be more generic
  }

  private initPhysics() {
    const config = new Ammo.btDefaultCollisionConfiguration();
    const dispatcher = new Ammo.btCollisionDispatcher(config);
    const broadphase = new Ammo.btDbvtBroadphase();
    const solver = new Ammo.btSequentialImpulseConstraintSolver();

    this.physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, config);
    this.physicsWorld.setGravity(new Ammo.btVector3(0, -9.82, 0));
  }

  private initLights() {
    const ambient = new THREE.AmbientLight(0x404040);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 10, 10);
    this.scene.add(ambient, dirLight);
  }

  protected abstract setupLevel(): void;

  protected createBody(
    size: THREE.Vector3Like,
    mass: number,
    pos: THREE.Vector3,
    color: THREE.ColorRepresentation
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
    const colShape = new Ammo.btBoxShape(new Ammo.btVector3(size.x * 0.5, size.y * 0.5, size.z * 0.5));
    const localInertia = new Ammo.btVector3(0, 0, 0);

    if (mass > 0) colShape.calculateLocalInertia(mass, localInertia);

    const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, colShape, localInertia);
    const body = new Ammo.btRigidBody(rbInfo);

    this.physicsWorld.addRigidBody(body);

    // Store strong reference linkage
    mesh.userData.physicsBody = body;
    if (mass > 0) {
      this.rigidBodies.push({ mesh, body });
    }

    return mesh;
  }

  public update() {
    const deltaTime = this.clock.getDelta();

    // Physics Step
    this.physicsWorld.stepSimulation(Math.min(deltaTime, 0.1), 10, 1 / 60);

    // Sync Visuals to Physics
    for (const item of this.rigidBodies) {
      const ms = item.body.getMotionState();
      if (ms) {
        ms.getWorldTransform(this.tmpTrans);
        const p = this.tmpTrans.getOrigin();
        const q = this.tmpTrans.getRotation();
        item.mesh.position.set(p.x(), p.y(), p.z());
        item.mesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
      }
    }
  }

  public dispose() {
    this.inputManager.dispose();
    // In a real app, strict explicit disposal of Ammo objects is needed here to prevent WASM leaks
  }

  public getScene = () => this.scene;
  public getCamera = () => this.camera;
}
*/
