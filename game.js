const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayBody = document.getElementById("overlayBody");
const startButton = document.getElementById("startButton");

const roomNameEl = document.getElementById("roomName");
const progressStatEl = document.getElementById("progressStat");
const deathCountEl = document.getElementById("deathCount");
const berryCountEl = document.getElementById("berryCount");
const timerEl = document.getElementById("timer");
const bestTimeEl = document.getElementById("bestTime");
const bestDeathsEl = document.getElementById("bestDeaths");

const TILE = 16;
const ROOM_W = 24;
const ROOM_H = 14;
const WORLD_W = ROOM_W * TILE;
const WORLD_H = ROOM_H * TILE;

const keys = new Set();
const pressed = new Set();
const virtualHeld = new Set();
const virtualPressed = new Set();

const inputMap = {
  left: ["ArrowLeft", "a", "A"],
  right: ["ArrowRight", "d", "D"],
  up: ["ArrowUp", "w", "W"],
  down: ["ArrowDown", "s", "S"],
  jump: ["z", "Z", "c", "C", " "],
  dash: ["x", "X", "Shift"],
  restart: ["r", "R"],
  pause: ["Escape"],
};

document.addEventListener("keydown", (event) => {
  if (!keys.has(event.key)) {
    pressed.add(event.key);
  }
  keys.add(event.key);
  if (Object.values(inputMap).some((list) => list.includes(event.key))) {
    event.preventDefault();
  }
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

function btn(name) {
  return virtualHeld.has(name) || inputMap[name].some((key) => keys.has(key));
}

function btnPressed(name) {
  return virtualPressed.has(name) || inputMap[name].some((key) => pressed.has(key));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function approach(value, target, maxDelta) {
  if (value < target) return Math.min(value + maxDelta, target);
  if (value > target) return Math.max(value - maxDelta, target);
  return target;
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remaining.toFixed(3).padStart(6, "0")}`;
}

const roomDefs = [
  {
    id: "ridge-1",
    name: "Ridge 1",
    colorA: "#78b6ff",
    colorB: "#bde0ff",
    exits: { right: "ridge-2" },
    map: [
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      ".....................s..",
      "..............###....###",
      "......*.................",
      "....####...........r....",
      "...............#####....",
      "P..............^........",
      "##########..#########..#",
      "########################",
    ],
    movers: [],
  },
  {
    id: "ridge-2",
    name: "Ridge 2",
    colorA: "#89c2ff",
    colorB: "#d5edff",
    exits: { left: "ridge-1", right: "ridge-3" },
    map: [
      "........................",
      "........................",
      "..............s.........",
      "............#####.......",
      "......###...........>...",
      "...*................##..",
      "#####......####........#",
      ".........^.............#",
      ".....r.............#####",
      ".............<..........",
      ".................###....",
      "....c...................",
      "#..######..######..#####",
      "########################",
    ],
    movers: [],
  },
  {
    id: "ridge-3",
    name: "Ridge 3",
    colorA: "#8db4ff",
    colorB: "#dceeff",
    exits: { left: "ridge-2", right: "shaft-1" },
    map: [
      "........................",
      "........................",
      "..................^^^^..",
      "..............#######...",
      ".............r..........",
      "......*................>",
      "....#####......#####....",
      "...............^........",
      "............#######.....",
      "....................s...",
      "...B....................",
      "P..............#######..",
      "##########..##########.#",
      "########################",
    ],
    movers: [],
  },
  {
    id: "shaft-1",
    name: "Shaft 1",
    colorA: "#7eb6d4",
    colorB: "#d5fff7",
    exits: { left: "ridge-3", up: "shaft-2" },
    map: [
      "############..##########",
      "#......................#",
      "#......s...............#",
      "#...####......####.....#",
      "#......................#",
      "#.....^............*...#",
      "#..............#####...#",
      "#......................#",
      "#..r.................c.#",
      "#......#####...........#",
      "#......................#",
      "#..P...................#",
      "#####..............#####",
      "########################",
    ],
    movers: [
      { x: 7 * TILE, y: 7 * TILE, w: 3 * TILE, h: TILE, dx: 0, dy: -56, speed: 0.7 },
    ],
  },
  {
    id: "shaft-2",
    name: "Shaft 2",
    colorA: "#6ba9bf",
    colorB: "#c7faf0",
    exits: { down: "shaft-1", up: "shaft-3" },
    map: [
      "########################",
      "#......................#",
      "#...................s..#",
      "#.........######.......#",
      "#....^.............*...#",
      "#........r.............#",
      "#....######.........####",
      "#......................#",
      "#..............####....#",
      "#...B..................#",
      "#......................#",
      "#......######..........#",
      "#..P...................#",
      "##########....##########",
    ],
    movers: [
      { x: 13 * TILE, y: 8 * TILE, w: 2 * TILE, h: TILE, dx: 4 * TILE, dy: 0, speed: 0.9 },
    ],
  },
  {
    id: "shaft-3",
    name: "Shaft 3",
    colorA: "#5d91af",
    colorB: "#b9e7ff",
    exits: { down: "shaft-2", right: "gauntlet-1" },
    map: [
      "########################",
      "#......................#",
      "#......................#",
      "#...........*..........#",
      "#..^^^^...........^^^^.#",
      "#...........####.......#",
      "#.....r................#",
      "#..............#####...#",
      "#...B.................>#",
      "#..........####........#",
      "#...................s..#",
      "#..P...................#",
      "#######..######..#######",
      "########################",
    ],
    movers: [
      { x: 4 * TILE, y: 6 * TILE, w: 2 * TILE, h: TILE, dx: 0, dy: -48, speed: 1.1 },
    ],
  },
  {
    id: "gauntlet-1",
    name: "Gauntlet 1",
    colorA: "#688fb0",
    colorB: "#d1f2ff",
    exits: { left: "shaft-3", right: "gauntlet-2" },
    map: [
      "........................",
      "........................",
      "......................s.",
      "...........^^^^.........",
      "....####........#####...",
      ".............r..........",
      "..*......####.......*...",
      "..............^.........",
      "....####..........####..",
      "..............<.........",
      "...B....................",
      "P...........c...........",
      "##########..##########.#",
      "########################",
    ],
    movers: [],
  },
  {
    id: "gauntlet-2",
    name: "Gauntlet 2",
    colorA: "#6a7da2",
    colorB: "#d9dcff",
    exits: { left: "gauntlet-1", right: "gauntlet-3" },
    map: [
      "........................",
      "........................",
      "...............s........",
      "....r...........####....",
      "...^^^^................>",
      "...........*............",
      ".....####.......####....",
      "....................^...",
      "..####.........r........",
      "...........####......*..",
      ".....B..................",
      "P.......................",
      "######..##########..####",
      "########################",
    ],
    movers: [
      { x: 10 * TILE, y: 4 * TILE, w: 2 * TILE, h: TILE, dx: 5 * TILE, dy: 0, speed: 1.4 },
    ],
  },
  {
    id: "gauntlet-3",
    name: "Gauntlet 3",
    colorA: "#5d7493",
    colorB: "#d1e7ff",
    exits: { left: "gauntlet-2", up: "summit-1" },
    map: [
      "##########....##########",
      "#......................#",
      "#.............s........#",
      "#...####...........*...#",
      "#...........^^^^.......#",
      "#.....r.............####",
      "#......................#",
      "#..B.........####......#",
      "#....................>.#",
      "#......######..........#",
      "#......................#",
      "#..P...............c...#",
      "#######..........#######",
      "########################",
    ],
    movers: [
      { x: 8 * TILE, y: 9 * TILE, w: 3 * TILE, h: TILE, dx: 0, dy: -58, speed: 0.85 },
    ],
  },
  {
    id: "summit-1",
    name: "Summit 1",
    colorA: "#7f79b2",
    colorB: "#eedcff",
    exits: { down: "gauntlet-3", up: "summit-2" },
    map: [
      "########################",
      "#......................#",
      "#..........s...........#",
      "#.....*...........*....#",
      "#...^^^^........^^^^...#",
      "#........####..........#",
      "#....r.................#",
      "#............####......#",
      "#..B...................#",
      "#.........r............#",
      "#......................#",
      "#..P.............c.....#",
      "######..........########",
      "########################",
    ],
    movers: [
      { x: 14 * TILE, y: 7 * TILE, w: 2 * TILE, h: TILE, dx: -5 * TILE, dy: 0, speed: 1.2 },
    ],
  },
  {
    id: "summit-2",
    name: "Summit 2",
    colorA: "#8f7abf",
    colorB: "#fde9ff",
    exits: { down: "summit-1", right: "summit-3" },
    map: [
      "........................",
      "........................",
      ".................^^^^...",
      "...........####.........",
      ".....r..................",
      "...*...............s....",
      ".......####.............",
      "....................>...",
      "..####..................",
      "............####........",
      "...B....................",
      "P...................c...",
      "######..##########..####",
      "########################",
    ],
    movers: [],
  },
  {
    id: "summit-3",
    name: "Summit Gate",
    colorA: "#a77ed1",
    colorB: "#fff2f7",
    exits: { left: "summit-2" },
    map: [
      "........................",
      "........................",
      "....................s...",
      ".........####...........",
      "....*.............*.....",
      "..^^^^...........^^^^...",
      "........####............",
      "......r.................",
      "..............####......",
      "...B....................",
      ".....................g..",
      "P.......................",
      "##########..##########.#",
      "########################",
    ],
    movers: [
      { x: 16 * TILE, y: 8 * TILE, w: 2 * TILE, h: TILE, dx: 0, dy: -46, speed: 0.95 },
    ],
  },
];

function parseRoom(def) {
  const room = {
    ...def,
    solids: [],
    hazards: [],
    springs: [],
    crystals: [],
    berries: [],
    crumbles: [],
    checkpoints: [],
    goal: null,
    spawn: { x: 2 * TILE, y: 10 * TILE },
    movers: (def.movers || []).map((mover, index) => ({
      ...mover,
      startX: mover.x,
      startY: mover.y,
      phase: index * 0.9,
      prevX: mover.x,
      prevY: mover.y,
      currentX: mover.x,
      currentY: mover.y,
    })),
  };

  def.map.forEach((row, y) => {
    [...row].forEach((char, x) => {
      const px = x * TILE;
      const py = y * TILE;
      if (char === "#") room.solids.push({ x: px, y: py, w: TILE, h: TILE });
      if (char === "^") room.hazards.push({ x: px + 2, y: py + 4, w: TILE - 4, h: TILE - 4, dir: "up" });
      if (char === "v") room.hazards.push({ x: px + 2, y: py, w: TILE - 4, h: TILE - 4, dir: "down" });
      if (char === "<") room.hazards.push({ x: px, y: py + 2, w: TILE - 4, h: TILE - 4, dir: "left" });
      if (char === ">") room.hazards.push({ x: px + 4, y: py + 2, w: TILE - 4, h: TILE - 4, dir: "right" });
      if (char === "B") room.springs.push({ x: px + 2, y: py + 8, w: TILE - 4, h: 8 });
      if (char === "*") room.crystals.push({ x: px + 2, y: py + 2, w: TILE - 4, h: TILE - 4, active: true, timer: 0 });
      if (char === "s") room.berries.push({ x: px + 4, y: py + 4, w: 8, h: 8, id: `${def.id}-${x}-${y}` });
      if (char === "r") room.crumbles.push({ x: px, y: py, w: TILE, h: TILE, state: "solid", timer: 0 });
      if (char === "c") room.checkpoints.push({ x: px + 2, y: py + 2, w: TILE - 4, h: TILE - 4 });
      if (char === "g" || char === "G") room.goal = { x: px + 2, y: py + 2, w: TILE - 4, h: TILE - 4 };
      if (char === "P") room.spawn = { x: px + 3, y: py + 1 };
    });
  });

  return room;
}

const rooms = new Map(roomDefs.map((def) => [def.id, parseRoom(def)]));
const roomOrder = roomDefs.map((def) => def.id);
const STORAGE_KEY = "needle-peak-best-v1";

const savedBest = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
})();

const state = {
  mode: "menu",
  currentRoomId: "ridge-1",
  checkpoint: { roomId: "ridge-1", x: rooms.get("ridge-1").spawn.x, y: rooms.get("ridge-1").spawn.y },
  deaths: 0,
  timer: 0,
  berriesCollected: new Set(),
  finished: false,
  bestTime: typeof savedBest.bestTime === "number" ? savedBest.bestTime : null,
  bestDeaths: typeof savedBest.bestDeaths === "number" ? savedBest.bestDeaths : null,
};

const player = {
  x: 0,
  y: 0,
  w: 10,
  h: 14,
  vx: 0,
  vy: 0,
  facing: 1,
  onGround: false,
  coyote: 0,
  jumpBuffer: 0,
  dashBuffer: 0,
  dashCharges: 1,
  dashTimer: 0,
  dashCooldown: 0,
  wallDir: 0,
  wallGrace: 0,
  jumpCut: false,
  respawnFlash: 0,
};

function currentRoom() {
  return rooms.get(state.currentRoomId);
}

function roomProgressLabel() {
  return `${roomOrder.indexOf(state.currentRoomId) + 1} / ${roomOrder.length}`;
}

function saveBestStats() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        bestTime: state.bestTime,
        bestDeaths: state.bestDeaths,
      })
    );
  } catch {
    // Ignore storage failures in restricted browser modes.
  }
}

function bindTouchControls() {
  document.querySelectorAll("[data-input]").forEach((element) => {
    const input = element.dataset.input;

    const activate = (event) => {
      event.preventDefault();
      if (!virtualHeld.has(input)) {
        virtualPressed.add(input);
      }
      virtualHeld.add(input);
      element.classList.add("is-active");
    };

    const release = (event) => {
      if (event) event.preventDefault();
      virtualHeld.delete(input);
      element.classList.remove("is-active");
    };

    element.addEventListener("pointerdown", activate);
    element.addEventListener("pointerup", release);
    element.addEventListener("pointercancel", release);
    element.addEventListener("pointerleave", release);
  });
}

function showOverlay(title, body, buttonText = "Begin Run") {
  overlayTitle.textContent = title;
  overlayBody.textContent = body;
  startButton.textContent = buttonText;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function resetRoomDynamics(room) {
  room.crumbles.forEach((block) => {
    block.state = "solid";
    block.timer = 0;
  });
  room.crystals.forEach((crystal) => {
    crystal.active = true;
    crystal.timer = 0;
  });
  room.movers.forEach((mover) => {
    mover.currentX = mover.startX;
    mover.currentY = mover.startY;
    mover.prevX = mover.startX;
    mover.prevY = mover.startY;
  });
}

function startRun() {
  state.mode = "playing";
  state.currentRoomId = "ridge-1";
  state.checkpoint = { roomId: "ridge-1", x: rooms.get("ridge-1").spawn.x, y: rooms.get("ridge-1").spawn.y };
  state.deaths = 0;
  state.timer = 0;
  state.finished = false;
  state.berriesCollected.clear();
  rooms.forEach((room) => resetRoomDynamics(room));
  respawnAtCheckpoint();
  hideOverlay();
}

startButton.addEventListener("click", () => {
  if (state.mode === "paused") {
    state.mode = "playing";
    hideOverlay();
  } else if (state.finished || state.mode === "menu") {
    startRun();
  } else if (state.mode === "dead") {
    respawnAtCheckpoint();
    state.mode = "playing";
    hideOverlay();
  }
});

function respawnAtCheckpoint() {
  state.currentRoomId = state.checkpoint.roomId;
  const room = currentRoom();
  resetRoomDynamics(room);
  player.x = state.checkpoint.x;
  player.y = state.checkpoint.y;
  player.vx = 0;
  player.vy = 0;
  player.dashCharges = 1;
  player.dashTimer = 0;
  player.dashCooldown = 0;
  player.onGround = false;
  player.coyote = 0;
  player.jumpBuffer = 0;
  player.wallGrace = 0;
  player.respawnFlash = 0.4;
}

function getCollisionSolids(room) {
  const solids = [...room.solids];
  room.crumbles.forEach((block) => {
    if (block.state !== "gone") {
      solids.push(block);
    }
  });
  room.movers.forEach((mover) => {
    solids.push({
      x: mover.currentX,
      y: mover.currentY,
      w: mover.w,
      h: mover.h,
      moving: true,
      mover,
    });
  });
  return solids;
}

function collidesAt(room, x, y) {
  const rect = { x, y, w: player.w, h: player.h };
  return getCollisionSolids(room).find((solid) => overlap(rect, solid));
}

function moveX(room, amount) {
  const step = Math.sign(amount);
  let remaining = Math.abs(amount);
  while (remaining > 0) {
    const solid = collidesAt(room, player.x + step, player.y);
    if (solid) {
      player.vx = 0;
      return solid;
    }
    player.x += step;
    remaining -= 1;
  }
  return null;
}

function moveY(room, amount) {
  const step = Math.sign(amount);
  let remaining = Math.abs(amount);
  player.onGround = false;
  while (remaining > 0) {
    const solid = collidesAt(room, player.x, player.y + step);
    if (solid) {
      if (step > 0) {
        player.onGround = true;
      }
      player.vy = 0;
      return solid;
    }
    player.y += step;
    remaining -= 1;
  }
  return null;
}

function onCrumble(room, solid) {
  if (!solid) return;
  const block = room.crumbles.find((candidate) => candidate === solid);
  if (block && block.state === "solid") {
    block.state = "shaking";
    block.timer = 0.22;
  }
}

function killPlayer(reason) {
  if (state.mode !== "playing") return;
  state.deaths += 1;
  state.mode = "dead";
  showOverlay(
    "Reset",
    `${reason} Death ${state.deaths}. R or the button will restart from the latest checkpoint.`,
    "Retry"
  );
}

function setCheckpoint(checkpoint) {
  state.checkpoint = {
    roomId: state.currentRoomId,
    x: checkpoint.x,
    y: checkpoint.y - 2,
  };
}

function transition(direction) {
  const room = currentRoom();
  const nextId = room.exits[direction];
  if (!nextId) {
    killPlayer("No room beyond the void.");
    return;
  }

  state.currentRoomId = nextId;
  const nextRoom = currentRoom();
  resetRoomDynamics(nextRoom);

  if (direction === "right") {
    player.x = 2;
  } else if (direction === "left") {
    player.x = WORLD_W - player.w - 2;
  } else if (direction === "up") {
    player.y = WORLD_H - player.h - 2;
  } else if (direction === "down") {
    player.y = 2;
  }
}

function refreshHud() {
  roomNameEl.textContent = currentRoom().name;
  progressStatEl.textContent = roomProgressLabel();
  deathCountEl.textContent = String(state.deaths);
  berryCountEl.textContent = `${state.berriesCollected.size} / ${countTotalBerries()}`;
  timerEl.textContent = formatTime(state.timer);
  bestTimeEl.textContent = state.bestTime == null ? "--:--.---" : formatTime(state.bestTime);
  bestDeathsEl.textContent = state.bestDeaths == null ? "--" : String(state.bestDeaths);
}

function countTotalBerries() {
  let count = 0;
  rooms.forEach((room) => {
    count += room.berries.length;
  });
  return count;
}

function updateRoomEntities(room, dt) {
  room.crumbles.forEach((block) => {
    if (block.state === "shaking") {
      block.timer -= dt;
      if (block.timer <= 0) {
        block.state = "gone";
        block.timer = 1.4;
      }
    } else if (block.state === "gone") {
      block.timer -= dt;
      if (block.timer <= 0) {
        block.state = "solid";
      }
    }
  });

  room.crystals.forEach((crystal) => {
    if (!crystal.active) {
      crystal.timer -= dt;
      if (crystal.timer <= 0) crystal.active = true;
    }
  });

  room.movers.forEach((mover) => {
    mover.prevX = mover.currentX;
    mover.prevY = mover.currentY;
    const phase = performance.now() / 1000 * mover.speed + mover.phase;
    mover.currentX = mover.startX + Math.sin(phase) * mover.dx;
    mover.currentY = mover.startY + Math.cos(phase) * mover.dy;
  });
}

function updatePlayer(dt) {
  const room = currentRoom();
  updateRoomEntities(room, dt);

  player.respawnFlash = Math.max(0, player.respawnFlash - dt);
  player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
  player.coyote = Math.max(0, player.coyote - dt);
  player.wallGrace = Math.max(0, player.wallGrace - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);

  if (btnPressed("restart")) {
    killPlayer("Manual reset.");
  }

  if (btnPressed("pause")) {
    state.mode = "paused";
    showOverlay("Paused", "Press Begin Run to continue this climb from the latest checkpoint.", "Resume");
    return;
  }

  if (btnPressed("jump")) player.jumpBuffer = 0.14;
  if (btnPressed("dash")) player.dashBuffer = 0.12;
  player.dashBuffer = Math.max(0, player.dashBuffer - dt);

  const inputX = (btn("right") ? 1 : 0) - (btn("left") ? 1 : 0);
  const inputY = (btn("down") ? 1 : 0) - (btn("up") ? 1 : 0);

  if (inputX !== 0) player.facing = inputX;

  const touchingLeft = !!collidesAt(room, player.x - 1, player.y);
  const touchingRight = !!collidesAt(room, player.x + 1, player.y);
  player.wallDir = touchingLeft ? -1 : touchingRight ? 1 : 0;
  if (player.wallDir !== 0) player.wallGrace = 0.08;

  if (player.onGround) {
    player.coyote = 0.11;
    player.dashCharges = 1;
  }

  if (player.jumpBuffer > 0) {
    if (player.coyote > 0) {
      player.vy = -172;
      player.jumpBuffer = 0;
      player.coyote = 0;
      player.onGround = false;
    } else if (player.wallGrace > 0 && player.wallDir !== 0) {
      player.vy = -166;
      player.vx = -player.wallDir * 145;
      player.jumpBuffer = 0;
      player.wallGrace = 0;
    }
  }

  if (player.dashBuffer > 0 && player.dashCharges > 0 && player.dashCooldown <= 0) {
    let dx = inputX;
    let dy = inputY;
    if (dx === 0 && dy === 0) dx = player.facing;
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    player.dashCharges -= 1;
    player.dashTimer = 0.17;
    player.dashCooldown = 0.22;
    player.vx = dx * 214;
    player.vy = dy * 214;
    player.dashBuffer = 0;
  }

  if (player.dashTimer > 0) {
    player.dashTimer -= dt;
    player.vx = approach(player.vx, 0, 180 * dt);
    player.vy = approach(player.vy, 0, 180 * dt);
  } else {
    const accel = player.onGround ? 700 : 460;
    const maxSpeed = player.onGround ? 92 : 86;
    player.vx = approach(player.vx, inputX * maxSpeed, accel * dt);
    if (inputX === 0 && player.onGround) player.vx = approach(player.vx, 0, 880 * dt);

    const wallSliding = player.wallDir !== 0 && !player.onGround && inputX === player.wallDir && player.vy > 0;
    const gravity = wallSliding ? 310 : btn("jump") && player.vy < 0 ? 360 : 620;
    player.vy = clamp(player.vy + gravity * dt, -220, wallSliding ? 54 : 188);
  }

  const standingOnMover = room.movers.find((mover) =>
    player.vy >= 0 &&
    player.x + player.w > mover.currentX &&
    player.x < mover.currentX + mover.w &&
    Math.abs(player.y + player.h - mover.currentY) <= 2
  );
  if (standingOnMover) {
    player.x += standingOnMover.currentX - standingOnMover.prevX;
    player.y += standingOnMover.currentY - standingOnMover.prevY;
  }

  const hitX = moveX(room, Math.round(player.vx * dt));
  if (hitX && player.wallDir !== 0) player.wallGrace = 0.08;
  const hitY = moveY(room, Math.round(player.vy * dt));
  if (hitY && player.onGround) onCrumble(room, hitY);

  room.hazards.forEach((hazard) => {
    if (overlap(player, hazard)) killPlayer("Spikes won.");
  });

  room.springs.forEach((spring) => {
    if (overlap(player, spring) && player.vy >= 0) {
      player.vy = -220;
      player.dashCharges = 1;
    }
  });

  room.crystals.forEach((crystal) => {
    if (crystal.active && overlap(player, crystal)) {
      crystal.active = false;
      crystal.timer = 2.1;
      player.dashCharges = 1;
    }
  });

  room.berries.forEach((berry) => {
    if (!state.berriesCollected.has(berry.id) && overlap(player, berry)) {
      state.berriesCollected.add(berry.id);
    }
  });

  room.checkpoints.forEach((checkpoint) => {
    if (overlap(player, checkpoint)) setCheckpoint(checkpoint);
  });

  if (room.goal && overlap(player, room.goal)) {
    state.finished = true;
    state.mode = "finished";
    if (state.bestTime == null || state.timer < state.bestTime) {
      state.bestTime = state.timer;
    }
    if (state.bestDeaths == null || state.deaths < state.bestDeaths) {
      state.bestDeaths = state.deaths;
    }
    saveBestStats();
    showOverlay(
      "Summit Cleared",
      `Finished in ${formatTime(state.timer)} with ${state.deaths} deaths and ${state.berriesCollected.size}/${countTotalBerries()} berries.`,
      "Run Again"
    );
    return;
  }

  if (player.y > WORLD_H + 12) killPlayer("The mountain dropped you.");
  if (player.x < -player.w) transition("left");
  if (player.x > WORLD_W) transition("right");
  if (player.y < -player.h) transition("up");
  if (player.y > WORLD_H) transition("down");
}

function drawRoom(room) {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, room.colorA);
  grad.addColorStop(1, room.colorB);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 22; i += 1) {
    ctx.fillStyle = `rgba(255,255,255,${0.03 + (i % 3) * 0.015})`;
    const x = (i * 31 + performance.now() * 0.01 * ((i % 4) + 1)) % canvas.width;
    const y = (i * 19) % canvas.height;
    ctx.beginPath();
    ctx.arc(x, y, (i % 4) + 1, 0, Math.PI * 2);
    ctx.fill();
  }

  room.solids.forEach((solid) => {
    ctx.fillStyle = "#24374f";
    ctx.fillRect(solid.x, solid.y, solid.w, solid.h);
    ctx.fillStyle = "#4a6c93";
    ctx.fillRect(solid.x + 1, solid.y + 1, solid.w - 2, 4);
  });

  room.crumbles.forEach((block) => {
    if (block.state === "gone") return;
    const shake = block.state === "shaking" ? (Math.random() > 0.5 ? 1 : -1) : 0;
    ctx.fillStyle = "#8b6f57";
    ctx.fillRect(block.x + shake, block.y, block.w, block.h);
    ctx.fillStyle = "#d0a37b";
    ctx.fillRect(block.x + 2 + shake, block.y + 2, block.w - 4, block.h - 7);
  });

  room.movers.forEach((mover) => {
    ctx.fillStyle = "#2e455c";
    ctx.fillRect(mover.currentX, mover.currentY, mover.w, mover.h);
    ctx.fillStyle = "#81f4e1";
    ctx.fillRect(mover.currentX + 2, mover.currentY + 2, mover.w - 4, 4);
  });

  room.hazards.forEach((hazard) => {
    ctx.fillStyle = "#ff6b6b";
    ctx.beginPath();
    if (hazard.dir === "up") {
      ctx.moveTo(hazard.x, hazard.y + hazard.h);
      ctx.lineTo(hazard.x + hazard.w / 2, hazard.y);
      ctx.lineTo(hazard.x + hazard.w, hazard.y + hazard.h);
    } else if (hazard.dir === "down") {
      ctx.moveTo(hazard.x, hazard.y);
      ctx.lineTo(hazard.x + hazard.w / 2, hazard.y + hazard.h);
      ctx.lineTo(hazard.x + hazard.w, hazard.y);
    } else if (hazard.dir === "left") {
      ctx.moveTo(hazard.x + hazard.w, hazard.y);
      ctx.lineTo(hazard.x, hazard.y + hazard.h / 2);
      ctx.lineTo(hazard.x + hazard.w, hazard.y + hazard.h);
    } else {
      ctx.moveTo(hazard.x, hazard.y);
      ctx.lineTo(hazard.x + hazard.w, hazard.y + hazard.h / 2);
      ctx.lineTo(hazard.x, hazard.y + hazard.h);
    }
    ctx.closePath();
    ctx.fill();
  });

  room.springs.forEach((spring) => {
    ctx.fillStyle = "#4de18b";
    ctx.fillRect(spring.x, spring.y, spring.w, spring.h);
    ctx.fillStyle = "#d8ffee";
    ctx.fillRect(spring.x + 2, spring.y + 2, spring.w - 4, 3);
  });

  room.crystals.forEach((crystal) => {
    ctx.fillStyle = crystal.active ? "#78f6ff" : "rgba(120,246,255,0.25)";
    ctx.beginPath();
    ctx.moveTo(crystal.x + crystal.w / 2, crystal.y);
    ctx.lineTo(crystal.x + crystal.w, crystal.y + crystal.h / 2);
    ctx.lineTo(crystal.x + crystal.w / 2, crystal.y + crystal.h);
    ctx.lineTo(crystal.x, crystal.y + crystal.h / 2);
    ctx.closePath();
    ctx.fill();
  });

  room.berries.forEach((berry) => {
    if (state.berriesCollected.has(berry.id)) return;
    ctx.fillStyle = "#ff4fa3";
    ctx.beginPath();
    ctx.arc(berry.x + 4, berry.y + 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8affad";
    ctx.fillRect(berry.x + 3, berry.y - 1, 2, 3);
  });

  room.checkpoints.forEach((checkpoint) => {
    ctx.fillStyle = "rgba(255, 209, 102, 0.22)";
    ctx.fillRect(checkpoint.x, checkpoint.y, checkpoint.w, checkpoint.h);
    if (state.checkpoint.roomId === state.currentRoomId && Math.abs(state.checkpoint.x - checkpoint.x) < 3) {
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(checkpoint.x + 4, checkpoint.y - 6, 4, 8);
    }
  });

  if (room.goal) {
    ctx.fillStyle = "#fff4ba";
    ctx.fillRect(room.goal.x, room.goal.y, room.goal.w, room.goal.h);
    ctx.fillStyle = "#f28ea8";
    ctx.fillRect(room.goal.x + 4, room.goal.y - 10, 3, 10);
  }
}

function drawPlayer() {
  ctx.save();
  if (player.respawnFlash > 0) {
    ctx.globalAlpha = 0.45 + player.respawnFlash;
  }
  ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
  ctx.scale(player.facing, 1);
  ctx.fillStyle = player.dashTimer > 0 ? "#ffe27a" : "#fff7fc";
  ctx.fillRect(-5, -7, 10, 14);
  ctx.fillStyle = "#ff6fae";
  ctx.fillRect(-4, -6, 8, 6);
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, -2, 2, 2);
  ctx.restore();
}

function drawHudOverlay() {
  ctx.fillStyle = "rgba(4, 8, 16, 0.25)";
  ctx.fillRect(6, 6, 96, 26);
  ctx.fillStyle = "#ffffff";
  ctx.font = "10px Space Grotesk";
  ctx.fillText(currentRoom().name, 12, 17);
  ctx.fillText(`Deaths ${state.deaths}`, 12, 28);

  for (let i = 0; i < player.dashCharges; i += 1) {
    ctx.fillStyle = "#78f6ff";
    ctx.fillRect(canvas.width - 20 - i * 10, 10, 8, 8);
  }
}

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(1 / 30, (now - lastTime) / 1000);
  lastTime = now;

  if (state.mode === "playing") {
    state.timer += dt;
    updatePlayer(dt);
  }

  drawRoom(currentRoom());
  drawPlayer();
  drawHudOverlay();
  refreshHud();

  pressed.clear();
  virtualPressed.clear();
  requestAnimationFrame(frame);
}

showOverlay(
  "Start Climb",
  "This prototype already has a full room chain. Learn the dash rhythm, use wall jumps aggressively, and expect the later summit rooms to punish hesitation."
);
bindTouchControls();
respawnAtCheckpoint();
refreshHud();
requestAnimationFrame(frame);
