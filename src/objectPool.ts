import * as THREE from "three";

export interface PooledBlock {
  mesh: THREE.Mesh;
  body: Ammo.btRigidBody;
  inUse: boolean;
}

export class BlockPool {
  private blocks: PooledBlock[] = [];
  private tmpTransform: Ammo.btTransform = new Ammo.btTransform();
  private geometry = new THREE.BoxGeometry(1, 1, 1);

  constructor(
    private physicsWorld: Ammo.btDiscreteDynamicsWorld,
    private scene: THREE.Scene,
    poolSize = 20,
  ) {
    this.preallocate(poolSize);
  }

  private preallocate(count: number) {
    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshPhongMaterial({ color: 0xffffff });
      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.visible = false; // hidden until acquired
      this.scene.add(mesh);

      const transform = new Ammo.btTransform();
      transform.setIdentity();
      transform.setOrigin(new Ammo.btVector3(0, -1000, 0)); // park below world

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
      // Do not add to world until used

      mesh.userData.physicsBody = body;
      this.blocks.push({ mesh, body, inUse: false });
    }
  }

  acquire(
    position: THREE.Vector3,
    color: number | THREE.Color,
  ): PooledBlock | null {
    const block = this.blocks.find((b) => !b.inUse);
    if (!block) return null;

    block.inUse = true;
    (block.mesh.material as THREE.MeshPhongMaterial).color.set(color);
    block.mesh.position.copy(position);
    block.mesh.visible = true;

    // Reset physics state
    this.tmpTransform.setIdentity();
    this.tmpTransform.setOrigin(
      new Ammo.btVector3(position.x, position.y, position.z),
    );
    const body = block.body;
    body.setWorldTransform(this.tmpTransform);
    const _ms = body.getMotionState();
    // Typings only expose getWorldTransform; updating via body transform is sufficient.
    body.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
    body.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
    this.physicsWorld.addRigidBody(body);

    return block;
  }

  release(block: PooledBlock) {
    if (!block.inUse) return;
    block.inUse = false;
    this.physicsWorld.removeRigidBody(block.body);
    block.mesh.visible = false;
    // Park it far away
    block.mesh.position.set(0, -1000, 0);
  }

  // Clean up all pooled resources (called from higher-level dispose if needed)
  dispose() {
    for (const b of this.blocks) {
      if (b.inUse) this.physicsWorld.removeRigidBody(b.body);
      // Typings do not expose explicit destroy; rely on GC.
    }
    this.blocks.length = 0;
  }
}
