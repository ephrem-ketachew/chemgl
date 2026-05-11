let nextId = (() => {
  let id = 0;
  return () => ++id;
})();

class Proton {
  constructor(x, y) {
    this.id = nextId();
    this.type = "proton";
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.radius = PARTICLE_RADIUS;
    this.color = "#ff4d4d";
    this.glowColor = "rgba(255,77,77,0.5)";
    this.label = "+";
    this.inNucleus = false;
    this.isDragging = false;
  }
}

class Neutron {
  constructor(x, y) {
    this.id = nextId();
    this.type = "neutron";
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.radius = PARTICLE_RADIUS;
    this.color = "#8a8a9a";
    this.glowColor = "rgba(138,138,154,0.4)";
    this.label = "0";
    this.inNucleus = false;
    this.isDragging = false;
  }
}

class Electron {
  constructor(x, y) {
    this.id = nextId();
    this.type = "electron";
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.radius = PARTICLE_RADIUS - 6;
    this.color = "#2f6dff";
    this.glowColor = "rgba(47,109,255,0.35)";
    this.label = "−";
    this.inShell = false;
    this.shell = -1;
    this.angle = 0;
    this.angularSpeed = 0;
    this.isDragging = false;
  }
}

function arrangeNucleus(particles, cx, cy) {
  const count = particles.length;
  if (count === 0) return;
  if (count === 1) {
    particles[0].targetX = cx;
    particles[0].targetY = cy;
    return;
  }

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  const hashParticle = (p) => {
    let h = (p.id * 2654435761) >>> 0;
    if (p.type === "neutron") h ^= 0x9e3779b9;
    return h >>> 0;
  };

  const mixed = [...particles].sort(
    (a, b) => hashParticle(a) - hashParticle(b),
  );

  const avgRadius = particles.reduce((sum, p) => sum + p.radius, 0) / count;
  const compactness =
    count >= 90 ? 0.76 : count >= 60 ? 0.8 : count >= 35 ? 0.86 : 0.92;
  const spread = avgRadius * compactness;

  for (let i = 0; i < count; i++) {
    const p = mixed[i];
    const angle = i * goldenAngle;
    const r = spread * Math.sqrt(i) * 0.5;
    p.targetX = cx + Math.cos(angle) * r;
    p.targetY = cy + Math.sin(angle) * r;
    p.inNucleus = true;
  }
}

function assignElectronShells(electrons) {
  for (const e of electrons) {
    e.inShell = false;
    e.shell = -1;
    e.angularSpeed = 0;
    if (!Number.isFinite(e.angle)) e.angle = 0;
  }

  let shellIndex = 0;
  let slotsUsed = 0;

  for (let i = 0; i < electrons.length; i++) {
    while (
      shellIndex < SHELL_CAPACITY.length &&
      slotsUsed >= SHELL_CAPACITY[shellIndex]
    ) {
      shellIndex++;
      slotsUsed = 0;
    }
    if (shellIndex >= SHELL_CAPACITY.length) break;

    electrons[i].shell = shellIndex;
    electrons[i].inShell = true;
    slotsUsed++;
  }

  const shellGroups = {};
  for (const e of electrons) {
    if (e.shell >= 0) {
      if (!shellGroups[e.shell]) shellGroups[e.shell] = [];
      shellGroups[e.shell].push(e);
    }
  }

  for (const [shell, group] of Object.entries(shellGroups)) {
    const shellNum = parseInt(shell);
    const count = group.length;

    const baseSpeed = 0.003 / (shellNum + 1);
    for (let i = 0; i < count; i++) {
      if (group[i].shell !== shellNum) continue;

      group[i].angle = (2 * Math.PI * i) / count + shellNum * 0.22;
      group[i].angularSpeed = baseSpeed * (1 + shellNum * 0.1);
    }
  }
}

function hitTest(particle, mx, my) {
  const dx = particle.x - mx;
  const dy = particle.y - my;

  const grabPad = particle.type === "electron" ? 7 : 4;
  return Math.sqrt(dx * dx + dy * dy) <= particle.radius + grabPad;
}

const canvas = document.getElementById("atomCanvas");
const ctx = canvas.getContext("2d");

let WIDTH, HEIGHT, CX, CY;

function resize() {
  WIDTH = canvas.width = canvas.offsetWidth;
  HEIGHT = canvas.height = canvas.offsetHeight;
  CX = WIDTH / 2;
  CY = HEIGHT / 2;
  refreshNucleus();
}
window.addEventListener("resize", resize);

let protons = [];
let neutrons = [];
let electrons = [];
let dragging = null;
let dragSource = null;
let scale = 1;
let targetScale = 1;
let electronSpeedMultiplier = 1;
let suppressNextBinClick = false;

let periodicTableGrid = null;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

let camYaw = 0.65;
let camPitch = 0.35;
let camDragging = false;
let camLast = null;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function rotateX(v, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
}

function rotateY(v, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
}

function project3D(v) {
  let p = rotateX(v, camPitch);
  p = rotateY(p, camYaw);

  const f = 900;
  const persp = f / (f + p.z);
  return {
    x: CX + p.x * persp * scale,
    y: CY + p.y * persp * scale,
    z: p.z,
    persp,
  };
}

function getNucleonRadius() {
  const count = protons.length + neutrons.length;
  if (count <= 30) return PARTICLE_RADIUS;

  const t = Math.min(1, (count - 30) / 220);

  return PARTICLE_RADIUS * (1 - 0.45 * t);
}

function getAverageNucleonRadius() {
  const particles = [...protons, ...neutrons];
  if (particles.length === 0) return PARTICLE_RADIUS;
  let sum = 0;
  for (const p of particles) sum += p.radius;
  return sum / particles.length;
}

function getNucleusRadius() {
  const particles = [...protons, ...neutrons];
  if (particles.length === 0) return 0;

  let maxD = 0;
  for (const p of particles) {
    const x = typeof p.targetX === "number" ? p.targetX : p.x;
    const y = typeof p.targetY === "number" ? p.targetY : p.y;
    const dx = x - CX;
    const dy = y - CY;
    const d = Math.sqrt(dx * dx + dy * dy) + p.radius;
    if (d > maxD) maxD = d;
  }
  return maxD;
}

function getShellOffset() {
  const nucleusR = getNucleusRadius();
  const padding = Math.max(24, getAverageNucleonRadius() * 2.2);
  const safeScale = Math.max(0.35, scale || 1);
  const minFirstShell = (nucleusR + padding) / safeScale;
  return Math.max(0, minFirstShell - SHELL_RADII[0]);
}

function getShellRadius(shellIndex) {
  return SHELL_RADII[shellIndex] + getShellOffset();
}

function getElementInfo() {
  const p = protons.length;
  const n = neutrons.length;
  const e = electrons.length;
  const charge = p - e;
  const mass = p + n;

  let name = "—",
    symbol = "?";
  if (p >= 1 && p < ELEMENT_DATA.length) {
    name = ELEMENT_DATA[p].name;
    symbol = ELEMENT_DATA[p].symbol;
  } else if (p === 0) {
    ((name = "Unknown"), (symbol = "?"));
  } else {
    ((name = `Element ${p}`), (symbol = `E${p}`));
  }

  return { p, n, e, charge, mass, name, symbol };
}

function updatePanel() {
  const info = getElementInfo();
  const categoryInfo = getCategoryPresentation(info.p);

  document.getElementById("el-atomic-number").textContent =
    info.p > 0 ? String(info.p) : "—";
  document.getElementById("el-name").textContent = info.name;
  document.getElementById("el-symbol").textContent = info.symbol;
  document.getElementById("el-category-pill").textContent = categoryInfo.label;
  document.getElementById("el-category-pill").className =
    `category-pill ${categoryInfo.className}`;
  document.getElementById("el-family-desc").textContent = categoryInfo.family;
  document.getElementById("el-protons").textContent = info.p;
  document.getElementById("el-neutrons").textContent = info.n;
  document.getElementById("el-electrons").textContent = info.e;
  document.getElementById("el-mass").textContent = `${info.mass} u`;

  const cP = document.getElementById("cnt-protons");
  const cN = document.getElementById("cnt-neutrons");
  const cE = document.getElementById("cnt-electrons");
  if (cP) cP.textContent = String(info.p);
  if (cN) cN.textContent = String(info.n);
  if (cE) cE.textContent = String(info.e);

  const chargeEl = document.getElementById("el-charge");
  if (info.charge === 0) {
    chargeEl.textContent = "Neutral";
    chargeEl.className = "value neutral";
  } else if (info.charge > 0) {
    chargeEl.textContent = `+${info.charge} (Cation)`;
    chargeEl.className = "value cation";
  } else {
    chargeEl.textContent = `${info.charge} (Anion)`;
    chargeEl.className = "value anion";
  }

  const shellEl = document.getElementById("el-shells");
  const shellGroups = {};
  for (const e of electrons) {
    if (e.inShell) {
      shellGroups[e.shell] = (shellGroups[e.shell] || 0) + 1;
    }
  }
  const shellNames = ["K", "L", "M", "N", "O", "P", "Q"];
  const shellParts = Object.entries(shellGroups).map(([s, c]) => {
    const idx = Number(s);
    const label = shellNames[idx] ?? `n${idx + 1}`;
    return `${label}:${c}`;
  });
  shellEl.textContent = shellParts.length ? shellParts.join("  ") : "—";

  highlightPeriodicElement(info.p);
  updateDidYouKnow(info, categoryInfo);
}

function updateDidYouKnow(info, categoryInfo) {
  const textEl = document.getElementById("didyouknow-text");
  if (!textEl) return;

  if (info.p === 0) {
    textEl.textContent =
      "Select an element from the periodic table to see a unique fact about it.";
    return;
  }

  const elementFact = allElementFacts.find((el) => el.atomicNumber === info.p);
  textEl.textContent = elementFact
    ? elementFact.fact
    : `${info.name} is element ${info.p} on the periodic table.`;
}

function highlightPeriodicElement(atomicNumber) {
  if (!periodicTableGrid) return;
  const active = periodicTableGrid.querySelectorAll(".ptable-item.is-active");
  for (const el of active) el.classList.remove("is-active");

  const target = periodicTableGrid.querySelector(
    `[data-atomic-number='${atomicNumber}']`,
  );
  if (target) target.classList.add("is-active");
}

function getPeriodicPosition(atomicNumber) {
  if (atomicNumber === 1) return { row: 1, col: 1 };
  if (atomicNumber === 2) return { row: 1, col: 18 };

  if (atomicNumber >= 3 && atomicNumber <= 4)
    return { row: 2, col: atomicNumber - 2 };
  if (atomicNumber >= 5 && atomicNumber <= 10)
    return { row: 2, col: atomicNumber + 8 };

  if (atomicNumber >= 11 && atomicNumber <= 12)
    return { row: 3, col: atomicNumber - 10 };
  if (atomicNumber >= 13 && atomicNumber <= 18)
    return { row: 3, col: atomicNumber };

  if (atomicNumber >= 19 && atomicNumber <= 36)
    return { row: 4, col: atomicNumber - 18 };
  if (atomicNumber >= 37 && atomicNumber <= 54)
    return { row: 5, col: atomicNumber - 36 };

  if (atomicNumber === 55) return { row: 6, col: 1 };
  if (atomicNumber === 56) return { row: 6, col: 2 };
  if (atomicNumber >= 72 && atomicNumber <= 86)
    return { row: 6, col: atomicNumber - 68 };

  if (atomicNumber === 87) return { row: 7, col: 1 };
  if (atomicNumber === 88) return { row: 7, col: 2 };
  if (atomicNumber >= 104 && atomicNumber <= 118)
    return { row: 7, col: atomicNumber - 100 };

  if (atomicNumber >= 57 && atomicNumber <= 71)
    return { row: 8, col: atomicNumber - 53 };
  if (atomicNumber >= 89 && atomicNumber <= 103)
    return { row: 9, col: atomicNumber - 85 };

  return null;
}

function getElementCategory(atomicNumber) {
  const alkaliMetals = new Set([3, 11, 19, 37, 55, 87]);
  const alkalineEarthMetals = new Set([4, 12, 20, 38, 56, 88]);
  const metalloids = new Set([5, 14, 32, 33, 51, 52, 84]);
  const otherNonmetals = new Set([1, 6, 7, 8, 15, 16, 34]);
  const halogens = new Set([9, 17, 35, 53, 85, 117]);
  const nobleGases = new Set([2, 10, 18, 36, 54, 86, 118]);
  const postTransitionMetals = new Set([
    13, 31, 49, 50, 81, 82, 83, 113, 114, 115, 116,
  ]);

  if (atomicNumber >= 57 && atomicNumber <= 71) return "lanthanide";
  if (atomicNumber >= 89 && atomicNumber <= 103) return "actinide";
  if (alkaliMetals.has(atomicNumber)) return "alkali-metal";
  if (alkalineEarthMetals.has(atomicNumber)) return "alkaline-earth";
  if (nobleGases.has(atomicNumber)) return "noble-gas";
  if (halogens.has(atomicNumber)) return "halogen";
  if (otherNonmetals.has(atomicNumber)) return "other-nonmetal";
  if (metalloids.has(atomicNumber)) return "metalloid";
  if (postTransitionMetals.has(atomicNumber)) return "post-transition-metal";
  return "transition-metal";
}

function getCategoryPresentation(atomicNumber) {
  if (
    !atomicNumber ||
    atomicNumber < 1 ||
    atomicNumber >= ELEMENT_DATA.length
  ) {
    return {
      label: "No category",
      family: "Build an atom to view element details.",
      className: "cat-unknown",
    };
  }

  const category = getElementCategory(atomicNumber);
  const map = {
    "alkali-metal": {
      label: "Alkali Metal",
      family: "Highly reactive soft metal",
      className: "cat-alkali-metal",
    },
    "alkaline-earth": {
      label: "Alkaline Earth",
      family: "Reactive metallic element",
      className: "cat-alkaline-earth",
    },
    "transition-metal": {
      label: "Transition Metal",
      family: "Typical metallic conductor",
      className: "cat-transition-metal",
    },
    "post-transition-metal": {
      label: "Post-Transition",
      family: "Soft metal-like element",
      className: "cat-post-transition-metal",
    },
    metalloid: {
      label: "Metalloid",
      family: "Mixed metal/nonmetal behavior",
      className: "cat-metalloid",
    },
    "other-nonmetal": {
      label: "Nonmetal",
      family: "Reactive nonmetal",
      className: "cat-other-nonmetal",
    },
    halogen: {
      label: "Halogen",
      family: "Reactive nonmetal",
      className: "cat-halogen",
    },
    "noble-gas": {
      label: "Noble Gas",
      family: "Mostly inert gas",
      className: "cat-noble-gas",
    },
    lanthanide: {
      label: "Lanthanide",
      family: "Rare-earth metallic element",
      className: "cat-lanthanide",
    },
    actinide: {
      label: "Actinide",
      family: "Heavy radioactive metal",
      className: "cat-actinide",
    },
  };

  return (
    map[category] ?? {
      label: "Unknown",
      family: "Element family unavailable",
      className: "cat-unknown",
    }
  );
}

function loadElement(atomicNumber) {
  if (!atomicNumber || atomicNumber < 1 || atomicNumber >= ELEMENT_DATA.length)
    return;

  protons = [];
  neutrons = [];
  electrons = [];

  const protonCount = atomicNumber;
  const neutronCount = atomicNumber;
  const electronCount = atomicNumber;

  for (let i = 0; i < protonCount; i++) protons.push(new Proton(CX, CY));
  for (let i = 0; i < neutronCount; i++) neutrons.push(new Neutron(CX, CY));
  for (let i = 0; i < electronCount; i++) electrons.push(new Electron(CX, CY));

  refreshNucleus();
  refreshElectrons();
  updatePanel();
}

function buildPeriodicTable() {
  periodicTableGrid = document.getElementById("ptable-grid");
  if (!periodicTableGrid) return;

  periodicTableGrid.innerHTML = "";

  const appendPlaceholder = (label, row, col) => {
    const placeholder = document.createElement("div");
    placeholder.className = "ptable-placeholder";
    placeholder.textContent = label;
    placeholder.style.gridRow = String(row);
    placeholder.style.gridColumn = String(col);
    periodicTableGrid.appendChild(placeholder);
  };

  appendPlaceholder("57–71", 6, 3);
  appendPlaceholder("89–103", 7, 3);

  for (
    let atomicNumber = 1;
    atomicNumber < ELEMENT_DATA.length;
    atomicNumber++
  ) {
    const element = ELEMENT_DATA[atomicNumber];
    const position = getPeriodicPosition(atomicNumber);
    if (!element || !position) continue;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `ptable-item cat-${getElementCategory(atomicNumber)}`;
    button.dataset.atomicNumber = String(atomicNumber);
    button.style.gridRow = String(position.row);
    button.style.gridColumn = String(position.col);
    button.title = `${element.name} (${element.symbol})`;
    button.setAttribute(
      "aria-label",
      `${element.name}, atomic number ${atomicNumber}`,
    );
    button.innerHTML = `
      <span class="ptable-num">${atomicNumber}</span>
      <span class="ptable-symbol">${element.symbol}</span>
    `;
    button.addEventListener("click", () => loadElement(atomicNumber));

    periodicTableGrid.appendChild(button);
  }

  highlightPeriodicElement(getElementInfo().p);
}

function computeTargetScale() {
  let maxShell = -1;
  for (const e of electrons) {
    if (e.inShell && e.shell > maxShell) maxShell = e.shell;
  }
  const neededRadius =
    maxShell >= 0 ? getShellRadius(maxShell) + 40 : getNucleusRadius() + 120;
  const available = Math.min(WIDTH, HEIGHT) / 2 - 60;
  return Math.min(1, available / neededRadius);
}

function refreshNucleus() {
  const radius = getNucleonRadius();
  for (const p of [...protons, ...neutrons]) {
    p.radius = radius;
  }
  arrangeNucleus([...protons, ...neutrons], CX, CY);
}

function refreshElectrons() {
  assignElectronShells(electrons);
}

function drawGlow(x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.2);
  g.addColorStop(0, color);
  g.addColorStop(1, "transparent");
  ctx.beginPath();
  ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
}

function drawParticle(p) {
  const x = p.x,
    y = p.y,
    r = p.radius;

  const grad = ctx.createRadialGradient(
    x - r * 0.3,
    y - r * 0.35,
    r * 0.05,
    x,
    y,
    r,
  );
  grad.addColorStop(0, lighten(p.color, 90));
  grad.addColorStop(0.45, p.color);
  grad.addColorStop(1, darken(p.color, 90));

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(x - r * 0.28, y - r * 0.3, r * 0.36, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.34)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x - r * 0.12, y - r * 0.45, Math.max(1, r * 0.08), 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.font = `bold ${r * 0.9}px 'Space Mono', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(p.label, x, y + 1);
}

function drawOrbitalRing(shellIndex, scale) {
  const r = getShellRadius(shellIndex);
  const shellNames = ["K", "L", "M", "N", "O", "P", "Q"];

  ctx.save();

  const steps = 96;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const p = project3D({ x: Math.cos(t) * r, y: Math.sin(t) * r, z: 0 });
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }

  ctx.strokeStyle = "rgba(110, 130, 115, 0.40)";
  ctx.lineWidth = 1.4;
  ctx.shadowBlur = 0;
  ctx.setLineDash([]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(70, 90, 70, 0.55)";
  ctx.font =
    "11px 'Nunito', system-ui, -apple-system, Segoe UI, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const labelP = project3D({ x: r, y: 0, z: 0 });
  ctx.fillText(
    shellNames[shellIndex] ?? `n${shellIndex + 1}`,
    labelP.x + 8,
    labelP.y,
  );
  ctx.restore();
}

function drawNucleusGlow() {
  const count = protons.length + neutrons.length;
  if (count === 0) return;
  const r = Math.max(20, Math.sqrt(count) * getAverageNucleonRadius() * 0.8);
  const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, r * 3);
  g.addColorStop(0, "rgba(255,80,80,0.12)");
  g.addColorStop(0.5, "rgba(255,120,50,0.05)");
  g.addColorStop(1, "transparent");
  ctx.beginPath();
  ctx.arc(CX, CY, r * 3, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
}

function drawGrid() {
  ctx.save();

  ctx.strokeStyle = "rgba(40, 80, 40, 0.02)";
  ctx.lineWidth = 1;
  const step = 50;
  for (let x = 0; x < WIDTH; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEmptyHint() {
  if (protons.length + neutrons.length + electrons.length > 0) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(100,160,255,0.18)";
  ctx.font = "15px 'Space Mono', monospace";
  ctx.fillText("Drag particles here to build an atom", CX, CY);

  ctx.beginPath();
  ctx.arc(CX, CY, 50, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(100,160,255,0.12)";
  ctx.setLineDash([4, 8]);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}
function lighten(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255, r + amt)},${Math.min(255, g + amt)},${Math.min(255, b + amt)})`;
}
function darken(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.max(0, r - amt)},${Math.max(0, g - amt)},${Math.max(0, b - amt)})`;
}

let lastTime = 0;

function tick(timestamp) {
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  targetScale = computeTargetScale();
  scale = lerp(scale, targetScale, 0.04);

  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  drawGrid();
  drawEmptyHint();

  const usedShells = new Set(
    electrons.filter((e) => e.inShell).map((e) => e.shell),
  );
  for (const s of usedShells) {
    drawOrbitalRing(s, scale);
  }

  drawNucleusGlow();

  for (const e of electrons) {
    if (e.inShell && !e.isDragging) {
      if (!Number.isFinite(e.angle)) e.angle = 0;
      if (!Number.isFinite(e.angularSpeed)) e.angularSpeed = 0;
      e.angle += e.angularSpeed * electronSpeedMultiplier * (dt || 16);
      const r = getShellRadius(e.shell);
      const p = project3D({
        x: Math.cos(e.angle) * r,
        y: Math.sin(e.angle) * r,
        z: 0,
      });
      e._depth = p.z;
      e.x = p.x;
      e.y = p.y;
    }
  }

  for (const p of [...protons, ...neutrons]) {
    if (!p.isDragging) {
      p.x = lerp(p.x, p.targetX, 0.1);
      p.y = lerp(p.y, p.targetY, 0.1);
    }
  }

  for (const n of neutrons) if (!n.isDragging) drawParticle(n);
  for (const p of protons) if (!p.isDragging) drawParticle(p);
  const visibleElectrons = electrons.filter((e) => !e.isDragging);
  visibleElectrons.sort((a, b) => (a._depth ?? 0) - (b._depth ?? 0));
  for (const e of visibleElectrons) drawParticle(e);

  if (dragging) drawParticle(dragging.particle);

  requestAnimationFrame(tick);
}

function canvasPos(evt) {
  const rect = canvas.getBoundingClientRect();
  const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
  const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function findParticleAt(mx, my) {
  for (let i = electrons.length - 1; i >= 0; i--)
    if (hitTest(electrons[i], mx, my)) return electrons[i];
  for (let i = protons.length - 1; i >= 0; i--)
    if (hitTest(protons[i], mx, my)) return protons[i];
  for (let i = neutrons.length - 1; i >= 0; i--)
    if (hitTest(neutrons[i], mx, my)) return neutrons[i];
  return null;
}

canvas.addEventListener("mousedown", onDown);
canvas.addEventListener("touchstart", onDown, { passive: false });
window.addEventListener("mousemove", onMove);
window.addEventListener("touchmove", onMove, { passive: false });
window.addEventListener("mouseup", onUp);
window.addEventListener("touchend", onUp);

function onDown(evt) {
  evt.preventDefault();
  const { x, y } = canvasPos(evt);
  const p = findParticleAt(x, y);
  if (p) {
    p.isDragging = true;
    if (p.inNucleus) {
      p.inNucleus = false;
    }
    if (p.inShell) {
      p.inShell = false;
      p.shell = -1;
    }
    dragging = { particle: p, offsetX: p.x - x, offsetY: p.y - y };
    dragSource = "canvas";
    camDragging = false;
    camLast = null;
  } else {
    const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    camDragging = true;
    camLast = { x: clientX, y: clientY };
  }
}

function onMove(evt) {
  if (dragging) {
    evt.preventDefault();
    const { x, y } = canvasPos(evt);
    dragging.particle.x = x + dragging.offsetX;
    dragging.particle.y = y + dragging.offsetY;
    return;
  }

  if (camDragging && camLast) {
    evt.preventDefault();
    const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    const dx = clientX - camLast.x;
    const dy = clientY - camLast.y;
    camLast = { x: clientX, y: clientY };

    camYaw += dx * 0.006;
    camPitch += dy * 0.006;
    camPitch = clamp(camPitch, -1.2, 1.2);
  }
}

function onUp(evt) {
  if (camDragging) {
    camDragging = false;
    camLast = null;
  }
  if (!dragging) return;
  const p = dragging.particle;
  p.isDragging = false;

  const dx = p.x - CX,
    dy = p.y - CY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (p.type === "proton" || p.type === "neutron") {
    if (dist < 120) {
      p.inNucleus = true;
    } else {
      removeParticle(p);
    }
  } else if (p.type === "electron") {
    const maxShellIndex = SHELL_RADII.length - 1;
    if (dist > 50 && dist < getShellRadius(maxShellIndex) * scale + 50) {
      p.inShell = true;
    } else if (dist <= 50) {
      removeParticle(p);
    } else {
      removeParticle(p);
    }
  }

  refreshNucleus();
  refreshElectrons();
  updatePanel();
  dragging = null;

  setTimeout(() => {
    suppressNextBinClick = false;
  }, 0);
}

function removeParticle(p) {
  protons = protons.filter((x) => x !== p);
  neutrons = neutrons.filter((x) => x !== p);
  electrons = electrons.filter((x) => x !== p);
}

function setupBins() {
  const binProton = document.getElementById("bin-proton");
  const binNeutron = document.getElementById("bin-neutron");
  const binElectron = document.getElementById("bin-electron");

  function startBinDrag(type, evt) {
    evt.preventDefault();

    if (type === "proton" && protons.length >= MAX_PROTONS) {
      suppressNextBinClick = false;
      return;
    }

    suppressNextBinClick = true;

    let particle;
    if (type === "proton") {
      particle = new Proton(CX, CY);
      protons.push(particle);
    } else if (type === "neutron") {
      particle = new Neutron(CX, CY);
      neutrons.push(particle);
    } else {
      particle = new Electron(CX, CY);
      electrons.push(particle);
    }

    const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    const rect = canvas.getBoundingClientRect();
    particle.x = clientX - rect.left;
    particle.y = clientY - rect.top;
    particle.isDragging = true;
    dragSource = `bin-${type}`;
    dragging = { particle, offsetX: 0, offsetY: 0 };

    updatePanel();
  }

  binElectron.addEventListener("mousedown", (e) => startBinDrag("electron", e));
  binElectron.addEventListener(
    "touchstart",
    (e) => startBinDrag("electron", e),
    {
      passive: false,
    },
  );

  function spawnToNucleus(type) {
    if (type === "proton" && protons.length >= MAX_PROTONS) {
      return;
    }

    let particle;
    if (type === "proton") {
      particle = new Proton(CX, CY);
      protons.push(particle);
    } else {
      particle = new Neutron(CX, CY);
      neutrons.push(particle);
    }
    particle.inNucleus = true;
    refreshNucleus();
    updatePanel();
  }

  function setupClickOrDrag(binEl, type) {
    if (!binEl) return;

    const DRAG_THRESHOLD_PX = 6;
    let down = null;
    let dragStarted = false;

    const getClient = (evt) => {
      const p = evt.touches ? evt.touches[0] : evt;
      return { x: p.clientX, y: p.clientY };
    };

    const onDown = (evt) => {
      down = getClient(evt);
      dragStarted = false;
      suppressNextBinClick = false;
    };

    const onMove = (evt) => {
      if (!down || dragStarted) return;
      const cur = getClient(evt);
      const dx = cur.x - down.x;
      const dy = cur.y - down.y;
      if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
        dragStarted = true;
        suppressNextBinClick = true;
        startBinDrag(type, evt);
      }
    };

    const onUp = (evt) => {
      if (!down) return;
      if (!dragStarted) {
        evt.preventDefault();
        spawnToNucleus(type);
      }
      down = null;
      dragStarted = false;
    };

    binEl.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    binEl.addEventListener("touchstart", onDown, { passive: false });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
  }

  setupClickOrDrag(binProton, "proton");
  setupClickOrDrag(binNeutron, "neutron");
}

function setupElectronSpeedControl() {
  const slider = document.getElementById("electron-speed");
  const valueEl = document.getElementById("electron-speed-value");
  if (!slider || !valueEl) return;

  const apply = () => {
    const raw = Number(slider.value);

    electronSpeedMultiplier = Math.max(0, raw / 100);
    valueEl.textContent = `${electronSpeedMultiplier.toFixed(2)}×`;
  };

  slider.addEventListener("input", apply);
  slider.addEventListener("change", apply);
  apply();
}

document.getElementById("btn-clear").addEventListener("click", () => {
  protons = [];
  neutrons = [];
  electrons = [];
  dragging = null;
  scale = 1;
  targetScale = 1;
  updatePanel();
});

const THEME_STORAGE_KEY = "chemgl-theme";
const themeToggle = document.getElementById("theme-toggle");
const systemThemeQuery = window.matchMedia
  ? window.matchMedia("(prefers-color-scheme: dark)")
  : null;

function getSystemTheme() {
  return systemThemeQuery && systemThemeQuery.matches ? "dark" : "light";
}

function applyTheme(theme, persist = true) {
  const nextTheme = theme === "light" ? "light" : "dark";
  document.body.dataset.theme = nextTheme;
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage failures.
    }
  }

  if (!themeToggle) return;
  const isDark = nextTheme === "dark";
  themeToggle.textContent = isDark ? "☼" : "☾";
  themeToggle.setAttribute(
    "aria-label",
    isDark ? "Switch to light theme" : "Switch to dark theme",
  );
  themeToggle.setAttribute("aria-pressed", String(isDark));
}

let savedTheme = null;
try {
  savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
} catch {
  savedTheme = null;
}

if (savedTheme === "light" || savedTheme === "dark") {
  applyTheme(savedTheme, false);
} else {
  applyTheme(getSystemTheme(), false);
}

if (systemThemeQuery) {
  systemThemeQuery.addEventListener("change", () => {
    try {
      if (!localStorage.getItem(THEME_STORAGE_KEY)) {
        applyTheme(getSystemTheme(), false);
      }
    } catch {
      applyTheme(getSystemTheme(), false);
    }
  });
}

themeToggle?.addEventListener("click", () => {
  applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
});

document.getElementById("btn-rm-proton").addEventListener("click", () => {
  if (protons.length) {
    protons.pop();
    refreshNucleus();
    updatePanel();
  }
});
document.getElementById("btn-rm-neutron").addEventListener("click", () => {
  if (neutrons.length) {
    neutrons.pop();
    refreshNucleus();
    updatePanel();
  }
});
document.getElementById("btn-rm-electron").addEventListener("click", () => {
  if (electrons.length) {
    electrons.pop();
    refreshElectrons();
    updatePanel();
  }
});

buildPeriodicTable();
setupBins();
setupElectronSpeedControl();
resize();
loadElement(17);
requestAnimationFrame(tick);
