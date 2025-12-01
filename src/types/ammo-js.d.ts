declare global {
  function Ammo(): Promise<typeof Ammo>;
  namespace Ammo {
    class btTransform {
      setIdentity(): void;
      setOrigin(origin: btVector3): void;
      getOrigin(): btVector3;
      getRotation(): btQuaternion;
    }
    class btVector3 {
      constructor(x: number, y: number, z: number);
      x(): number;
      y(): number;
      z(): number;
    }
    class btQuaternion {
      x(): number;
      y(): number;
      z(): number;
      w(): number;
    }
    class btDefaultCollisionConfiguration {}
    class btCollisionDispatcher {
      constructor(config: btDefaultCollisionConfiguration);
    }
    class btDbvtBroadphase {}
    class btSequentialImpulseConstraintSolver {}
    class btDiscreteDynamicsWorld {
      constructor(
        dispatcher: btCollisionDispatcher,
        broadphase: btDbvtBroadphase,
        solver: btSequentialImpulseConstraintSolver,
        config: btDefaultCollisionConfiguration,
      );
      setGravity(gravity: btVector3): void;
      addRigidBody(body: btRigidBody): void;
      stepSimulation(deltaTime: number, maxSubSteps: number): void;
    }
    class btDefaultMotionState {
      constructor(transform: btTransform);
      getWorldTransform(transform: btTransform): void;
    }
    class btBoxShape {
      constructor(halfExtents: btVector3);
      calculateLocalInertia(mass: number, inertia: btVector3): void;
    }
    class btRigidBodyConstructionInfo {
      constructor(
        mass: number,
        motionState: btDefaultMotionState,
        shape: btBoxShape,
        localInertia: btVector3,
      );
    }
    class btRigidBody {
      constructor(info: btRigidBodyConstructionInfo);
      getMotionState(): btDefaultMotionState | null;
    }
  }
}
export {};
