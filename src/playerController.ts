import * as THREE from "three";
import { InputManager } from "./inputManager.ts";

export class PlayerController {
  private camera: THREE.Camera;
  private input: InputManager;
  private body: Ammo.btRigidBody;
  private tmpTrans = new Ammo.btTransform();
  // Reusable Ammo vector to avoid per-frame allocations
  private tmpAmmoVec = new Ammo.btVector3(0, 0, 0);
  // Reusable THREE vectors
  private forward = new THREE.Vector3();
  private right = new THREE.Vector3();
  private moveDir = new THREE.Vector3();

  private readonly SPEED = 5;
  private readonly ROTATION_SPEED = 0.002;

  constructor(
    camera: THREE.Camera,
    body: Ammo.btRigidBody,
    input: InputManager,
  ) {
    this.camera = camera;
    this.body = body;
    this.input = input;

    // Lock rotation on physics body so it doesn't tip over
    this.body.setAngularFactor(new Ammo.btVector3(0, 0, 0));
  }

  public update() {
    this.handleRotation();
    this.handleMovement();
    this.syncCameraToBody();
  }

  private handleRotation() {
    const delta = this.input.getLookDelta();
    if (delta.lengthSq() > 0) {
      // Horizontal swipe rotates the camera left/right
      this.camera.rotation.y -= delta.x * this.ROTATION_SPEED;

      // Vertical swipe pans the camera up/down (move position, not rotation)
      this.camera.position.y += delta.y * 0.01;
    }
  }

  private handleMovement() {
    // Calculate direction based on camera Y rotation
    const moveVec = this.input.getMovementVector();
    const moveX = moveVec.x;
    const moveZ = -moveVec.y; // invert to align with existing forward sign
    const moveStrength = Math.min(1, moveVec.length());

    if (moveStrength < 0.05) {
      const v = this.body.getLinearVelocity();
      const dampFactor = 0.1; // stronger horizontal stop
      const tmp = this.tmpAmmoVec as unknown as {
        setValue?: (x: number, y: number, z: number) => void;
        setX?: (x: number) => void;
        setY?: (y: number) => void;
        setZ?: (z: number) => void;
      };
      if (tmp.setValue) {
        tmp.setValue(v.x() * dampFactor, v.y(), v.z() * dampFactor);
      } else {
        tmp.setX && tmp.setX(v.x() * dampFactor);
        tmp.setY && tmp.setY(v.y());
        tmp.setZ && tmp.setZ(v.z() * dampFactor);
      }
      this.body.setLinearVelocity(this.tmpAmmoVec);
      const anyBody = this.body as unknown as {
        activate?: (force?: boolean) => void;
      };
      if (anyBody.activate) anyBody.activate(true);
      return;
    }

    // Get forward vector projected on XZ plane
    this.forward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.forward.y = 0;
    this.forward.normalize();

    this.right.crossVectors(this.forward, new THREE.Vector3(0, 1, 0))
      .normalize();

    this.moveDir.set(0, 0, 0)
      .addScaledVector(this.forward, -moveZ)
      .addScaledVector(this.right, moveX)
      .normalize()
      .multiplyScalar(moveStrength);

    const currentVel = this.body.getLinearVelocity();

    // Set velocity directly for snappier FPS controls, preserving Y (gravity)
    const tmp = this.tmpAmmoVec as unknown as {
      setValue?: (x: number, y: number, z: number) => void;
      setX?: (x: number) => void;
      setY?: (y: number) => void;
      setZ?: (z: number) => void;
    };
    if (tmp.setValue) {
      tmp.setValue(
        this.moveDir.x * this.SPEED,
        currentVel.y(),
        this.moveDir.z * this.SPEED,
      );
    } else {
      tmp.setX && tmp.setX(this.moveDir.x * this.SPEED);
      tmp.setY && tmp.setY(currentVel.y());
      tmp.setZ && tmp.setZ(this.moveDir.z * this.SPEED);
    }
    this.body.setLinearVelocity(this.tmpAmmoVec);

    // Force activation so physics engine doesn't sleep the player (typings-safe)
    const anyBody = this.body as unknown as {
      activate?: (force?: boolean) => void;
    };
    if (anyBody.activate) anyBody.activate(true);
  }

  private syncCameraToBody() {
    const ms = this.body.getMotionState();
    if (ms) {
      ms.getWorldTransform(this.tmpTrans);
      const p = this.tmpTrans.getOrigin();
      this.camera.position.set(p.x(), p.y() + 0.5, p.z());
    }
  }

  // Optional explicit cleanup hook if upstream wants to release resources
  public dispose() {
    // Typings do not expose Ammo.destroy; relying on GC.
    // Place holder for future explicit WASM object destruction.
  }
}
