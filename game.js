const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const gamePanel = document.querySelector(".game-panel");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayBody = document.getElementById("overlayBody");
const startButton = document.getElementById("startButton");

const TILE = 16;
const ROOM_W = 24;
const ROOM_H = 14;
const WORLD_W = ROOM_W * TILE;
const WORLD_H = ROOM_H * TILE;

const keys = new Set();
const pressed = new Set();
const virtualHeld = new Set();
const virtualPressed = new Set();
const gamepadHeld = new Set();
const gamepadPressed = new Set();

const inputMap = {
  left: ["ArrowLeft", "a", "A"],
  right: ["ArrowRight", "d", "D"],
  up: ["ArrowUp", "w", "W"],
  down: ["ArrowDown", "s", "S"],
  jump: ["ArrowUp", "w", "W", "z", "Z", "c", "C", "k", "K", " "],
  dash: ["x", "X", "j", "J", "Shift"],
  restart: ["r", "R", "Backspace"],
  pause: ["Escape", "Enter"],
};

const ACTIONS = ["left", "right", "up", "down", "jump", "dash", "restart", "pause"];
const INPUT_KEYS = new Set(Object.values(inputMap).flat());
const actionKeySets = Object.fromEntries(
  Object.entries(inputMap).map(([action, keysForAction]) => [action, new Set(keysForAction)])
);
const GAMEPAD_BUTTONS = {
  jump: [0],
  dash: [1, 5],
  restart: [3],
  pause: [9],
  left: [14],
  right: [15],
  up: [12],
  down: [13],
};

document.addEventListener("keydown", (event) => {
  if (!keys.has(event.key)) {
    pressed.add(event.key);
  }
  keys.add(event.key);
  if (INPUT_KEYS.has(event.key)) {
    event.preventDefault();
  }
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

function btn(name) {
  if (virtualHeld.has(name) || gamepadHeld.has(name)) return true;
  for (const key of actionKeySets[name]) {
    if (keys.has(key)) return true;
  }
  return false;
}

function btnPressed(name) {
  if (virtualPressed.has(name) || gamepadPressed.has(name)) return true;
  for (const key of actionKeySets[name]) {
    if (pressed.has(key)) return true;
  }
  return false;
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

const STARFIELD = Array.from({ length: 28 }, (_, index) => ({
  x: (index * 31) % WORLD_W,
  y: (index * 19) % 92,
  speed: 2 + (index % 5),
  size: 1 + (index % 3),
  alpha: 0.05 + (index % 4) * 0.018,
}));

const PLAYER_POSE_FILES = {
  stand: "./assets/kenney-platformer-characters/PNG/Player/Poses/player_stand.png",
  idle: "./assets/kenney-platformer-characters/PNG/Player/Poses/player_idle.png",
  walk1: "./assets/kenney-platformer-characters/PNG/Player/Poses/player_walk1.png",
  walk2: "./assets/kenney-platformer-characters/PNG/Player/Poses/player_walk2.png",
  jump: "./assets/kenney-platformer-characters/PNG/Player/Poses/player_jump.png",
  fall: "./assets/kenney-platformer-characters/PNG/Player/Poses/player_fall.png",
  dash: "./assets/kenney-platformer-characters/PNG/Player/Poses/player_skid.png",
};

const playerPoseImages = Object.fromEntries(
  Object.entries(PLAYER_POSE_FILES).map(([key, src]) => {
    const image = new Image();
    image.src = src;
    return [key, image];
  })
);

// Walk animation is intentionally disabled for now because the external pose
// frames were still reading as unstable at gameplay scale.
// const PLAYER_WALK_SEQUENCE = ["walk1", "walk2"];
const PLAYER_POSE_OFFSETS = {
  idle: { x: 0, y: 0 },
  stand: { x: 0, y: 0 },
  walk1: { x: 1, y: 0 },
  walk2: { x: -1, y: 0 },
  jump: { x: 0, y: 0 },
  fall: { x: -1, y: 0 },
  dash: { x: -3, y: 0 },
  brake: { x: 0, y: 0 },
};
const PLAYER_SPRITE_DRAW_W = 14;
const PLAYER_SPRITE_DRAW_H = 19;

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
    name: "Summit 3",
    colorA: "#a77ed1",
    colorB: "#fff2f7",
    exits: { left: "summit-2", right: "summit-4" },
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
      ".......................>",
      "P.......................",
      "##########..##########.#",
      "########################",
    ],
    movers: [
      { x: 16 * TILE, y: 8 * TILE, w: 2 * TILE, h: TILE, dx: 0, dy: -46, speed: 0.95 },
    ],
  },
  {
    id: "summit-4",
    name: "Skybreak",
    colorA: "#9b6cc8",
    colorB: "#ffd9f6",
    exits: { left: "summit-3", up: "summit-5" },
    map: [
      "##########....##########",
      "#......................#",
      "#.............s........#",
      "#...*..................#",
      "#......^^^^....^^^^....#",
      "#.............####.....#",
      "#...r..................#",
      "#.........*............#",
      "#..####...........####.#",
      "#.............r........#",
      "#...B..................#",
      "#..P...................#",
      "######..........########",
      "########################",
    ],
    movers: [
      { x: 9 * TILE, y: 7 * TILE, w: 2 * TILE, h: TILE, dx: 6 * TILE, dy: 0, speed: 1.45 },
      { x: 14 * TILE, y: 4 * TILE, w: 2 * TILE, h: TILE, dx: 0, dy: -40, speed: 1.05 },
    ],
  },
  {
    id: "summit-5",
    name: "Summit Gate",
    colorA: "#a570d7",
    colorB: "#fff2f7",
    exits: { down: "summit-4" },
    map: [
      "########################",
      "#......................#",
      "#..........s...........#",
      "#....*.............*...#",
      "#..^^^^....####....^^^.#",
      "#......................#",
      "#......r..........r....#",
      "#...........####.......#",
      "#..B...................#",
      "#.................*....#",
      "#.............####..g..#",
      "#..P...................#",
      "##########..##########.#",
      "########################",
    ],
    movers: [
      { x: 5 * TILE, y: 9 * TILE, w: 2 * TILE, h: TILE, dx: 5 * TILE, dy: 0, speed: 1.6 },
    ],
  },
];

function parseRoom(def, index) {
  const room = {
    ...def,
    solids: [],
    solidMask: Array.from({ length: ROOM_H }, () => Array.from({ length: ROOM_W }, () => false)),
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
      if (char === "#") {
        room.solids.push({ x: px, y: py, w: TILE, h: TILE });
        room.solidMask[y][x] = true;
      }
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
      if (char === "P") room.spawn = { x: px + 3, y: py + 2 };
    });
  });

  room.berryTotal = room.berries.length;
  room.progressLabel = `${index + 1} / ${roomDefs.length}`;
  return room;
}

const rooms = new Map(roomDefs.map((def, index) => [def.id, parseRoom(def, index)]));
const roomOrder = roomDefs.map((def) => def.id);
const TOTAL_BERRIES = roomDefs.reduce((sum, def) => sum + [...def.map.join("")].filter((char) => char === "s").length, 0);
const STORAGE_KEY = "needle-peak-best-v1";

function buildRoomStaticLayer(room) {
  const layer = document.createElement("canvas");
  layer.width = WORLD_W;
  layer.height = WORLD_H;
  const layerCtx = layer.getContext("2d");

  const grad = layerCtx.createLinearGradient(0, 0, 0, WORLD_H);
  grad.addColorStop(0, room.colorA);
  grad.addColorStop(1, room.colorB);
  layerCtx.fillStyle = grad;
  layerCtx.fillRect(0, 0, WORLD_W, WORLD_H);

  const skyGlow = layerCtx.createRadialGradient(WORLD_W * 0.72, 38, 6, WORLD_W * 0.72, 38, 110);
  skyGlow.addColorStop(0, "rgba(255, 242, 186, 0.34)");
  skyGlow.addColorStop(1, "rgba(255, 242, 186, 0)");
  layerCtx.fillStyle = skyGlow;
  layerCtx.fillRect(0, 0, WORLD_W, 140);

  const haze = layerCtx.createLinearGradient(0, 0, 0, 140);
  haze.addColorStop(0, "rgba(255,255,255,0.06)");
  haze.addColorStop(1, "rgba(255,255,255,0)");
  layerCtx.fillStyle = haze;
  layerCtx.fillRect(0, 0, WORLD_W, 140);

  layerCtx.fillStyle = "rgba(10, 20, 34, 0.24)";
  layerCtx.beginPath();
  layerCtx.moveTo(0, 124);
  layerCtx.lineTo(48, 88);
  layerCtx.lineTo(92, 116);
  layerCtx.lineTo(140, 68);
  layerCtx.lineTo(196, 110);
  layerCtx.lineTo(252, 72);
  layerCtx.lineTo(316, 118);
  layerCtx.lineTo(384, 94);
  layerCtx.lineTo(384, 224);
  layerCtx.lineTo(0, 224);
  layerCtx.closePath();
  layerCtx.fill();

  layerCtx.fillStyle = "rgba(5, 11, 21, 0.28)";
  layerCtx.beginPath();
  layerCtx.moveTo(0, 150);
  layerCtx.lineTo(58, 104);
  layerCtx.lineTo(100, 138);
  layerCtx.lineTo(150, 92);
  layerCtx.lineTo(220, 142);
  layerCtx.lineTo(264, 110);
  layerCtx.lineTo(332, 154);
  layerCtx.lineTo(384, 122);
  layerCtx.lineTo(384, 224);
  layerCtx.lineTo(0, 224);
  layerCtx.closePath();
  layerCtx.fill();

  room.solids.forEach((solid) => {
    const tileGrad = layerCtx.createLinearGradient(solid.x, solid.y, solid.x, solid.y + solid.h);
    tileGrad.addColorStop(0, "#35506f");
    tileGrad.addColorStop(1, "#172334");
    layerCtx.fillStyle = tileGrad;
    layerCtx.fillRect(solid.x, solid.y, solid.w, solid.h);
    layerCtx.fillStyle = "#73a3db";
    layerCtx.fillRect(solid.x + 1, solid.y + 1, solid.w - 2, 4);
    layerCtx.fillStyle = "rgba(7, 12, 20, 0.35)";
    layerCtx.fillRect(solid.x + 1, solid.y + solid.h - 3, solid.w - 2, 2);
    layerCtx.fillStyle = "rgba(255,255,255,0.05)";
    layerCtx.fillRect(solid.x + 2, solid.y + 6, solid.w - 8, 1);
    layerCtx.fillRect(solid.x + 4, solid.y + 10, solid.w - 10, 1);
  });

  room.hazards.forEach((hazard) => {
    layerCtx.fillStyle = "#ff6b6b";
    layerCtx.beginPath();
    if (hazard.dir === "up") {
      layerCtx.moveTo(hazard.x, hazard.y + hazard.h);
      layerCtx.lineTo(hazard.x + hazard.w / 2, hazard.y);
      layerCtx.lineTo(hazard.x + hazard.w, hazard.y + hazard.h);
    } else if (hazard.dir === "down") {
      layerCtx.moveTo(hazard.x, hazard.y);
      layerCtx.lineTo(hazard.x + hazard.w / 2, hazard.y + hazard.h);
      layerCtx.lineTo(hazard.x + hazard.w, hazard.y);
    } else if (hazard.dir === "left") {
      layerCtx.moveTo(hazard.x + hazard.w, hazard.y);
      layerCtx.lineTo(hazard.x, hazard.y + hazard.h / 2);
      layerCtx.lineTo(hazard.x + hazard.w, hazard.y + hazard.h);
    } else {
      layerCtx.moveTo(hazard.x, hazard.y);
      layerCtx.lineTo(hazard.x + hazard.w, hazard.y + hazard.h / 2);
      layerCtx.lineTo(hazard.x, hazard.y + hazard.h);
    }
    layerCtx.closePath();
    layerCtx.fill();
    layerCtx.strokeStyle = "rgba(255,255,255,0.22)";
    layerCtx.lineWidth = 1;
    layerCtx.stroke();
  });

  room.staticLayer = layer;
}

rooms.forEach((room) => buildRoomStaticLayer(room));

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
  visualTime: 0,
  transitionCooldown: 0,
  roomIntroTimer: 1.8,
  transitionFlash: 0,
  gamepadActive: false,
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
  trail: [],
  trailTimer: 0,
  moveIntentX: 0,
  walkFrame: 0,
  walkFrameTimer: 0,
};

const tileCollisionHit = { x: 0, y: 0, w: TILE, h: TILE };

function currentRoom() {
  return rooms.get(state.currentRoomId);
}

function roomProgressLabel() {
  return currentRoom().progressLabel;
}

function bestTimeLabel() {
  return state.bestTime == null ? "--:--.---" : formatTime(state.bestTime);
}

function bestDeathsLabel() {
  return state.bestDeaths == null ? "--" : String(state.bestDeaths);
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

function setActionHeld(setRef, action, active) {
  if (active) {
    if (!setRef.has(action)) {
      if (setRef === gamepadHeld) {
        gamepadPressed.add(action);
      }
    }
    setRef.add(action);
  } else {
    setRef.delete(action);
  }
}

function updateGamepadInput() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let pad = null;
  for (let i = 0; i < pads.length; i += 1) {
    if (pads[i]) {
      pad = pads[i];
      break;
    }
  }
  state.gamepadActive = !!pad;

  if (!pad) {
    gamepadHeld.clear();
    return;
  }

  const axisX = pad.axes[0] || 0;
  const axisY = pad.axes[1] || 0;

  setActionHeld(gamepadHeld, "left", axisX < -0.38 || !!pad.buttons[14]?.pressed);
  setActionHeld(gamepadHeld, "right", axisX > 0.38 || !!pad.buttons[15]?.pressed);
  setActionHeld(gamepadHeld, "up", axisY < -0.5 || !!pad.buttons[12]?.pressed);
  setActionHeld(gamepadHeld, "down", axisY > 0.5 || !!pad.buttons[13]?.pressed);

  for (const action of ACTIONS) {
    if (action === "left" || action === "right" || action === "up" || action === "down") continue;
    const pressedNow = (GAMEPAD_BUTTONS[action] || []).some((index) => pad.buttons[index]?.pressed);
    setActionHeld(gamepadHeld, action, pressedNow);
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
  state.roomIntroTimer = 2.2;
  state.transitionCooldown = 0;
  state.transitionFlash = 0;
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
  player.trail = [];
  player.trailTimer = 0;
  player.moveIntentX = 0;
  player.walkFrame = 0;
  player.walkFrameTimer = 0;
  state.transitionCooldown = 0.15;
  state.transitionFlash = 0.28;
  state.roomIntroTimer = 1.25;
}

function overlapRect(x, y, w, h, target) {
  return x < target.x + target.w && x + w > target.x && y < target.y + target.h && y + h > target.y;
}

function collidesAt(room, x, y) {
  const leftTile = clamp(Math.floor(x / TILE), 0, ROOM_W - 1);
  const rightTile = clamp(Math.floor((x + player.w - 1) / TILE), 0, ROOM_W - 1);
  const topTile = clamp(Math.floor(y / TILE), 0, ROOM_H - 1);
  const bottomTile = clamp(Math.floor((y + player.h - 1) / TILE), 0, ROOM_H - 1);

  for (let ty = topTile; ty <= bottomTile; ty += 1) {
    for (let tx = leftTile; tx <= rightTile; tx += 1) {
      if (room.solidMask[ty][tx]) {
        tileCollisionHit.x = tx * TILE;
        tileCollisionHit.y = ty * TILE;
        return tileCollisionHit;
      }
    }
  }
  for (const block of room.crumbles) {
    if (block.state !== "gone" && overlapRect(x, y, player.w, player.h, block)) return block;
  }
  for (const mover of room.movers) {
    if (overlapRect(x, y, player.w, player.h, mover)) return mover;
  }
  return null;
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

function applyTransitionSpawn(direction) {
  if (direction === "right") {
    player.x = 3;
    player.y = clamp(player.y, 12, WORLD_H - player.h - 18);
  } else if (direction === "left") {
    player.x = WORLD_W - player.w - 3;
    player.y = clamp(player.y, 12, WORLD_H - player.h - 18);
  } else if (direction === "up") {
    player.y = WORLD_H - player.h - 3;
    player.x = clamp(player.x, 12, WORLD_W - player.w - 12);
  } else if (direction === "down") {
    player.y = 3;
    player.x = clamp(player.x, 12, WORLD_W - player.w - 12);
  }
}

function transition(direction) {
  if (state.transitionCooldown > 0) return;
  const room = currentRoom();
  const nextId = room.exits[direction];
  if (!nextId) {
    killPlayer("No room beyond the void.");
    return;
  }

  state.currentRoomId = nextId;
  const nextRoom = currentRoom();
  resetRoomDynamics(nextRoom);
  applyTransitionSpawn(direction);
  player.dashCharges = Math.max(1, player.dashCharges);
  player.trail = [];
  state.transitionCooldown = 0.18;
  state.transitionFlash = 0.16;
  state.roomIntroTimer = 1.2;
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
    const phase = state.visualTime * mover.speed + mover.phase;
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
  state.transitionCooldown = Math.max(0, state.transitionCooldown - dt);
  state.roomIntroTimer = Math.max(0, state.roomIntroTimer - dt);
  state.transitionFlash = Math.max(0, state.transitionFlash - dt * 1.5);

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
  player.moveIntentX = inputX;

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

  player.trailTimer -= dt;
  if (player.dashTimer > 0 || Math.abs(player.vx) > 70 || Math.abs(player.vy) > 110) {
  if (player.trailTimer <= 0) {
      player.trail.push({
        x: player.x,
        y: player.y,
        t: player.dashTimer > 0 ? 0.2 : 0.1,
      });
      player.trailTimer = player.dashTimer > 0 ? 0.016 : 0.035;
    }
  }
  let nextTrailLength = 0;
  for (let i = 0; i < player.trail.length; i += 1) {
    const afterimage = player.trail[i];
    afterimage.t -= dt;
    if (afterimage.t > 0) {
      player.trail[nextTrailLength] = afterimage;
      nextTrailLength += 1;
    }
  }
  player.trail.length = nextTrailLength;
  if (player.trail.length > 6) {
    player.trail.splice(0, player.trail.length - 6);
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

  const groundedMovement = player.onGround && inputX !== 0 && Math.abs(player.vx) > 28;
  if (groundedMovement) {
    player.walkFrame = 0;
    player.walkFrameTimer = 0;
  } else {
    player.walkFrame = 0;
    player.walkFrameTimer = 0;
  }

  const standingOnMover = room.movers.find((mover) => (
    player.vy >= 0 &&
    player.x + player.w > mover.currentX &&
    player.x < mover.currentX + mover.w &&
    Math.abs(player.y + player.h - mover.currentY) <= 2
  ));
  if (standingOnMover) {
    player.x += standingOnMover.currentX - standingOnMover.prevX;
    player.y += standingOnMover.currentY - standingOnMover.prevY;
  }

  const hitX = moveX(room, Math.round(player.vx * dt));
  if (hitX && player.wallDir !== 0) player.wallGrace = 0.08;
  const hitY = moveY(room, Math.round(player.vy * dt));
  if (hitY && player.onGround) onCrumble(room, hitY);

  for (const hazard of room.hazards) {
    if (overlap(player, hazard)) {
      killPlayer("Spikes won.");
      return;
    }
  }

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
      state.roomIntroTimer = Math.max(state.roomIntroTimer, 0.35);
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
      `Finished in ${formatTime(state.timer)} with ${state.deaths} deaths and ${state.berriesCollected.size}/${TOTAL_BERRIES} berries.`,
      "Run Again"
    );
    return;
  }

  if (player.x < -player.w) transition("left");
  if (player.x > WORLD_W) transition("right");
  if (player.y < -player.h) transition("up");
  if (player.y > WORLD_H && currentRoom().exits.down) {
    transition("down");
  } else if (player.y > WORLD_H + 18) {
    killPlayer("The mountain dropped you.");
  }
}

function drawRoom(room) {
  ctx.drawImage(room.staticLayer, 0, 0);

  STARFIELD.forEach((star) => {
    ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
    const x = (star.x + state.visualTime * star.speed) % WORLD_W;
    const y = star.y + Math.sin(state.visualTime * 0.8 + star.x) * 1.5;
    ctx.beginPath();
    ctx.arc(x, y, star.size, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "rgba(255,255,255,0.025)";
  for (let i = 0; i < 6; i += 1) {
    const bandY = 70 + i * 18 + Math.sin(state.visualTime * 0.6 + i) * 2;
    ctx.fillRect(0, bandY, WORLD_W, 1);
  }

  room.crumbles.forEach((block) => {
    if (block.state === "gone") return;
    const shake = block.state === "shaking" ? ((((block.x + block.y + Math.floor(state.visualTime * 40)) & 1) === 0) ? -1 : 1) : 0;
    ctx.fillStyle = block.state === "shaking" ? "#9a7154" : "#7d624d";
    ctx.fillRect(block.x + shake, block.y, block.w, block.h);
    ctx.fillStyle = "#d0a37b";
    ctx.fillRect(block.x + 2 + shake, block.y + 2, block.w - 4, block.h - 7);
    ctx.fillStyle = "rgba(255, 226, 180, 0.22)";
    ctx.fillRect(block.x + 2 + shake, block.y + 3, block.w - 4, 2);
  });

  room.movers.forEach((mover) => {
    ctx.fillStyle = "#213243";
    ctx.fillRect(mover.currentX, mover.currentY, mover.w, mover.h);
    ctx.fillStyle = "#81f4e1";
    ctx.fillRect(mover.currentX + 2, mover.currentY + 2, mover.w - 4, 4);
    ctx.fillStyle = "rgba(129, 244, 225, 0.18)";
    ctx.fillRect(mover.currentX + 1, mover.currentY + 1, mover.w - 2, mover.h - 2);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(mover.currentX + 3, mover.currentY + 7, mover.w - 8, 1);
  });

  room.springs.forEach((spring) => {
    ctx.fillStyle = "#36c970";
    ctx.fillRect(spring.x, spring.y, spring.w, spring.h);
    ctx.fillStyle = "#d8ffee";
    ctx.fillRect(spring.x + 2, spring.y + 2, spring.w - 4, 3);
    ctx.fillStyle = "rgba(77, 225, 139, 0.18)";
    ctx.fillRect(spring.x, spring.y - 6, spring.w, 6);
    ctx.fillStyle = "#9affc0";
    ctx.fillRect(spring.x + 3, spring.y - 2, spring.w - 6, 2);
  });

  room.crystals.forEach((crystal) => {
    ctx.fillStyle = crystal.active ? "rgba(120,246,255,0.16)" : "rgba(120,246,255,0.06)";
    ctx.beginPath();
    ctx.arc(crystal.x + crystal.w / 2, crystal.y + crystal.h / 2, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = crystal.active ? "#78f6ff" : "rgba(120,246,255,0.25)";
    ctx.beginPath();
    ctx.moveTo(crystal.x + crystal.w / 2, crystal.y);
    ctx.lineTo(crystal.x + crystal.w, crystal.y + crystal.h / 2);
    ctx.lineTo(crystal.x + crystal.w / 2, crystal.y + crystal.h);
    ctx.lineTo(crystal.x, crystal.y + crystal.h / 2);
    ctx.closePath();
    ctx.fill();
    if (crystal.active) {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillRect(crystal.x + 4, crystal.y + 3, 1, 3);
      ctx.fillRect(crystal.x + 3, crystal.y + 4, 3, 1);
    }
  });

  room.berries.forEach((berry) => {
    if (state.berriesCollected.has(berry.id)) return;
    ctx.strokeStyle = "#8affad";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(berry.x + 4, berry.y - 2);
    ctx.lineTo(berry.x + 4, berry.y + 2);
    ctx.stroke();
    ctx.fillStyle = "#ff4fa3";
    ctx.beginPath();
    ctx.arc(berry.x + 4, berry.y + 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(berry.x + 5, berry.y + 2, 1, 1);
    ctx.fillStyle = "#8affad";
    ctx.fillRect(berry.x + 3, berry.y - 1, 2, 3);
  });

  room.checkpoints.forEach((checkpoint) => {
    ctx.fillStyle = "rgba(255, 209, 102, 0.18)";
    ctx.fillRect(checkpoint.x, checkpoint.y, checkpoint.w, checkpoint.h);
    if (state.checkpoint.roomId === state.currentRoomId && Math.abs(state.checkpoint.x - checkpoint.x) < 3) {
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(checkpoint.x + 4, checkpoint.y - 6, 4, 8);
      ctx.fillStyle = "rgba(255, 209, 102, 0.15)";
      ctx.fillRect(checkpoint.x + 5, checkpoint.y - 22, 2, 16);
      ctx.fillStyle = "rgba(255, 209, 102, 0.22)";
      ctx.beginPath();
      ctx.arc(checkpoint.x + 6, checkpoint.y - 22, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  if (room.goal) {
    ctx.fillStyle = "rgba(255,244,186,0.16)";
    ctx.fillRect(room.goal.x - 4, room.goal.y - 10, room.goal.w + 8, room.goal.h + 12);
    ctx.fillStyle = "#fff4ba";
    ctx.fillRect(room.goal.x, room.goal.y, room.goal.w, room.goal.h);
    ctx.fillStyle = "#f28ea8";
    ctx.fillRect(room.goal.x + 4, room.goal.y - 12, 3, 12);
    ctx.fillStyle = "#fff7d6";
    ctx.fillRect(room.goal.x + 1, room.goal.y + 1, room.goal.w - 2, 2);
  }
}

function drawPixelSprite(pattern, palette, ox, oy, scale = 1) {
  for (let y = 0; y < pattern.length; y += 1) {
    const row = pattern[y];
    for (let x = 0; x < row.length; x += 1) {
      const token = row[x];
      if (token === ".") continue;
      ctx.fillStyle = palette[token];
      ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    }
  }
}

function currentPlayerSprite() {
  const standing = [
    "..hhhh..",
    ".hhsshh.",
    ".hsffsh.",
    "hhsffshh",
    "hseffesh",
    "hsffffsh",
    ".shhhhs.",
    ".jccccj.",
    "jjccccjj",
    ".ccbbcc.",
    ".cbbbbc.",
    ".bb..bb.",
    ".bb..bb.",
    "bb....bb",
  ];

  const runA = [
    "..hhhh..",
    ".hhsshh.",
    ".hsffsh.",
    "hhsffshh",
    "hseffesh",
    "hsffffsh",
    ".shhhhs.",
    ".jccccj.",
    ".jccccjj",
    ".ccbbcc.",
    ".cbbbbc.",
    "bb..bb..",
    "..bb..b.",
    ".bb.....",
  ];

  const runB = [
    "..hhhh..",
    ".hhsshh.",
    ".hsffsh.",
    "hhsffshh",
    "hseffesh",
    "hsffffsh",
    ".shhhhs.",
    ".jccccj.",
    "jjccccj.",
    ".ccbbcc.",
    ".cbbbbc.",
    "..bb..bb",
    ".b..bb..",
    ".....bb.",
  ];

  const jump = [
    "..hhhh..",
    ".hhsshh.",
    ".hsffsh.",
    "hhsffshh",
    "hseffesh",
    "hsffffsh",
    ".shhhhs.",
    ".jccccj.",
    "jjccccjj",
    "..cbbcc.",
    ".ccbb...",
    ".bb..b..",
    "bb....b.",
    ".b....b.",
  ];

  const dash = [
    "...hhhhh",
    "..hhsssh",
    "..hsffss",
    ".hhsffes",
    ".hsffffs",
    "..shhhhs",
    "..jccccj",
    "jjjccccj",
    "..ccbbcc",
    "..cbbbbc",
    "...bbbbb",
    "..bb...b",
    ".bb.....",
    "........",
  ];

  if (player.dashTimer > 0) return dash;
  if (!player.onGround) return jump;
  if (player.moveIntentX !== 0 && Math.abs(player.vx) > 28) {
    return player.walkFrame === 0 ? runA : runB;
  }
  if (Math.abs(player.vx) > 18 && player.moveIntentX !== 0 && Math.sign(player.vx) !== Math.sign(player.moveIntentX)) {
    return standing;
  }
  return standing;
}

function currentPlayerAnimationState() {
  if (player.dashTimer > 0) return "dash";
  if (!player.onGround && player.vy > 34) return "fall";
  if (!player.onGround) return "jump";
  if (player.moveIntentX !== 0 && Math.abs(player.vx) > 28) return "walk";
  if (Math.abs(player.vx) > 18 && player.moveIntentX !== 0 && Math.sign(player.vx) !== Math.sign(player.moveIntentX)) {
    return "brake";
  }
  return "idle";
}

function currentPlayerPoseImage() {
  const animationState = currentPlayerAnimationState();
  let key = "idle";
  if (animationState === "dash") key = "dash";
  else if (animationState === "fall") key = "fall";
  else if (animationState === "jump") key = "jump";
  else if (animationState === "brake") key = "brake";
  // else if (animationState === "walk") key = PLAYER_WALK_SEQUENCE[player.walkFrame];
  else if (animationState === "walk") key = "stand";
  return {
    key,
    image: playerPoseImages[key],
    offset: PLAYER_POSE_OFFSETS[key] || PLAYER_POSE_OFFSETS.idle,
  };
}

function drawPlayer() {
  for (let i = player.trail.length - 1; i >= 0; i -= 1) {
    const afterimage = player.trail[i];
    const index = player.trail.length - 1 - i;
    ctx.save();
    ctx.globalAlpha = (afterimage.t / 0.2) * 0.18 * (1 - index / 6);
    ctx.fillStyle = player.dashTimer > 0 ? "#ffe27a" : "#ff8ab6";
    ctx.fillRect(afterimage.x, afterimage.y, player.w, player.h);
    ctx.restore();
  }

  ctx.save();
  if (player.respawnFlash > 0) {
    ctx.globalAlpha = 0.45 + player.respawnFlash;
  }
  ctx.translate(Math.round(player.x + player.w / 2), Math.round(player.y + player.h / 2));
  ctx.scale(player.facing, 1);
  const poseInfo = currentPlayerPoseImage();
  const pose = poseInfo?.image;
  const poseOffset = poseInfo?.offset || PLAYER_FRAME_DEFS.idle.offset;
  if (pose && pose.complete && pose.naturalWidth) {
    const drawX = Math.round(-PLAYER_SPRITE_DRAW_W / 2 + poseOffset.x);
    const drawY = Math.round(player.h / 2 - PLAYER_SPRITE_DRAW_H + poseOffset.y);
    ctx.drawImage(pose, drawX, drawY, PLAYER_SPRITE_DRAW_W, PLAYER_SPRITE_DRAW_H);
  } else {
    const palette = {
      h: player.dashTimer > 0 ? "#fff3aa" : "#ff4f93",
      s: "#fff7fc",
      f: "#ffd8bf",
      e: "#111827",
      c: player.dashTimer > 0 ? "#ffe27a" : "#5f79c7",
      b: "#19263b",
      j: player.dashTimer > 0 ? "#fff4c1" : "#ff9fbe",
    };
    drawPixelSprite(currentPlayerSprite(), palette, -4, -5, 1);
  }
  ctx.restore();
}

function drawHudOverlay() {
  const panel = (x, y, w, h) => {
    ctx.fillStyle = "rgba(5, 10, 18, 0.72)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(189, 223, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  };

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 10;
  panel(8, 8, 118, 34);
  panel(132, 8, 126, 34);
  panel(264, 8, 112, 46);
  ctx.restore();

  ctx.fillStyle = "#ffd166";
  ctx.font = "700 8px Space Grotesk";
  ctx.fillText("ROOM", 14, 18);
  ctx.fillStyle = "#f7fbff";
  ctx.font = "700 11px Space Grotesk";
  ctx.fillText(currentRoom().name, 14, 31);
  ctx.font = "10px Space Grotesk";
  ctx.fillStyle = "#d2dfec";
  ctx.fillText(`Deaths ${state.deaths}`, 70, 31);

  ctx.fillStyle = "#78f6ff";
  ctx.font = "700 8px Space Grotesk";
  ctx.fillText("PROGRESS", 138, 18);
  ctx.fillStyle = "#f7fbff";
  ctx.font = "700 11px Space Grotesk";
  ctx.fillText(roomProgressLabel(), 138, 31);
  ctx.font = "10px Space Grotesk";
  ctx.fillStyle = "#d2dfec";
  ctx.fillText(`Berries ${state.berriesCollected.size}/${TOTAL_BERRIES}`, 184, 31);

  ctx.fillStyle = "#b7faff";
  ctx.font = "700 8px Space Grotesk";
  ctx.fillText("RUN", 270, 18);
  ctx.fillStyle = "#f7fbff";
  ctx.font = "700 12px Space Grotesk";
  ctx.fillText(formatTime(state.timer), 270, 31);
  ctx.font = "8px Space Grotesk";
  ctx.fillStyle = "#d2dfec";
  ctx.fillText(`Best ${bestTimeLabel()}`, 270, 43);
  ctx.fillText(`BD ${bestDeathsLabel()}`, 343, 43);

  for (let i = 0; i < Math.max(1, player.dashCharges); i += 1) {
    const dx = canvas.width - 17 - i * 12;
    ctx.fillStyle = i < player.dashCharges ? "#78f6ff" : "rgba(120,246,255,0.18)";
    ctx.fillRect(dx, 14, 9, 9);
    ctx.fillStyle = i < player.dashCharges ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.08)";
    ctx.fillRect(dx + 1, 15, 7, 2);
  }

  if (state.roomIntroTimer > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, state.roomIntroTimer);
    ctx.fillStyle = "rgba(5, 10, 18, 0.66)";
    ctx.fillRect(96, 48, 192, 26);
    ctx.strokeStyle = "rgba(255, 209, 102, 0.2)";
    ctx.strokeRect(96.5, 48.5, 191, 25);
    ctx.fillStyle = "#ffe08d";
    ctx.font = "700 12px Syne";
    ctx.textAlign = "center";
    ctx.fillText(currentRoom().name, 192, 65);
    ctx.textAlign = "start";
    ctx.restore();
  }

  if (state.transitionFlash > 0) {
    ctx.save();
    ctx.globalAlpha = state.transitionFlash;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.restore();
  }
}

function updateCanvasPresentation() {
  const panelRect = gamePanel.getBoundingClientRect();
  const panelStyles = window.getComputedStyle(gamePanel);
  const availableWidth = Math.max(
    WORLD_W,
    Math.floor(panelRect.width - parseFloat(panelStyles.paddingLeft) - parseFloat(panelStyles.paddingRight))
  );
  let availableHeight = Math.max(
    WORLD_H,
    Math.floor(panelRect.height - parseFloat(panelStyles.paddingTop) - parseFloat(panelStyles.paddingBottom))
  );

  if (window.matchMedia("(pointer: coarse), (max-width: 960px)").matches) {
    availableHeight = Math.max(WORLD_H, availableHeight - 112);
  }

  const scale = Math.max(1, Math.floor(Math.min(availableWidth / WORLD_W, availableHeight / WORLD_H)));
  canvas.style.width = `${WORLD_W * scale}px`;
  canvas.style.height = `${WORLD_H * scale}px`;
}

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(1 / 30, (now - lastTime) / 1000);
  lastTime = now;
  state.visualTime += dt;
  updateGamepadInput();

  if (state.mode === "playing") {
    state.timer += dt;
    updatePlayer(dt);
  } else {
    state.roomIntroTimer = Math.max(0, state.roomIntroTimer - dt);
    state.transitionFlash = Math.max(0, state.transitionFlash - dt * 1.5);
  }

  drawRoom(currentRoom());
  drawPlayer();
  drawHudOverlay();

  pressed.clear();
  virtualPressed.clear();
  gamepadPressed.clear();
  requestAnimationFrame(frame);
}

showOverlay(
  "Start Climb",
  "This prototype already has a full room chain. Learn the dash rhythm, use wall jumps aggressively, and expect the later summit rooms to punish hesitation."
);
bindTouchControls();
respawnAtCheckpoint();
updateCanvasPresentation();

window.addEventListener("resize", updateCanvasPresentation);
new ResizeObserver(updateCanvasPresentation).observe(gamePanel);

window.__needlePeakDebug = {
  getSnapshot() {
    const pose = currentPlayerPoseImage();
    return {
      mode: state.mode,
      roomId: state.currentRoomId,
      roomName: currentRoom().name,
      timer: state.timer,
      deaths: state.deaths,
      berries: state.berriesCollected.size,
      bestTime: state.bestTime,
      bestDeaths: state.bestDeaths,
      dashCharges: player.dashCharges,
      x: player.x,
      y: player.y,
      vx: player.vx,
      vy: player.vy,
      onGround: player.onGround,
      moveIntentX: player.moveIntentX,
      walkFrame: player.walkFrame,
      animationState: currentPlayerAnimationState(),
      poseKey: pose.key,
      transitionCooldown: state.transitionCooldown,
      roomIntroTimer: state.roomIntroTimer,
    };
  },
  teleport(roomId, x, y) {
    if (!rooms.has(roomId)) return false;
    state.currentRoomId = roomId;
    resetRoomDynamics(currentRoom());
    player.x = x;
    player.y = y;
    player.vx = 0;
    player.vy = 0;
    state.transitionCooldown = 0;
    state.roomIntroTimer = 0;
    player.trail = [];
    return true;
  },
  roomIds() {
    return [...roomOrder];
  },
  currentRoomMeta() {
    const room = currentRoom();
    return {
      id: room.id,
      exits: room.exits,
      spawn: room.spawn,
    };
  },
};
requestAnimationFrame(frame);
