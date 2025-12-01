interface AmmoTransform {
  setIdentity(): void;
  setOrigin(origin: AmmoVector3): void;
  getOrigin(): AmmoVector3;
  getRotation(): AmmoQuaternion;
}

interface AmmoVector3 {
  x(): number;
  y(): number;
  z(): number;
}

interface AmmoQuaternion {
  x(): number;
  y(): number;
  z(): number;
  w(): number;
}

interface AmmoDefaultCollisionConfiguration {
  readonly _brand: "AmmoDefaultCollisionConfiguration";
}
interface AmmoCollisionDispatcher {
  readonly _brand: "AmmoCollisionDispatcher";
}
interface AmmoDbvtBroadphase {
  readonly _brand: "AmmoDbvtBroadphase";
}
interface AmmoSequentialImpulseConstraintSolver {
  readonly _brand: "AmmoSequentialImpulseConstraintSolver";
}

interface AmmoDiscreteDynamicsWorld {
  setGravity(gravity: AmmoVector3): void;
  addRigidBody(body: AmmoRigidBody): void;
  stepSimulation(
    deltaTime: number,
    maxSubSteps?: number,
    fixedTimeStep?: number,
  ): void;
}

interface AmmoDefaultMotionState {
  getWorldTransform(transform: AmmoTransform): void;
}

interface AmmoBoxShape {
  calculateLocalInertia(mass: number, inertia: AmmoVector3): void;
}

interface AmmoRigidBodyConstructionInfo {
  readonly _brand: "AmmoRigidBodyConstructionInfo";
}

interface AmmoRigidBody {
  getMotionState(): AmmoDefaultMotionState | null;
}

interface AmmoNamespace {
  btTransform: {
    new (): AmmoTransform;
  };
  btVector3: {
    new (x: number, y: number, z: number): AmmoVector3;
  };
  btQuaternion: AmmoQuaternion;
  btDefaultCollisionConfiguration: {
    new (): AmmoDefaultCollisionConfiguration;
  };
  btCollisionDispatcher: {
    new (config: AmmoDefaultCollisionConfiguration): AmmoCollisionDispatcher;
  };
  btDbvtBroadphase: {
    new (): AmmoDbvtBroadphase;
  };
  btSequentialImpulseConstraintSolver: {
    new (): AmmoSequentialImpulseConstraintSolver;
  };
  btDiscreteDynamicsWorld: {
    new (
      dispatcher: AmmoCollisionDispatcher,
      broadphase: AmmoDbvtBroadphase,
      solver: AmmoSequentialImpulseConstraintSolver,
      config: AmmoDefaultCollisionConfiguration,
    ): AmmoDiscreteDynamicsWorld;
  };
  btDefaultMotionState: {
    new (transform: AmmoTransform): AmmoDefaultMotionState;
  };
  btBoxShape: {
    new (halfExtents: AmmoVector3): AmmoBoxShape;
  };
  btRigidBodyConstructionInfo: {
    new (
      mass: number,
      motionState: AmmoDefaultMotionState,
      shape: AmmoBoxShape,
      localInertia: AmmoVector3,
    ): AmmoRigidBodyConstructionInfo;
  };
  btRigidBody: {
    new (info: AmmoRigidBodyConstructionInfo): AmmoRigidBody;
  };
}

declare module "ammo.js" {
  function AmmoFactory(): Promise<AmmoNamespace>;
  export default AmmoFactory;
}

declare global {
  // Make Ammo available as both a value and a namespace
  const Ammo: AmmoNamespace;

  namespace Ammo {
    // Export type aliases for use in type positions
    export type btTransform = AmmoTransform;
    export type btVector3 = AmmoVector3;
    export type btQuaternion = AmmoQuaternion;
    export type btDefaultCollisionConfiguration =
      AmmoDefaultCollisionConfiguration;
    export type btCollisionDispatcher = AmmoCollisionDispatcher;
    export type btDbvtBroadphase = AmmoDbvtBroadphase;
    export type btSequentialImpulseConstraintSolver =
      AmmoSequentialImpulseConstraintSolver;
    export type btDiscreteDynamicsWorld = AmmoDiscreteDynamicsWorld;
    export type btDefaultMotionState = AmmoDefaultMotionState;
    export type btBoxShape = AmmoBoxShape;
    export type btRigidBodyConstructionInfo = AmmoRigidBodyConstructionInfo;
    export type btRigidBody = AmmoRigidBody;
  }
}

export {};
