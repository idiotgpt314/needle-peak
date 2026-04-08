const { chromium } = require("playwright");

const args = process.argv.slice(2);
const url = args.find((arg) => !arg.startsWith("--")) || "http://127.0.0.1:8124/";
const headed = args.includes("--headed");
const watch = args.includes("--watch");
const slowArg = args.find((arg) => arg.startsWith("--slow="));
const slowMo = slowArg ? Number(slowArg.split("=")[1]) : headed ? 110 : 0;
const verbose = headed || watch;

function logStep(message) {
  if (verbose) {
    console.log(`[playtest] ${message}`);
  }
}

async function snapshot(page) {
  return page.evaluate(() => window.__needlePeakDebug.getSnapshot());
}

async function meta(page) {
  return page.evaluate(() => window.__needlePeakDebug.currentRoomMeta());
}

async function teleport(page, roomId, x, y) {
  return page.evaluate(
    ({ roomId, x, y }) => window.__needlePeakDebug.teleport(roomId, x, y),
    { roomId, x, y }
  );
}

async function tryTransitionSweep(page, roomId, direction, expectedRoomId) {
  const attemptsByDirection = {
    right: [[395, 24], [395, 56], [395, 88], [395, 120], [395, 152], [395, 184]],
    left: [[-14, 24], [-14, 56], [-14, 88], [-14, 120], [-14, 152], [-14, 184]],
    up: [[24, -18], [72, -18], [120, -18], [168, -18], [216, -18], [312, -18]],
    down: [[24, 246], [72, 246], [120, 246], [168, 246], [216, 246], [312, 246]],
  };

  for (const [x, y] of attemptsByDirection[direction]) {
    await teleport(page, roomId, x, y);
    await page.waitForTimeout(60);
    const snap = await snapshot(page);
    if (snap.roomId === expectedRoomId) {
      return true;
    }
  }

  return false;
}

async function pressSequence(page, steps) {
  for (const step of steps) {
    if (step.note) logStep(step.note);
    if (step.type === "down") await page.keyboard.down(step.key);
    if (step.type === "up") await page.keyboard.up(step.key);
    if (step.type === "press") await page.keyboard.press(step.key);
    if (step.type === "wait") await page.waitForTimeout(step.ms);
  }
}

async function runWatchDemo(page) {
  logStep("Running headed watch demo");
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Begin Run" }).click();
  await page.waitForTimeout(700);

  const resetToSafeSpawn = async () => {
    await teleport(page, "ridge-1", 24, 178);
    await page.waitForTimeout(700);
  };

  await resetToSafeSpawn();
  await pressSequence(page, [
    { type: "down", key: "ArrowRight", note: "Ground movement" },
    { type: "wait", ms: 260 },
    { type: "up", key: "ArrowRight" },
    { type: "wait", ms: 900 },
  ]);

  await resetToSafeSpawn();
  await pressSequence(page, [
    { type: "press", key: "k", note: "Jump" },
    { type: "wait", ms: 900 },
  ]);

  await resetToSafeSpawn();
  await pressSequence(page, [
    { type: "down", key: "ArrowRight", note: "Dash" },
    { type: "wait", ms: 120 },
    { type: "press", key: "j" },
    { type: "wait", ms: 700 },
    { type: "up", key: "ArrowRight" },
    { type: "wait", ms: 900 },
  ]);

  await resetToSafeSpawn();
  logStep("Pause and resume");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Resume" }).click();
  await page.waitForTimeout(900);

  await resetToSafeSpawn();
  logStep("Retry");
  await page.keyboard.press("r");
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Retry" }).click();
  await page.waitForTimeout(1200);

  await resetToSafeSpawn();
  await page.waitForTimeout(1200);
}

async function main() {
  const browser = await chromium.launch({ headless: !headed, slowMo });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const findings = [];
  const consoleErrors = [];

  page.on("pageerror", (error) => {
    consoleErrors.push(`pageerror: ${error.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(`console: ${msg.text()}`);
    }
  });

  if (watch) {
    await runWatchDemo(page);
    const final = await snapshot(page);
    console.log(JSON.stringify({ url, findings, consoleErrors, final }, null, 2));
    await browser.close();
    process.exit(consoleErrors.length ? 1 : 0);
  }

  logStep(`Opening ${url}`);
  await page.goto(url, { waitUntil: "networkidle" });
  logStep("Starting run");
  await page.getByRole("button", { name: "Begin Run" }).click();
  await page.waitForTimeout(600);

  const started = await snapshot(page);
  if (started.mode !== "playing") {
    findings.push(`Run did not enter playing mode after start. Got ${started.mode}.`);
  }

  await pressSequence(page, [
    { type: "down", key: "ArrowRight", note: "Basic movement check" },
    { type: "wait", ms: 180 },
    { type: "press", key: "k" },
    { type: "wait", ms: 160 },
    { type: "press", key: "j" },
    { type: "wait", ms: 260 },
    { type: "up", key: "ArrowRight" },
  ]);

  const afterMovement = await snapshot(page);
  if (!Number.isFinite(afterMovement.x) || !Number.isFinite(afterMovement.y)) {
    findings.push("Player position became non-finite after movement sequence.");
  }

  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  let paused = await snapshot(page);
  if (paused.mode !== "paused") {
    findings.push(`Pause flow failed. Expected paused, got ${paused.mode}.`);
  }
  await page.getByRole("button", { name: "Resume" }).click();
  await page.waitForTimeout(200);
  paused = await snapshot(page);
  if (paused.mode !== "playing") {
    findings.push(`Resume flow failed. Expected playing, got ${paused.mode}.`);
  }

  await page.keyboard.press("r");
  await page.waitForTimeout(200);
  let afterRestart = await snapshot(page);
  if (afterRestart.mode !== "dead") {
    findings.push(`Manual restart did not enter dead/reset state. Got ${afterRestart.mode}.`);
  }
  await page.getByRole("button", { name: "Retry" }).click();
  await page.waitForTimeout(250);
  afterRestart = await snapshot(page);
  if (afterRestart.mode !== "playing") {
    findings.push(`Retry after manual reset failed. Got ${afterRestart.mode}.`);
  }

  logStep("Sweeping declared room transitions");
  const roomIds = await page.evaluate(() => window.__needlePeakDebug.roomIds());
  for (const roomId of roomIds) {
    const ok = await teleport(page, roomId, 24, 24);
    if (!ok) {
      findings.push(`Teleport hook failed for room ${roomId}.`);
      continue;
    }
    await page.waitForTimeout(40);
    const snap = await snapshot(page);
    if (snap.roomId !== roomId) {
      findings.push(`Teleport landed in wrong room. Expected ${roomId}, got ${snap.roomId}.`);
      continue;
    }

    const roomMeta = await meta(page);
    const exits = roomMeta.exits || {};

    if (exits.right) {
      const okTransition = await tryTransitionSweep(page, roomId, "right", exits.right);
      if (!okTransition) findings.push(`Right transition from ${roomId} failed. Expected ${exits.right}.`);
    }
    if (exits.left) {
      const okTransition = await tryTransitionSweep(page, roomId, "left", exits.left);
      if (!okTransition) findings.push(`Left transition from ${roomId} failed. Expected ${exits.left}.`);
    }
    if (exits.up) {
      const okTransition = await tryTransitionSweep(page, roomId, "up", exits.up);
      if (!okTransition) findings.push(`Up transition from ${roomId} failed. Expected ${exits.up}.`);
    }
    if (exits.down) {
      const okTransition = await tryTransitionSweep(page, roomId, "down", exits.down);
      if (!okTransition) findings.push(`Down transition from ${roomId} failed. Expected ${exits.down}.`);
    }
  }

  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Begin Run" }).click();
  await page.waitForTimeout(200);

  logStep("Running aggressive stress sequence");
  for (let i = 0; i < 8; i += 1) {
    await pressSequence(page, [
      { type: "down", key: i % 2 === 0 ? "ArrowRight" : "ArrowLeft" },
      { type: "press", key: "k" },
      { type: "wait", ms: 50 },
      { type: "press", key: "j" },
      { type: "wait", ms: 50 },
      { type: "up", key: i % 2 === 0 ? "ArrowRight" : "ArrowLeft" },
      { type: "wait", ms: 70 },
    ]);
  }

  const stressSnap = await snapshot(page);
  if (!["playing", "dead", "finished", "paused"].includes(stressSnap.mode)) {
    findings.push(`Unexpected mode after stress input: ${stressSnap.mode}`);
  }
  if (!Number.isFinite(stressSnap.vx) || !Number.isFinite(stressSnap.vy)) {
    findings.push("Velocity became non-finite after stress input.");
  }

  logStep("Running retry-loop spam sequence");
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press("r");
    await page.waitForTimeout(120);
    const retryButton = page.getByRole("button", { name: "Retry" });
    if (await retryButton.isVisible()) {
      await retryButton.click();
    }
    await page.waitForTimeout(160);
    const snap = await snapshot(page);
    if (!["playing", "dead"].includes(snap.mode)) {
      findings.push(`Retry loop produced unexpected mode ${snap.mode}.`);
      break;
    }
  }

  logStep("Running pause/resume repetition");
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(140);
    let snap = await snapshot(page);
    if (snap.mode !== "paused") {
      findings.push(`Pause repetition failed on cycle ${i + 1}. Got ${snap.mode}.`);
      break;
    }
    await page.getByRole("button", { name: "Resume" }).click();
    await page.waitForTimeout(140);
    snap = await snapshot(page);
    if (snap.mode !== "playing") {
      findings.push(`Resume repetition failed on cycle ${i + 1}. Got ${snap.mode}.`);
      break;
    }
  }

  logStep("Trying room entry at real spawn points");
  for (const roomId of roomIds) {
    await teleport(page, roomId, 24, 24);
    await page.waitForTimeout(60);
    const roomMeta = await meta(page);
    const spawnOk = await teleport(page, roomId, roomMeta.spawn.x, roomMeta.spawn.y);
    if (!spawnOk) {
      findings.push(`Spawn teleport failed for ${roomId}.`);
      continue;
    }
    await page.waitForTimeout(100);
    const snap = await snapshot(page);
    if (!Number.isFinite(snap.x) || !Number.isFinite(snap.y)) {
      findings.push(`Spawn state invalid in ${roomId}.`);
    }
  }

  console.log(JSON.stringify({
    url,
    findings,
    consoleErrors,
    final: await snapshot(page),
  }, null, 2));

  await browser.close();
  process.exit(findings.length || consoleErrors.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
