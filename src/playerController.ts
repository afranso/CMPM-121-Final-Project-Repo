import * as THREE from "three";
import { InputManager } from "./inputManager.ts";

export class PlayerController {
  private camera: THREE.Camera;
  private input: InputManager;
  private body: Ammo.btRigidBody;
  private tmpTrans = new Ammo.btTransform();

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
    const delta = this.input.getMouseDelta();
    if (delta.lengthSq() > 0) {
      this.camera.rotation.y -= delta.x * this.ROTATION_SPEED;
      this.camera.rotation.x -= delta.y * this.ROTATION_SPEED;

      // Clamp vertical look
      this.camera.rotation.x = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, this.camera.rotation.x),
      );
    }
  }

  private handleMovement() {
    // Calculate direction based on Camera Y rotation
    const moveZ = this.input.getAxis("s", "w") ||
      this.input.getAxis("ArrowDown", "ArrowUp");
    const moveX = this.input.getAxis("d", "a") ||
      this.input.getAxis("ArrowRight", "ArrowLeft");

    if (moveZ === 0 && moveX === 0) return;

    // Get forward vector projected on XZ plane
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      this.camera.quaternion,
    );
    forward.y = 0;
    forward.normalize();

    // Compute camera-right correctly: forward × up
    const right = new THREE.Vector3().crossVectors(
      forward,
      new THREE.Vector3(0, 1, 0),
    ).normalize();

    const moveDir = new THREE.Vector3()
      .addScaledVector(forward, -moveZ)
      .addScaledVector(right, moveX)
      .normalize();

    const currentVel = this.body.getLinearVelocity();

    // Set velocity directly for snappier FPS controls, preserving Y (gravity)
    this.body.setLinearVelocity(
      new Ammo.btVector3(
        moveDir.x * this.SPEED,
        currentVel.y(),
        moveDir.z * this.SPEED,
      ),
    );

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
}
