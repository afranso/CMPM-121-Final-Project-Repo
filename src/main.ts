// main.ts
// Prefer the local installed package instead of a remote CDN import so
// builds and type-checking don't require fetching esm.sh at check time.
// @deno-types="./types/three.d.ts"
import * as THREE from "three";
import "./style.css";

const canvas = document.createElement("canvas");
canvas.id = "three-canvas";
document.body.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2));
document.body.style.margin = "0";
document.body.style.overflow = "hidden";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

const camera = new THREE.PerspectiveCamera(
  60,
  globalThis.innerWidth / globalThis.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 4, 8);

// lights
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
hemi.position.set(0, 20, 0);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 10, 2);
scene.add(dir);

// --- Room (floor + walls) ---
const room = new THREE.Group();
scene.add(room);

// floor
const floorGeo = new THREE.PlaneGeometry(20, 20);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x808080 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotateX(-Math.PI / 2);
floor.position.y = 0;
room.add(floor);

// walls (simple)
const wallMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
const backWall = new THREE.Mesh(new THREE.BoxGeometry(20, 6, 0.5), wallMat);
backWall.position.set(0, 3, -10 + 0.25);
room.add(backWall);
const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 20), wallMat);
leftWall.position.set(-10 + 0.25, 3, 0);
room.add(leftWall);
const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 20), wallMat);
rightWall.position.set(10 - 0.25, 3, 0);
room.add(rightWall);

// --- Door (on the back wall) ---
// We'll create a pivot so we can rotate around the left edge (hinge)
const doorWidth = 2;
const doorHeight = 3;
const doorDepth = 0.2;
const doorPivot = new THREE.Group();
doorPivot.position.set(-doorWidth / 2 + 1, doorHeight / 2, -9 + 0.26); // hinge at left side
scene.add(doorPivot);

const doorMesh = new THREE.Mesh(
  new THREE.BoxGeometry(doorWidth, doorHeight, doorDepth),
  new THREE.MeshStandardMaterial({ color: 0x552200 }),
);
doorMesh.position.set(doorWidth / 2, 0, 0); // offset so pivot is on left edge
doorPivot.add(doorMesh);

let doorOpened = false;

// --- Button ---
// A flat button in front of the back wall; blocks must land on it to open the door.
const buttonSize = 1;
const button = new THREE.Mesh(
  new THREE.BoxGeometry(buttonSize, 0.2, buttonSize),
  new THREE.MeshStandardMaterial({ color: 0xff4444 }),
);
button.position.set(0, 0.1, -6); // slightly above the floor
scene.add(button);

// Visual highlight area (optional)
const buttonOutline = new THREE.LineSegments(
  new THREE.EdgesGeometry(
    new THREE.BoxGeometry(buttonSize + 0.1, 0.21, buttonSize + 0.1),
  ),
  new THREE.LineBasicMaterial({ color: 0x000000 }),
);
buttonOutline.position.copy(button.position);
scene.add(buttonOutline);

// --- Marker (dot under cursor) ---
const marker = new THREE.Mesh(
  new THREE.SphereGeometry(0.08, 8, 8),
  new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0x444400 }),
);
marker.visible = true;
scene.add(marker);

// Make marker sit at block half-height (we'll spawn blocks of size 1, half = 0.5)
const DROP_HEIGHT = 5; // spawn y above marker so it falls
const BLOCK_SIZE = 1;
marker.position.y = BLOCK_SIZE / 2; // on the floor plane by default

// --- Blocks state (simple per-block physics) ---
type BlockState = {
  mesh: THREE.Mesh;
  velY: number;
  onGround: boolean;
  hasLandedHandled: boolean; // to ensure landing logic runs once
};

const blocks: BlockState[] = [];
const gravity = -9.8;

// --- UI overlays ---
const overlay = document.createElement("div");
overlay.style.position = "fixed";
overlay.style.left = "0";
overlay.style.top = "0";
overlay.style.width = "100%";
overlay.style.height = "100%";
overlay.style.display = "flex";
overlay.style.alignItems = "center";
overlay.style.justifyContent = "center";
overlay.style.pointerEvents = "none";
overlay.style.zIndex = "10";
document.body.appendChild(overlay);

const message = document.createElement("div");
message.style.padding = "24px 36px";
message.style.background = "rgba(0,0,0,0.8)";
message.style.color = "white";
message.style.fontFamily = "sans-serif";
message.style.fontSize = "28px";
message.style.borderRadius = "8px";
message.style.display = "none";
overlay.appendChild(message);

function showMessage(text: string) {
  message.textContent = text;
  message.style.display = "block";
}
function hideMessage() {
  message.style.display = "none";
}

// --- Game state for failures / success ---
let wrongLandings = 0;
const MAX_WRONG = 3;

// Restart helper
function resetScene() {
  // remove blocks
  blocks.forEach((b) => scene.remove(b.mesh));
  blocks.length = 0;
  // close door
  doorPivot.rotation.y = 0;
  doorOpened = false;
  wrongLandings = 0;
  hideMessage();
}

// Open door (animate)
let doorOpenAnim = 0; // 0 .. 1 progress while opening
function startOpenDoor() {
  if (doorOpened) return;
  doorOpened = true;
  doorOpenAnim = 0;
}

// --- Raycasting / pointer handling ---
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function updateMarkerFromPointer(clientX: number, clientY: number) {
  pointer.x = (clientX / globalThis.innerWidth) * 2 - 1;
  pointer.y = -(clientY / globalThis.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  // plane at y = BLOCK_SIZE/2 (so the block will sit on floor and marker is correct)
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BLOCK_SIZE / 2);
  const pos = new THREE.Vector3();
  const intersect = raycaster.ray.intersectPlane(plane, pos);
  if (intersect) {
    marker.position.set(pos.x, BLOCK_SIZE / 2, pos.z);
  } else {
    // If ray doesn't hit (rare), keep it in front of camera at some distance
    const fallback = raycaster.ray.origin.clone().add(
      raycaster.ray.direction.clone().multiplyScalar(6),
    );
    marker.position.set(fallback.x, BLOCK_SIZE / 2, fallback.z);
  }
}

globalThis.addEventListener("pointermove", (e: PointerEvent) => {
  updateMarkerFromPointer(e.clientX, e.clientY);
});

// Click to spawn block at marker
globalThis.addEventListener("pointerdown", (e: PointerEvent) => {
  // ensure marker is up to date to use exact click position
  updateMarkerFromPointer(e.clientX, e.clientY);

  // create block
  const boxGeo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
  const boxMat = new THREE.MeshStandardMaterial({
    color: Math.random() * 0xffffff,
  });
  const blockMesh = new THREE.Mesh(boxGeo, boxMat);

  const spawnPos = marker.position.clone();
  blockMesh.position.set(spawnPos.x, spawnPos.y + DROP_HEIGHT, spawnPos.z);
  scene.add(blockMesh);

  const blockState: BlockState = {
    mesh: blockMesh,
    velY: 0,
    onGround: false,
    hasLandedHandled: false,
  };
  blocks.push(blockState);

  // schedule despawn after some seconds if still present
  const DESPAWN_SECONDS = 6;
  setTimeout(() => {
    const idx = blocks.indexOf(blockState);
    if (idx !== -1) {
      scene.remove(blockState.mesh);
      blocks.splice(idx, 1);
    }
  }, DESPAWN_SECONDS * 1000);
});

// Resize
globalThis.addEventListener("resize", onWindowResize);
function onWindowResize() {
  camera.aspect = globalThis.innerWidth / globalThis.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
}

// --- Simple camera controls (orbit-ish with mouse drag) ---
let isRightDown = false;
let lastX = 0;
let lastY = 0;
globalThis.addEventListener("pointerdown", (e: PointerEvent) => {
  if (e.button === 2) {
    isRightDown = true;
    lastX = e.clientX;
    lastY = e.clientY;
    e.preventDefault();
  }
});
globalThis.addEventListener("pointerup", (e: PointerEvent) => {
  if (e.button === 2) isRightDown = false;
});
globalThis.addEventListener("pointermove", (e: PointerEvent) => {
  if (!isRightDown) return;
  const dx = (e.clientX - lastX) * 0.005;
  const dy = (e.clientY - lastY) * 0.005;
  lastX = e.clientX;
  lastY = e.clientY;

  // rotate camera around origin
  const offset = camera.position.clone();
  const spherical = new THREE.Spherical().setFromVector3(offset);
  spherical.theta -= dx;
  spherical.phi = Math.max(
    0.1,
    Math.min(Math.PI / 2 - 0.1, spherical.phi - dy),
  );
  offset.setFromSpherical(spherical);
  camera.position.copy(offset);
  camera.lookAt(0, 1, 0);
});

// prevent context menu on right click
globalThis.addEventListener("contextmenu", (e) => e.preventDefault());

// --- Animation loop / physics ---
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.032);

  // update block physics
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (!b.onGround) {
      b.velY += gravity * dt;
      b.mesh.position.y += b.velY * dt;
      // simple ground collision at y = BLOCK_SIZE/2
      if (b.mesh.position.y <= BLOCK_SIZE / 2) {
        b.mesh.position.y = BLOCK_SIZE / 2;
        b.velY = 0;
        b.onGround = true;
      }
    }

    // if just landed, handle landing logic once
    if (b.onGround && !b.hasLandedHandled) {
      b.hasLandedHandled = true;
      // check whether landed on button: check overlap in XZ with button bounds
      const bx = b.mesh.position.x;
      const bz = b.mesh.position.z;
      const btn = button.position;
      const half = buttonSize / 2 + (BLOCK_SIZE / 2) * 0.9; // tolerance
      const onButtonX = Math.abs(bx - btn.x) <= half;
      const onButtonZ = Math.abs(bz - btn.z) <= half;

      if (onButtonX && onButtonZ && !doorOpened) {
        // success! open door
        startOpenDoor();
      } else {
        // not on button (or button already used)
        if (!doorOpened) {
          wrongLandings++;
          if (wrongLandings >= MAX_WRONG) {
            showMessage("You failed. Restarting...");
            setTimeout(() => {
              resetScene();
            }, 3000);
          } else {
            // brief feedback
            showMessage(`Wrong spot (${wrongLandings}/${MAX_WRONG})`);
            setTimeout(hideMessage, 1000);
          }
        }
      }
    }
  }

  // door open animation (rotate pivot around Y negative direction to swing open)
  if (doorOpened && doorOpenAnim < 1) {
    doorOpenAnim = Math.min(1, doorOpenAnim + dt * 1.2); // speed
    // ease-out
    const t = 1 - Math.pow(1 - doorOpenAnim, 3);
    doorPivot.rotation.y = -Math.PI / 2 * t; // open 90 degrees
    if (doorOpenAnim >= 1) {
      // final victory state
      showMessage("Victory!");
    }
  }

  renderer.render(scene, camera);
}
animate();

// initial pointer marker position to center
updateMarkerFromPointer(globalThis.innerWidth / 2, globalThis.innerHeight / 2);
