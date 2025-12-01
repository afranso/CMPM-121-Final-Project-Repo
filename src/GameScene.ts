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

  public update() {
    const deltaTime = this.clock.getDelta();

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
