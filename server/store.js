const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

const TURSO_URL = process.env.TURSO_DATABASE_URL || '';
const USE_DB = TURSO_URL.startsWith('libsql://') || TURSO_URL.startsWith('file:');

let state = null;
let saveTimer = null;
let dirty = false;
let readyPromise = null;

let dbClient = null;
async function client() {
  if (!dbClient) {
    const { createClient } = require('@libsql/client');
    dbClient = createClient({
      url: TURSO_URL,
      authToken: process.env.TURSO_AUTH_TOKEN || undefined
    });
  }
  return dbClient;
}

const DOC_KEY = 'qlclass_doc';

function ensureReady(defaults) {
  if (readyPromise) return readyPromise;
  readyPromise = (USE_DB ? initDbBackend(defaults) : Promise.resolve(initFileBackend(defaults)))
    .then(() => { console.log(`[store] san sang (che do: ${USE_DB ? 'Turso/libSQL' : 'file'})`); });
  return readyPromise;
}

/* ---------- Backend file (dev local) ---------- */

function initFileBackend(defaults) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  let loaded = null;
  if (fs.existsSync(DATA_FILE)) {
    try {
      loaded = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
      console.error('Loi doc db.json, tao du lieu moi:', e.message);
      loaded = null;
    }
  }
  state = loaded || defaults();
  if (!loaded) persistNow();
}

function writeFileBackend() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 1), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

function putFileOnDisk(name, buf) {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
}

function getFileFromDisk(name) {
  const p = path.join(UPLOAD_DIR, name);
  if (!p.startsWith(UPLOAD_DIR + path.sep)) return null;
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p);
}

/* ---------- Backend Turso / libSQL ---------- */

async function initDbBackend(defaults) {
  const c = await client();
  await c.execute(`CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)`);
  await c.execute(`CREATE TABLE IF NOT EXISTS files (
    name TEXT PRIMARY KEY, mime TEXT NOT NULL, size INTEGER NOT NULL,
    data BLOB NOT NULL, created_at TEXT DEFAULT (datetime('now'))
  )`);
  await c.execute(`CREATE TABLE IF NOT EXISTS tokens (
    token TEXT PRIMARY KEY, uid INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  const rs = await c.execute({ sql: 'SELECT v FROM kv WHERE k = ?', args: [DOC_KEY] });
  if (rs.rows.length && rs.rows[0].v) {
    try {
      state = JSON.parse(String(rs.rows[0].v));
    } catch (e) {
      console.error('Loi doc doc tu DB, tao du lieu moi:', e.message);
      state = defaults();
      await flushDoc();
      console.log('[store] Da khoi tao du lieu mac dinh trong DB');
    }
  } else {
    state = defaults();
    await flushDoc();
    console.log('[store] Da khoi tao du lieu mac dinh trong DB');
  }
  // chuyen cac token con sot trong document sang bang rieng (lan dau tien)
  const legacy = Object.entries((state && state.tokens) || {});
  if (legacy.length) {
    const cnt = await c.execute('SELECT count(*) AS n FROM tokens');
    if (Number(cnt.rows[0].n) === 0) {
      for (const [tok, uid] of legacy) {
        await c.execute({ sql: 'INSERT OR REPLACE INTO tokens (token, uid) VALUES (?, ?)', args: [tok, Number(uid)] });
      }
      console.log(`[store] Da chuyen ${legacy.length} token cu sang bang rieng`);
    }
    state.tokens = {};
    await flushDoc();
  }
}

async function flushDoc() {
  const c = await client();
  await c.execute({
    sql: `INSERT INTO kv (k, v) VALUES (?, ?)
          ON CONFLICT(k) DO UPDATE SET v = excluded.v`,
    args: [DOC_KEY, JSON.stringify(state)]
  });
}

/* ---------- API chung cho api.js (van dong bo nhu cu) ---------- */

function get() {
  if (!state) throw new Error('Store chua khoi tao (go ensureReady truoc)');
  return state;
}

function scheduleSave() {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { persistIfDirty(); }, 150);
}

function isDirty() { return dirty; }

async function persistIfDirty() {
  if (!dirty || !state) return;
  dirty = false;
  clearTimeout(saveTimer);
  await persistNow();
}

async function persistNow() {
  if (!state) return;
  clearTimeout(saveTimer);
  dirty = false;
  if (USE_DB) await flushDoc();
  else writeFileBackend();
}

function nextId(collection) {
  const db = state;
  db.counters = db.counters || {};
  db.counters[collection] = (db.counters[collection] || Math.max(0, ...db[collection].map(x => Number(x.id) || 0))) + 1;
  return db.counters[collection];
}

async function putFile(name, mime, buf) {
  if (USE_DB) {
    const c = await client();
    await c.execute({
      sql: `INSERT INTO files (name, mime, size, data) VALUES (?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET mime = excluded.mime, size = excluded.size, data = excluded.data`,
      args: [name, mime, buf.length, buf]
    });
  } else {
    putFileOnDisk(name, buf);
  }
}

async function getFile(name) {
  if (!/^[a-z0-9]+\.(png|jpg|gif|webp)$/i.test(name)) return null;
  if (USE_DB) {
    const c = await client();
    const rs = await c.execute({ sql: 'SELECT mime, data FROM files WHERE name = ?', args: [name] });
    if (!rs.rows.length) return null;
    return { mime: String(rs.rows[0].mime), buf: Buffer.from(rs.rows[0].data) };
  }
  const buf = getFileFromDisk(name);
  if (!buf) return null;
  const ext = name.split('.').pop().toLowerCase();
  const mimes = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
  return { mime: mimes[ext] || 'application/octet-stream', buf };
}

/* ---------- Token dang nhap: bang rieng, an toan voi serverless ---------- */

async function setToken(token, uid) {
  if (!USE_DB) {
    state.tokens = state.tokens || {};
    state.tokens[token] = uid;
    dirty = true;
    return;
  }
  const c = await client();
  await c.execute({ sql: 'INSERT OR REPLACE INTO tokens (token, uid) VALUES (?, ?)', args: [token, Number(uid)] });
}

async function delToken(token) {
  if (!USE_DB) {
    if (state.tokens) delete state.tokens[token];
    dirty = true;
    return;
  }
  const c = await client();
  await c.execute({ sql: 'DELETE FROM tokens WHERE token = ?', args: [token] });
}

async function findUidByToken(token) {
  if (!token) return null;
  if (!USE_DB) {
    const v = (state.tokens || {})[token];
    return v == null ? null : Number(v);
  }
  const c = await client();
  const rs = await c.execute({ sql: 'SELECT uid FROM tokens WHERE token = ?', args: [token] });
  return rs.rows.length ? Number(rs.rows[0].uid) : null;
}

async function delTokensOfUser(uid) {
  if (!USE_DB) {
    const t = state.tokens || {};
    Object.keys(t).forEach(k => { if (Number(t[k]) === Number(uid)) delete t[k]; });
    dirty = true;
    return;
  }
  const c = await client();
  await c.execute({ sql: 'DELETE FROM tokens WHERE uid = ?', args: [Number(uid)] });
}

if (!USE_DB) {
  process.on('exit', () => { try { if (dirty && state) writeFileBackend(); } catch (_) {} });
}
process.on('SIGINT', () => process.exit(0));

module.exports = {
  ensureReady, get, scheduleSave, persistNow, persistIfDirty, isDirty,
  nextId, putFile, getFile, setToken, delToken, findUidByToken, delTokensOfUser,
  get useDb() { return USE_DB; }
};
