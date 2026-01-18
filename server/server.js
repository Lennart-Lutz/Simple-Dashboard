import express from "express";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));

const ROOT_DIR = path.resolve(__dirname, "..");

const DATA_DIR = path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "dashboards.json");

// --- helpers ---
async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    const initial = {
      version: 1,
      activeId: "d1",
      dashboards: [{ id: "d1", name: "Main", items: [] }]
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readState() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

async function writeState(state) {
  // atomic-ish write
  const tmp = DATA_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(tmp, DATA_FILE);
}

function newId(prefix) {
  return prefix + crypto.randomBytes(6).toString("hex");
}

// --- API ---
app.get("/api/dashboards", async (req, res) => {
  try {
    const state = await readState();
    res.json(state);
  } catch (e) {
    res.status(500).json({ error: "read_failed" });
  }
});

app.put("/api/dashboards", async (req, res) => {
  // Client sendet kompletten State (einfach und zuverlässig)
  const state = req.body;
  if (!state || !Array.isArray(state.dashboards)) {
    return res.status(400).json({ error: "invalid_payload" });
  }
  try {
    await writeState(state);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "write_failed" });
  }
});

app.post("/api/dashboards", async (req, res) => {
  // Optional: neues Dashboard serverseitig erzeugen
  try {
    const state = await readState();
    const id = newId("d");
    const name = (req.body?.name || "New").toString().slice(0, 40);

    state.dashboards.push({ id, name, items: [] });
    state.activeId = id;

    await writeState(state);
    res.json({ id });
  } catch {
    res.status(500).json({ error: "create_failed" });
  }
});

// DEMO ONLY

app.get("/api/demo/latest", (req, res) => {
  const key = String(req.query.param); // CO2 default

  // Demo values by param
  const now = Date.now();
  const data = {
    ts: now,
    co2: Math.floor(400 + Math.random() * 1200),
    temp: Math.round((18 + Math.random() * 6) * 10) / 10,
    rh: Math.round((35 + Math.random() * 25) * 10) / 10,
  };

  res.json({ ts: now, key, value: data[key] ?? data.co2 });
});

app.get("/api/demo/range", (req, res) => {
  const from = Number(req.query.from_ts_ms);
  const to = Number(req.query.to_ts_ms);
  const maxPoints = Math.max(10, Math.min(20000, Number(req.query.max_points) || 600));

  const key = String(req.query.param).trim().toLowerCase();

  const now = Date.now();
  const safeTo = Number.isFinite(to) ? to : now;
  const safeFrom = Number.isFinite(from) ? from : safeTo - 6 * 60 * 60 * 1000;

  if (!(safeTo > safeFrom)) {
    return res.status(400).json({ error: "invalid_range" });
  }

  const span = safeTo - safeFrom;
  const step = Math.max(1000, Math.floor(span / maxPoints));

  function demoValue(t) {
    // deterministic-ish signal based on time + key, so charts look stable
    const x = (t - safeFrom) / span; // 0..1
    const wave = Math.sin(x * Math.PI * 2);

    // different shapes by key
    if (key === "temp") {
      const base = 21 + 2.5 * wave;
      const noise = (Math.random() - 0.5) * 0.4;
      return Math.round((base + noise) * 10) / 10;
    }

    if (key === "rh") {
      const base = 45 + 8 * wave;
      const noise = (Math.random() - 0.5) * 1.2;
      return Math.round((base + noise) * 10) / 10;
    }

    // default: co2-like
    const base = 650 + 220 * wave;
    const noise = (Math.random() - 0.5) * 40;
    return Math.round(base + noise);
  }

  const points = [];
  for (let t = safeFrom; t <= safeTo; t += step) {
    points.push([t, demoValue(t)]);
  }

  res.json({ key, points });
});

// --- static ---
app.use(express.static(path.join(ROOT_DIR, "public")));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on http://localhost:${port}`));
