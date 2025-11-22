// Allow a small number of `any` uses for Ammo.js interop
// deno-lint-ignore-file no-explicit-any
import * as THREE from "three";
import AmmoPromise from "./ammoLoader.ts";
import "./style.css";

// Small physics game:
// - Press Space to spawn a cube above the button
// - Drop cube onto the button; when button is contacted the door opens

const canvas = document.createElement("canvas");
canvas.id = "three-canvas";
document.body.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x20232a);

const camera = new THREE.PerspectiveCamera(
  60,
  globalThis.innerWidth / globalThis.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 2, 5);

const light = new THREE.DirectionalLight(0xffffff, 1.2);
light.position.set(5, 10, 7.5);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040, 0.8));

function onWindowResize() {
  camera.aspect = globalThis.innerWidth / globalThis.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
}
globalThis.addEventListener("resize", onWindowResize, false);

// Simple UI
const info = document.createElement("div");
info.style.position = "absolute";
info.style.left = "12px";
info.style.top = "12px";
info.style.color = "#ddd";
info.style.fontFamily = "monospace";
info.innerHTML =
  "Press <b>Space</b> to spawn a cube. Drop it on the red button to open the door.";
document.body.appendChild(info);

// Small status readout so we don't rely only on the browser console
const status = document.createElement("div");
status.style.position = "absolute";
status.style.left = "12px";
status.style.top = "44px";
status.style.color = "#ddd";
status.style.fontFamily = "monospace";
status.innerText = "Button: unknown";
document.body.appendChild(status);

// Physics state holders
let Ammo: any = null;
let physicsWorld: any = null;
const rigidBodies: Array<{ mesh: THREE.Mesh; body: any }> = [];

let buttonBody: any = null;
let buttonMesh: THREE.Mesh | null = null;
let doorMesh: THREE.Mesh | null = null;
let doorBody: any = null;
let doorOpen = false;
let groundMesh: THREE.Mesh | null = null;
let _lastButtonPressed = false;
let initialDoorColor: THREE.Color | null = null;

// Raycasting and camera orbit state
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const cameraTarget = new THREE.Vector3(0, 0.5, 0);
let orbitRadius = 6;
let orbitTheta = 0; // azimuth
let orbitPhi = Math.PI / 4; // polar
let isRightMouseDown = false;
const lastPointer = { x: 0, y: 0 };

AmmoPromise
  .then((AmmoModule: unknown) => {
    Ammo = AmmoModule;
    initPhysics();
    createSceneObjects();
    // compute initial orbit spherical coords from camera
    const v = new THREE.Vector3();
    v.copy(camera.position).sub(cameraTarget);
    orbitRadius = v.length();
    orbitTheta = Math.atan2(v.x, v.z);
    orbitPhi = Math.acos((v.y) / orbitRadius);

    animate();
  })
  .catch((err: unknown) => {
    console.error("Failed to initialize Ammo:", err);
  });

function initPhysics() {
  const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
  const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
  const broadphase = new Ammo.btDbvtBroadphase();
  const solver = new Ammo.btSequentialImpulseConstraintSolver();
  physicsWorld = new Ammo.btDiscreteDynamicsWorld(
    dispatcher,
    broadphase,
    solver,
    collisionConfiguration,
  );
  physicsWorld.setGravity(new Ammo.btVector3(0, -9.82, 0));
}

function createRigidBody(mesh: THREE.Mesh, shape: any, mass = 0) {
  const transform = new Ammo.btTransform();
  transform.setIdentity();
  const pos = mesh.position;
  transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
  const quat = mesh.quaternion;
  transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
  const motionState = new Ammo.btDefaultMotionState(transform);

  const localInertia = new Ammo.btVector3(0, 0, 0);
  if (mass > 0) shape.calculateLocalInertia(mass, localInertia);

  const rbInfo = new Ammo.btRigidBodyConstructionInfo(
    mass,
    motionState,
    shape,
    localInertia,
  );
  const body = new Ammo.btRigidBody(rbInfo);

  physicsWorld.addRigidBody(body);

  if (mass > 0) {
    rigidBodies.push({ mesh, body });
  }

  return body;
}

function createSceneObjects() {
  // Ground
  const groundGeo = new THREE.BoxGeometry(10, 1, 10);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x556655 });
  const groundMeshLocal = new THREE.Mesh(groundGeo, groundMat);
  groundMeshLocal.position.set(0, -0.5, 0);
  scene.add(groundMeshLocal);
  groundMesh = groundMeshLocal;

  const groundShape = new Ammo.btBoxShape(new Ammo.btVector3(5, 0.5, 5));
  createRigidBody(groundMeshLocal, groundShape, 0);

  // Button (static physics body, visual will move when pressed)
  const btnGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 24);
  const btnMat = new THREE.MeshStandardMaterial({ color: 0xaa3333 });
  buttonMesh = new THREE.Mesh(btnGeo, btnMat);
  buttonMesh.position.set(0, 0.1, 0);
  scene.add(buttonMesh);

  const btnShape = new Ammo.btCylinderShape(new Ammo.btVector3(0.4, 0.1, 0.4));
  // static body: mass = 0 (we'll animate the visual only on contact)
  buttonBody = createRigidBody(buttonMesh, btnShape, 0);

  // Door (a vertical box that blocks passage)
  const doorGeo = new THREE.BoxGeometry(0.2, 2, 2);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x3333aa });
  doorMesh = new THREE.Mesh(doorGeo, doorMat);
  doorMesh.position.set(1.5, 1, 0); // place to the right of button
  scene.add(doorMesh);
  // store initial color for debug visual
  initialDoorColor = doorMat.color.clone();

  const doorShape = new Ammo.btBoxShape(new Ammo.btVector3(0.1, 1, 1));
  // door as static body initially
  doorBody = createRigidBody(doorMesh, doorShape, 0);

  // Add a simple back wall for visuals
  const wallGeo = new THREE.BoxGeometry(6, 2.5, 0.2);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
  const backWall = new THREE.Mesh(wallGeo, wallMat);
  backWall.position.set(0, 1, -2);
  scene.add(backWall);

  // Place camera to see scene
  camera.position.set(0, 2, 6);
  camera.lookAt(0, 0.5, 0);

  // Basic ground grid
  const grid = new THREE.GridHelper(10, 10, 0x222222, 0x222222);
  scene.add(grid);
}

function spawnCube(pos?: THREE.Vector3) {
  if (!Ammo) return;
  const size = 0.4;
  const geo = new THREE.BoxGeometry(size, size, size);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffcc00 });
  const mesh = new THREE.Mesh(geo, mat);
  // spawn at provided position or above button
  if (pos) mesh.position.copy(pos);
  else mesh.position.set(0, 3, 0);
  scene.add(mesh);

  const shape = new Ammo.btBoxShape(
    new Ammo.btVector3(size / 2, size / 2, size / 2),
  );
  const body = createRigidBody(mesh, shape, 1);
  // give a little initial random rotation/impulse
  body.setLinearVelocity(
    new Ammo.btVector3(
      (Math.random() - 0.5) * 0.4,
      0,
      (Math.random() - 0.5) * 0.4,
    ),
  );
}

// Detect contact between button body and any dynamic body
function checkButtonContact() {
  const dispatcher = physicsWorld.getDispatcher();
  const numManifolds = dispatcher.getNumManifolds();
  for (let i = 0; i < numManifolds; i++) {
    const manifold = dispatcher.getManifoldByIndexInternal(i);
    const body0 = manifold.getBody0();
    const body1 = manifold.getBody1();

    // check if either body matches buttonBody
    if (body0 === buttonBody || body1 === buttonBody) {
      const numContacts = manifold.getNumContacts();
      for (let j = 0; j < numContacts; j++) {
        const pt = manifold.getContactPoint(j);
        const dist = pt.getDistance();
        // negative distance means penetration/contact
        if (dist < 0) {
          return true;
        }
      }
    }
  }
  return false;
}

// Animate door opening (visual). When opening, remove door body so it no longer collides.
function openDoor() {
  if (doorOpen || !doorMesh) return;
  doorOpen = true;
  // remove physics body to allow objects through
  if (doorBody) {
    physicsWorld.removeRigidBody(doorBody);
    doorBody = null;
  }

  // animate rotation over 0.9s
  const duration = 0.9;
  const start = performance.now();
  const initialRot = doorMesh.rotation.y;
  const targetRot = initialRot + Math.PI / 2; // swing 90 degrees

  function step() {
    const t = Math.min(1, (performance.now() - start) / (duration * 1000));
    doorMesh!.rotation.y = initialRot +
      (targetRot - initialRot) * easeOutCubic(t);
    if (t < 1) requestAnimationFrame(step);
  }
  step();
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

// Sync physics -> graphics for dynamic bodies
function syncPhysics(_dtSec: number) {
  const numObjects = rigidBodies.length;
  for (let i = 0; i < numObjects; i++) {
    const obj = rigidBodies[i];
    const ms = obj.body.getMotionState();
    if (ms) {
      const tmpTrans = new Ammo.btTransform();
      ms.getWorldTransform(tmpTrans);
      const p = tmpTrans.getOrigin();
      const q = tmpTrans.getRotation();
      obj.mesh.position.set(p.x(), p.y(), p.z());
      obj.mesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
    }
  }
}

let lastTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const delta = (now - lastTime) / 1000;
  lastTime = now;

  if (physicsWorld) {
    physicsWorld.stepSimulation(delta, 10);
    syncPhysics(delta);

    const pressed = checkButtonContact();
    if (pressed) {
      // move button visually down
      if (buttonMesh) buttonMesh.position.y = 0.02;
      if (!_lastButtonPressed) console.log("button pressed (contact detected)");
      // visual immediate feedback: change door color while pressed
      if (doorMesh && initialDoorColor) {
        (doorMesh.material as THREE.MeshStandardMaterial).color.set(0x55ff55);
      }
      status.innerText = "Button: PRESSED";
      openDoor();
    } else {
      if (buttonMesh) buttonMesh.position.y = 0.1;
      if (_lastButtonPressed) console.log("button released (no contact)");
      // restore door color when not pressed (unless door already opened)
      if (doorMesh && initialDoorColor && !doorOpen) {
        (doorMesh.material as THREE.MeshStandardMaterial).color.copy(
          initialDoorColor,
        );
      }
      status.innerText = doorOpen ? "Door: OPEN" : "Button: RELEASED";
    }
    _lastButtonPressed = pressed;
  }

  renderer.render(scene, camera);
}

// Input
globalThis.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    spawnCube();
  }
});

// Camera orbit and mouse placement
function updateCameraFromSpherical() {
  const sinPhi = Math.sin(orbitPhi);
  const x = orbitRadius * sinPhi * Math.sin(orbitTheta);
  const y = orbitRadius * Math.cos(orbitPhi);
  const z = orbitRadius * sinPhi * Math.cos(orbitTheta);
  camera.position.set(
    x + cameraTarget.x,
    y + cameraTarget.y,
    z + cameraTarget.z,
  );
  camera.lookAt(cameraTarget);
}

// prevent default context menu on right click
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener("pointerdown", (e: PointerEvent) => {
  // capture pointer so we continue to get events while dragging
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  canvas.setPointerCapture(e.pointerId);
  lastPointer.x = e.clientX;
  lastPointer.y = e.clientY;
  if (e.button === 2) {
    isRightMouseDown = true;
    return;
  }

  // left button: place a cube where the mouse points (on the ground if possible)
  if (e.button === 0) {
    mouse.x = (e.clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(e.clientY / renderer.domElement.clientHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    let intersects: THREE.Intersection[] = [];
    if (groundMesh) intersects = raycaster.intersectObject(groundMesh, false);

    if (intersects.length > 0) {
      const p = intersects[0].point.clone();
      // spawn the cube a bit above the hit point so it will drop onto the surface
      p.y += 2.0;
      spawnCube(p);
    } else {
      // fallback: spawn a few units in front of the camera
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const p = camera.position.clone().add(dir.multiplyScalar(3));
      spawnCube(p);
    }
  }
});

canvas.addEventListener("pointermove", (e: PointerEvent) => {
  if (!isRightMouseDown) return;
  const dx = e.clientX - lastPointer.x;
  const dy = e.clientY - lastPointer.y;
  lastPointer.x = e.clientX;
  lastPointer.y = e.clientY;
  const sensitivity = 0.005;
  orbitTheta -= dx * sensitivity;
  orbitPhi -= dy * sensitivity;
  orbitPhi = Math.max(0.1, Math.min(Math.PI - 0.1, orbitPhi));
  updateCameraFromSpherical();
});

canvas.addEventListener("pointerup", (e: PointerEvent) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  canvas.releasePointerCapture(e.pointerId);
  if (e.button === 2) isRightMouseDown = false;
});

// also listen for up outside the canvas
globalThis.addEventListener("pointerup", (e: PointerEvent) => {
  if (e.button === 2) isRightMouseDown = false;
});
