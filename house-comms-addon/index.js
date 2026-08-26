const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const DATA_DIR = process.env.DATA_DIR || "/data";
const DATA_FILE = path.join(DATA_DIR, "house-comms.json");
const PORT = process.env.PORT || 8091;

// CORS - restrict to your HA instance in production via ALLOWED_ORIGIN env var
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { messages: [], maintenance: { enabled: false, note: "", by: "", ts: 0 }, disabledLocal: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (e) {
    return { messages: [], maintenance: { enabled: false, note: "", by: "", ts: 0 }, disabledLocal: [] };
  }
}

function saveData(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

// --- messages ---
app.get("/api/messages", (req, res) => {
  const data = loadData();
  res.json(data.messages.slice(-300));
});

app.post("/api/messages", (req, res) => {
  const { text, user_id, user_name, is_admin } = req.body || {};
  if (!text || !text.trim() || !user_id || !user_name) {
    return res.status(400).json({ error: "missing fields" });
  }

  const data = loadData();

  if (data.disabledLocal.includes(user_id)) {
    return res.status(403).json({ error: "access revoked for this user in House Comms" });
  }

  if (data.maintenance.enabled && !is_admin) {
    return res.status(423).json({ error: "maintenance mode active" });
  }

  const msg = {
    id: crypto.randomUUID(),
    userId: user_id,
    name: user_name,
    isAdmin: !!is_admin,
    text: String(text).trim().slice(0, 2000),
    ts: Date.now(),
  };
  data.messages.push(msg);
  data.messages = data.messages.slice(-500);
  saveData(data);
  res.json(msg);
});

// --- maintenance mode (admin only, verified by is_admin flag from HA session) ---
app.get("/api/maintenance", (req, res) => {
  const data = loadData();
  res.json(data.maintenance);
});

app.post("/api/maintenance", (req, res) => {
  const { enabled, note, by, is_admin } = req.body || {};
  if (!is_admin) return res.status(403).json({ error: "admin required" });

  const data = loadData();
  data.maintenance = {
    enabled: !!enabled,
    note: enabled ? String(note || "").slice(0, 200) : "",
    by: by || "",
    ts: Date.now(),
  };
  saveData(data);
  res.json(data.maintenance);
});

// --- local access control (chat-only revoke, separate from HA account itself) ---
app.get("/api/access", (req, res) => {
  const data = loadData();
  res.json({ disabledLocal: data.disabledLocal });
});

app.post("/api/access", (req, res) => {
  const { target_user_id, revoked, is_admin } = req.body || {};
  if (!is_admin) return res.status(403).json({ error: "admin required" });
  if (!target_user_id) return res.status(400).json({ error: "missing target_user_id" });

  const data = loadData();
  const set = new Set(data.disabledLocal);
  if (revoked) set.add(target_user_id);
  else set.delete(target_user_id);
  data.disabledLocal = Array.from(set);
  saveData(data);
  res.json({ disabledLocal: data.disabledLocal });
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`House Comms server listening on :${PORT}`);
});
