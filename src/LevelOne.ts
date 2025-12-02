import * as THREE from "three";
import { GameScene } from "./GameScene.ts";
import { UIManager } from "./UIManager.ts";

const CONSTANTS = {
  ROOM_WIDTH: 20,
  WALL_HEIGHT: 6,
  WALL_THICKNESS: 0.5,
  DOOR_Z: -9.75,
  KEY_POS: new THREE.Vector3(1.5, 0.2, -6),
  BUTTON_POS: new THREE.Vector3(0, 0.1, -6),
  COLORS: { WALL: 0x666666, FLOOR: 0x808080, BUTTON: 0xff4444, KEY: 0xffff00 },
};

export class LevelOne extends GameScene {
  private ui: UIManager;
  private raycaster = new THREE.Raycaster();
  private doorMesh!: THREE.Mesh;
  private button!: THREE.Mesh;
  private marker!: THREE.Mesh;
  private keyMesh!: THREE.Mesh;
  private chest!: THREE.Mesh;
  private bat!: THREE.Mesh;
  private inventory: string[] = [];
  private state = { doorOpened: false, chestOpened: false, wrongLandings: 0 };
  private blocks: Array<{ mesh: THREE.Mesh; handled: boolean }> = [];

  constructor() {
    super();
    this.ui = new UIManager();
    this.setupLevel();
    this.setupInteractions();
  }

  protected setupPlayer(): void {
    const startPos = new THREE.Vector3(0, 0.9, 5);
    this.playerMesh = this.createBody(
      { x: 1, y: 1.8, z: 1 },
      this.PLAYER_MASS,
      startPos,
      0x00ff00,
    );
    this.playerBody = this.playerMesh.userData.physicsBody as Ammo.btRigidBody;
    this.playerBody.setAngularFactor(new Ammo.btVector3(0, 1, 0));
    this.playerMesh.visible = false; // use camera as visual representation
    this.camera.position.set(startPos.x, startPos.y + 0.5, startPos.z);
    this.camera.lookAt(0, 1, 0);
  }

  private setupLevel() {
    this.createRoom(0);
    this.createRoom(-20);
    this.createDoor();
    this.createButton();
    this.createMarker();
    this.createKey();
    this.createChest();
    this.createBat();
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemi.position.set(0, 20, 0);
    this.scene.add(hemi);
  }

  private createRoom(zOffset: number) {
    this.createBody(
      { x: CONSTANTS.ROOM_WIDTH, y: 1, z: CONSTANTS.ROOM_WIDTH },
      0,
      new THREE.Vector3(0, -0.5, zOffset),
      CONSTANTS.COLORS.FLOOR,
    );
    const wallParams = [
      {
        dim: {
          x: CONSTANTS.ROOM_WIDTH,
          y: CONSTANTS.WALL_HEIGHT,
          z: CONSTANTS.WALL_THICKNESS,
        },
        pos: new THREE.Vector3(0, 3, zOffset - 10 + 0.25),
      },
      {
        dim: {
          x: CONSTANTS.WALL_THICKNESS,
          y: CONSTANTS.WALL_HEIGHT,
          z: CONSTANTS.ROOM_WIDTH,
        },
        pos: new THREE.Vector3(-10 + 0.25, 3, zOffset),
      },
      {
        dim: {
          x: CONSTANTS.WALL_THICKNESS,
          y: CONSTANTS.WALL_HEIGHT,
          z: CONSTANTS.ROOM_WIDTH,
        },
        pos: new THREE.Vector3(10 - 0.25, 3, zOffset),
      },
    ];
    if (zOffset === 0) {
      wallParams[0] = {
        dim: { x: 9, y: 6, z: 0.5 },
        pos: new THREE.Vector3(-5.5, 3, CONSTANTS.DOOR_Z),
      };
      wallParams.push({
        dim: { x: 9, y: 6, z: 0.5 },
        pos: new THREE.Vector3(5.5, 3, CONSTANTS.DOOR_Z),
      });
    }
    wallParams.forEach((p) =>
      this.createBody(p.dim, 0, p.pos, CONSTANTS.COLORS.WALL)
    );
  }

  private createDoor() {
    this.doorMesh = this.createBody(
      { x: 2, y: 3, z: 0.2 },
      0,
      new THREE.Vector3(0, 1.5, CONSTANTS.DOOR_Z),
      0x552200,
    );
  }

  private openDoor() {
    if (this.state.doorOpened) return;
    this.state.doorOpened = true;
    if (this.doorMesh.userData.physicsBody) {
      this.physicsWorld.removeRigidBody(this.doorMesh.userData.physicsBody);
    }
    this.doorMesh.visible = false;
    this.ui.showMessage("Door Unlocked!");
  }

  private createButton() {
    this.button = this.createBody(
      { x: 1, y: 0.2, z: 1 },
      0,
      CONSTANTS.BUTTON_POS,
      CONSTANTS.COLORS.BUTTON,
    );
  }

  private createMarker() {
    this.marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.1),
      new THREE.MeshStandardMaterial({ color: 0xffff00 }),
    );
    this.scene.add(this.marker);
  }

  private createKey() {
    this.keyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.2),
      new THREE.MeshStandardMaterial({ color: CONSTANTS.COLORS.KEY }),
    );
    this.keyMesh.position.copy(CONSTANTS.KEY_POS);
    this.keyMesh.visible = false;
    this.scene.add(this.keyMesh);
  }

  private createChest() {
    this.chest = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.5, 1),
      new THREE.MeshStandardMaterial({ color: 0x8B4513 }),
    );
    this.chest.position.set(0, 0.25, -15);
    this.scene.add(this.chest);
  }

  private createBat() {
    this.bat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 2),
      new THREE.MeshStandardMaterial({ color: 0x964B00 }),
    );
    this.bat.position.set(0, 1, -15);
    this.bat.visible = false;
    this.scene.add(this.bat);
  }

  private setupInteractions() {
    globalThis.addEventListener("pointermove", (e) => {
      const coords = this.inputManager.getNormalizedMouseCoordinates(
        e.clientX,
        e.clientY,
      );
      this.raycastUpdateMarker(coords);
    });
    globalThis.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const coords = this.inputManager.getNormalizedMouseCoordinates(
        e.clientX,
        e.clientY,
      );
      this.handleLeftClick(coords);
    });
  }

  private raycastUpdateMarker(coords: THREE.Vector2) {
    this.raycaster.setFromCamera(coords, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children);
    if (intersects.length > 0) {
      this.marker.position.copy(intersects[0].point).add(
        new THREE.Vector3(0, 0.05, 0),
      );
    }
  }

  private handleLeftClick(coords: THREE.Vector2) {
    this.raycaster.setFromCamera(coords, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children);
    if (intersects.length === 0) return;
    const hitObj = intersects[0].object;

    if (hitObj === this.keyMesh && this.keyMesh.visible) {
      this.keyMesh.visible = false;
      this.inventory.push("Key");
      this.ui.updateInventory(this.inventory);
      this.ui.showMessage("Picked up Key!");
      return;
    }

    if (hitObj === this.chest) {
      if (this.inventory.includes("Key")) {
        (this.chest.material as THREE.MeshStandardMaterial).color.set(0xD2B48C);
        this.bat.visible = true;
        this.state.chestOpened = true;
        this.ui.showMessage("Chest Opened!");
      } else {
        this.ui.showMessage("Locked. Needs Key.");
      }
      return;
    }

    if (hitObj === this.bat && this.bat.visible) {
      this.bat.visible = false;
      this.inventory.push("Bat");
      this.ui.updateInventory(this.inventory);
      this.ui.showMessage("Bat Equipped!");
      return;
    }

    this.spawnBlock(this.marker.position);
  }

  private spawnBlock(pos: THREE.Vector3) {
    if (this.camera.position.z < -10) {
      this.ui.showMessage("Cannot spawn here.");
      return;
    }
    const spawnPos = pos.clone().setY(5);
    const mesh = this.createBody(
      { x: 1, y: 1, z: 1 },
      1,
      spawnPos,
      Math.random() * 0xffffff,
    );
    const blockData = { mesh, handled: false };
    this.blocks.push(blockData);
    setTimeout(() => {
      this.scene.remove(mesh);
      this.blocks = this.blocks.filter((b) => b !== blockData);
    }, 6000);
  }

  public override update() {
    super.update();
    if (this.inputManager.keys["e"]) {
      this.inputManager.keys["e"] = false;
      this.tryOpenDoor();
    }
    this.checkBlockPuzzles();
  }

  private tryOpenDoor() {
    if (this.state.doorOpened) return;
    if (this.playerMesh.position.distanceTo(this.doorMesh.position) < 3) {
      if (this.inventory.includes("Key")) {
        this.openDoor();
      } else {
        this.ui.showMessage("Need Key!");
      }
    }
  }

  private checkBlockPuzzles() {
    this.blocks.forEach((b) => {
      if (b.handled) return;
      const body = b.mesh.userData.physicsBody as Ammo.btRigidBody;
      const vel = body.getLinearVelocity();
      if (Math.abs(vel.y()) < 0.1 && Math.abs(vel.x()) < 0.1) {
        b.handled = true;
        if (b.mesh.position.distanceTo(CONSTANTS.BUTTON_POS) < 1.0) {
          this.keyMesh.visible = true;
          this.ui.showMessage("Key Spawned!");
        } else {
          this.state.wrongLandings++;
          this.ui.showMessage(`Missed! (${this.state.wrongLandings}/3)`);
        }
      }
    });
  }

  private addDebugHelpers(): void {}
}
