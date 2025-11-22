import exampleIconUrl from "./noun-paperclip-7598668-00449F.png";
import "./style.css";

//
// SECTION 1: Data definitions and setup
//
interface Item {
  name: string;
  cost: number;
  rate: number;
  count: number;
  description: string;
}

const availableItems: Item[] = [
  {
    name: "Tractor",
    cost: 10,
    rate: 0.1,
    count: 0,
    description: "A small tractor that helps plow fields automatically.",
  },
  {
    name: "Barn",
    cost: 100,
    rate: 2.0,
    count: 0,
    description: "A sturdy barn to store and protect your harvest.",
  },
  {
    name: "Farmhouse",
    cost: 1000,
    rate: 50.0,
    count: 0,
    description:
      "A farmhouse full of experienced farmers who boost efficiency.",
  },
  {
    name: "Windmill",
    cost: 5000,
    rate: 120.0,
    count: 0,
    description: "Generates steady energy to process crops faster.",
  },
  {
    name: "Greenhouse",
    cost: 20000,
    rate: 400.0,
    count: 0,
    description: "Grows high-value crops year-round, rain or shine.",
  },
];

//
// SECTION 2: Base UI elements
//
document.body.innerHTML = `
  <p>Example image asset: <img src="${exampleIconUrl}" class="icon" /></p>
`;

const generateButton = document.createElement("button");
generateButton.textContent = "🌾 Harvest!";
document.body.appendChild(generateButton);

let resource = 0;
let growthRate = 0;

const resourceDisplay = document.createElement("div");
resourceDisplay.textContent = `${resource.toFixed(2)} crops harvested`;
document.body.appendChild(resourceDisplay);

const rateDiv = document.createElement("div");
rateDiv.textContent = `Growth rate: ${growthRate.toFixed(2)} crops/sec`;
document.body.appendChild(rateDiv);

//
// SECTION 3: Helper functions
//
function updateButtonText(button: HTMLButtonElement, item: Item) {
  button.textContent = `Buy ${item.name} (${
    item.cost.toFixed(2)
  } crops, +${item.rate}/sec)`;
}

//
// SECTION 4: Upgrade system (buttons, descriptions, and event logic)
//
const upgradeButtons: HTMLButtonElement[] = [];
const upgradeStatus: HTMLDivElement[] = [];

for (const item of availableItems) {
  const btn = document.createElement("button");
  updateButtonText(btn, item);
  btn.disabled = true;
  document.body.appendChild(btn);
  upgradeButtons.push(btn);

  const status = document.createElement("div");
  status.textContent = `${item.name}s owned: ${item.count}`;
  document.body.appendChild(status);

  const desc = document.createElement("div");
  desc.textContent = item.description;
  desc.className = "description";
  document.body.appendChild(desc);

  upgradeStatus.push(status);

  btn.addEventListener("click", () => {
    if (resource >= item.cost) {
      resource -= item.cost;
      item.count++;
      growthRate += item.rate;
      item.cost *= 1.15;
      resourceDisplay.textContent = `${resource.toFixed(2)} crops harvested`;
      rateDiv.textContent = `Growth rate: ${growthRate.toFixed(2)} crops/sec`;
      status.textContent = `${item.name}s owned: ${item.count}`;
      updateButtonText(btn, item);
    }
  });
}

//
// SECTION 5: Manual generation button logic
//
generateButton.addEventListener("click", () => {
  resource++;
  resourceDisplay.textContent = `${resource.toFixed(2)} crops harvested`;
});

//
// SECTION 6: Game loop (continuous updates and rendering)
//
let lastTime = performance.now();

function update(time: number) {
  const delta = (time - lastTime) / 1000;
  resource += growthRate * delta;
  resourceDisplay.textContent = `${resource.toFixed(2)} crops harvested`;
  rateDiv.textContent = `Growth rate: ${growthRate.toFixed(2)} crops/sec`;

  for (let i = 0; i < availableItems.length; i++) {
    upgradeButtons[i].disabled = resource < availableItems[i].cost;
  }

  lastTime = time;
  requestAnimationFrame(update);
}

requestAnimationFrame(update);
