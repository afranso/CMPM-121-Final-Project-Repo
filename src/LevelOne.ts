import * as THREE from "three";
import { GameScene } from "./GameScene.ts";
import { UIManager } from "./UIManager.ts";

const CONSTANTS = {
  ROOM_WIDTH: 20,
  WALL_HEIGHT: 6,
  WALL_THICKNESS: 0.5,
  // Move door/front wall slightly forward to avoid z-fighting with back wall
  DOOR_Z: -9.5,
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
  private state = {
    doorOpened: false,
    chestOpened: false,
    wrongLandings: 0,
    blockSpawningEnabled: true,
  };
  private blocks: Array<
    { mesh: THREE.Mesh; body: Ammo.btRigidBody; handled: boolean }
  > = [];

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

    // Initialize PlayerController now that playerBody is ready
    this.initPlayerController();
  }

  private setupLevel() {
    this.createRoom(0, true);
    this.createRoom(-20, false);
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

  private createRoom(zOffset: number, hasDoor: boolean) {
    // Floor
    this.createBody(
      { x: CONSTANTS.ROOM_WIDTH, y: 1, z: CONSTANTS.ROOM_WIDTH },
      0,
      new THREE.Vector3(0, -0.5, zOffset),
      CONSTANTS.COLORS.FLOOR,
    );

    const W = CONSTANTS.ROOM_WIDTH;
    const H = CONSTANTS.WALL_HEIGHT;
    const T = CONSTANTS.WALL_THICKNESS;

    // Back wall: keep for non-door rooms; remove in door room to allow passage
    if (!(hasDoor && zOffset === 0)) {
      this.createBody(
        { x: W, y: H, z: T },
        0,
        new THREE.Vector3(0, 3, zOffset - 10 + 0.25),
        CONSTANTS.COLORS.WALL,
      );
    }
    // Left wall
    this.createBody(
      { x: T, y: H, z: W },
      0,
      new THREE.Vector3(-10 + 0.25, 3, zOffset),
      CONSTANTS.COLORS.WALL,
    );
    // Right wall
    this.createBody(
      { x: T, y: H, z: W },
      0,
      new THREE.Vector3(10 - 0.25, 3, zOffset),
      CONSTANTS.COLORS.WALL,
    );

    if (hasDoor) {
      // Front wall segments around door + above door
      this.createBody(
        { x: 9, y: 6, z: 0.5 },
        0,
        new THREE.Vector3(-5.5, 3, CONSTANTS.DOOR_Z),
        CONSTANTS.COLORS.WALL,
      );
      this.createBody(
        { x: 9, y: 6, z: 0.5 },
        0,
        new THREE.Vector3(5.5, 3, CONSTANTS.DOOR_Z),
        CONSTANTS.COLORS.WALL,
      );
      this.createBody(
        { x: 2, y: 3, z: 0.5 },
        0,
        new THREE.Vector3(0, 4.5, CONSTANTS.DOOR_Z),
        CONSTANTS.COLORS.WALL,
      );
    }
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
    globalThis.addEventListener("pointermove", (_e) => {
      const coords = this.inputManager.getNormalizedMousePosition();
      this.raycastUpdateMarker(coords);
    });
    globalThis.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const coords = this.inputManager.getNormalizedMousePosition();
      this.handleLeftClick(coords);
    });
  }

  private raycastUpdateMarker(coords: THREE.Vector2) {
    this.raycaster.setFromCamera(coords, this.camera);
    // Exclude the marker itself from intersection results
    const objectsToIntersect = this.scene.children.filter((obj) =>
      obj !== this.marker
    );
    const intersects = this.raycaster.intersectObjects(objectsToIntersect);
    if (intersects.length > 0) {
      this.marker.position.copy(intersects[0].point).add(
        new THREE.Vector3(0, 0.05, 0),
      );
    }
  }

  private handleLeftClick(coords: THREE.Vector2) {
    this.raycaster.setFromCamera(coords, this.camera);
    // Only check visible objects for intersection
    const visibleObjects = this.scene.children.filter((obj) =>
      (obj as THREE.Mesh).visible !== false
    );
    const intersects = this.raycaster.intersectObjects(visibleObjects);
    if (intersects.length === 0) return;

    // Check if any intersected object is the key mesh
    const keyIntersect = intersects.find((i) => i.object === this.keyMesh);
    if (keyIntersect && this.keyMesh.visible) {
      this.keyMesh.visible = false;
      this.inventory.push("Key");
      this.ui.updateInventory(this.inventory);
      this.ui.showMessage("Picked up Key!");
      return;
    }

    // Check if any intersected object is the chest
    const chestIntersect = intersects.find((i) => i.object === this.chest);
    if (chestIntersect) {
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

    // Check if any intersected object is the bat
    const batIntersect = intersects.find((i) => i.object === this.bat);
    if (batIntersect && this.bat.visible) {
      this.bat.visible = false;
      this.inventory.push("Bat");
      this.ui.updateInventory(this.inventory);
      this.ui.showMessage("Bat Equipped!");
      return;
    }

    // Only allow block spawning if enabled
    if (this.state.blockSpawningEnabled) {
      this.spawnBlock(this.marker.position);
    }
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
    const body = mesh.userData.physicsBody as Ammo.btRigidBody;
    const blockData = { mesh, body, handled: false };
    this.blocks.push(blockData);
    setTimeout(() => {
      this.removeBlock(blockData);
    }, 6000);
  }

  private removeBlock(
    block: { mesh: THREE.Mesh; body: Ammo.btRigidBody; handled: boolean },
  ) {
    // Remove visual
    this.scene.remove(block.mesh);
    // Remove physics body from world and tracking arrays
    this.physicsWorld.removeRigidBody(block.body);
    // Remove from LevelOne blocks array
    this.blocks = this.blocks.filter((b) => b !== block);
    // Also remove from GameScene tracking arrays to avoid dangling references
    this.physicsObjects = this.physicsObjects.filter((po) =>
      po.mesh !== block.mesh
    );
    this.allBodies = this.allBodies.filter((po) => po.mesh !== block.mesh);
  }

  public override update() {
    super.update();
    if (this.inputManager.consumeKey("e")) {
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
      const vel = b.body.getLinearVelocity();
      if (Math.abs(vel.y()) < 0.1 && Math.abs(vel.x()) < 0.1) {
        b.handled = true;
        if (b.mesh.position.distanceTo(CONSTANTS.BUTTON_POS) < 1.0) {
          this.keyMesh.visible = true;
          this.state.blockSpawningEnabled = false;
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
