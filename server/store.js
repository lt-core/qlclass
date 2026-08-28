const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

const TURSO_URL = process.env.TURSO_DATABASE_URL || '';
const USE_DB = TURSO_URL.startsWith('libsql://') || TURSO_URL.startsWith('file:');

let state = null;
let stateRev = 0;
let saveTimer = null;
let dirty = false;
let readyPromise = null;

let dbClient = null;
let dbClientAt = 0;
async function client() {
  const now = Date.now();
  if (dbClient && (now - dbClientAt) > 3_600_000) {
    try { dbClient.close(); } catch (_) {}
    dbClient = null;
  }
  if (!dbClient) {
    const { createClient } = require('@libsql/client');
    dbClient = createClient({
      url: TURSO_URL,
      authToken: process.env.TURSO_AUTH_TOKEN || undefined
    });
    dbClientAt = now;
  }
  return dbClient;
}

async function dbExecute(sql, args) {
  const run = (c) => (args === undefined ? c.execute(sql) : c.execute({ sql, args }));
  try {
    const c = await client();
    return await run(c);
  } catch (firstErr) {
    console.error('[store] DB err, reconnect & retry:', firstErr.message || firstErr);
    try { if (dbClient) dbClient.close(); } catch (_) {}
    dbClient = null;
    dbClientAt = 0;
    const c2 = await client();
    return await run(c2);
  }
}

const DOC_KEY = 'qlclass_doc';

function summaryRanges() {
  const weeks = (state && state.settings && state.settings.weeks) || 36;
  const sem = Math.floor(weeks / 2);
  const mid = Math.floor(sem / 2);
  return {
    s1mid: [0, mid],
    s1end: [0, sem],
    s2mid: [sem + 1, sem + mid],
    s2end: [sem + 1, weeks],
    year: [0, weeks]
  };
}

function weekInRange(recordWeek, weekParam) {
  if (!weekParam) return true;
  const w = Number(weekParam);
  if (!isNaN(w)) return recordWeek === w;
  const range = summaryRanges()[weekParam];
  if (!range) return true;
  return recordWeek >= range[0] && recordWeek <= range[1];
}

function ensureReady(defaults) {
  if (readyPromise) return readyPromise;
  readyPromise = (USE_DB ? initDbBackend(defaults) : Promise.resolve(initFileBackend(defaults)))
    .then(() => { console.log(`[store] san sang (che do: ${USE_DB ? 'Turso/libSQL' : 'file'})`); });
  if (!process.env.VERCEL) {
    setInterval(() => { persistIfDirty(); }, 5000);
  }
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
  console.log('[store] Ket noi Turso:', TURSO_URL.replace(/\/\/.*@/, '//***@'));
  await c.execute(`CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)`);
  try { await c.execute(`ALTER TABLE kv ADD COLUMN rev INTEGER NOT NULL DEFAULT 0`); } catch (_) {}
  await c.execute(`CREATE TABLE IF NOT EXISTS files (
    name TEXT PRIMARY KEY, mime TEXT NOT NULL, size INTEGER NOT NULL,
    data BLOB NOT NULL, created_at TEXT DEFAULT (datetime('now'))
  )`);
  await c.execute(`CREATE TABLE IF NOT EXISTS tokens (
    token TEXT PRIMARY KEY, uid INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await ensureSqlTables(c);
  await migrateFromDoc(c);
  const rs = await c.execute({ sql: 'SELECT v, rev FROM kv WHERE k = ?', args: [DOC_KEY] });
  if (rs.rows.length && rs.rows[0].v) {
    try {
      state = JSON.parse(String(rs.rows[0].v));
      stateRev = Number(rs.rows[0].rev) || 0;
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
  const payload = JSON.stringify(state);
  try {
    const rs = await dbExecute(
      `INSERT INTO kv (k, v, rev) VALUES (?, ?, 1)
            ON CONFLICT(k) DO UPDATE SET v = excluded.v, rev = rev + 1
            RETURNING rev`,
      [DOC_KEY, payload]
    );
    if (rs.rows.length) stateRev = Number(rs.rows[0].rev);
    return stateRev;
  } catch (err) {
    console.error('[store] flushDoc FAILED:', err.message || err);
    throw err;
  }
}

async function refreshDocIfStale() {
  if (!USE_DB) return;
  try {
    const rs = await dbExecute('SELECT rev FROM kv WHERE k = ?', [DOC_KEY]);
    const rev = rs.rows.length ? Number(rs.rows[0].rev) : 0;
    if (rev === stateRev) return;
    const full = await dbExecute('SELECT v FROM kv WHERE k = ?', [DOC_KEY]);
    if (full.rows.length && full.rows[0].v) {
      state = JSON.parse(String(full.rows[0].v));
      stateRev = rev;
    }
  } catch (err) {
    console.error('[store] refreshDocIfStale FAILED:', err.message || err);
  }
}

/* ---------- SQL CRUD for labor / culture / reviews ---------- */
/* These bypass the single-document to avoid Vercel race conditions */

async function ensureSqlTables(c) {
  await c.execute(`CREATE TABLE IF NOT EXISTS labor (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, date TEXT NOT NULL,
    session TEXT DEFAULT 'Sáng', time TEXT DEFAULT '', ratings TEXT DEFAULT '{}'
  )`);
  await c.execute(`CREATE TABLE IF NOT EXISTS culture (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, date TEXT NOT NULL,
    desc TEXT DEFAULT '', ratings TEXT DEFAULT '{}'
  )`);
  await c.execute(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY, week INTEGER NOT NULL, type TEXT NOT NULL,
    content TEXT DEFAULT '', updated_by_name TEXT DEFAULT '', updated_at TEXT
  )`);
  await c.execute(`CREATE TABLE IF NOT EXISTS seq (
    name TEXT PRIMARY KEY, val INTEGER NOT NULL
  )`);
}

async function migrateFromDoc(c) {
  const rs = await c.execute({ sql: 'SELECT v FROM kv WHERE k = ?', args: [DOC_KEY] });
  if (!rs.rows.length || !rs.rows[0].v) return;
  let doc;
  try { doc = JSON.parse(String(rs.rows[0].v)); } catch (_) { return; }
  const cnt = await c.execute('SELECT count(*) AS n FROM labor');
  if (Number(cnt.rows[0].n) > 0) return;
  for (const l of (doc.labor || [])) {
    await c.execute({ sql: 'INSERT OR IGNORE INTO labor (id, name, date, session, time, ratings) VALUES (?,?,?,?,?,?)',
      args: [l.id, l.name, l.date, l.session || 'Sáng', l.time || '', JSON.stringify(l.ratings || {})] });
  }
  for (const cl of (doc.culture || [])) {
    await c.execute({ sql: 'INSERT OR IGNORE INTO culture (id, name, date, desc, ratings) VALUES (?,?,?,?,?)',
      args: [cl.id, cl.name, cl.date, cl.desc || '', JSON.stringify(cl.ratings || {})] });
  }
  for (const rv of (doc.reviews || [])) {
    await c.execute({ sql: 'INSERT OR IGNORE INTO reviews (id, week, type, content, updated_by_name, updated_at) VALUES (?,?,?,?,?,?)',
      args: [rv.id, rv.week, rv.type, rv.content || '', rv.updatedByName || '', rv.updatedAt || null] });
  }
  if (doc.labor && doc.labor.length) {
    doc.labor = [];
    await c.execute({ sql: 'UPDATE kv SET v = ? WHERE k = ?', args: [JSON.stringify(doc), DOC_KEY] });
  }
  console.log('[store] Da chuyen labor/culture/reviews sang bang SQL rieng');
}

function useSql() { return USE_DB; }

async function laborList() {
  if (!USE_DB) return get().labor;
  const rs = await dbExecute('SELECT * FROM labor');
  return rs.rows.map(r => ({ id: Number(r.id), name: String(r.name), date: String(r.date), session: String(r.session), time: String(r.time), ratings: JSON.parse(String(r.ratings || '{}')) }));
}
async function laborGet(id) {
  if (!USE_DB) return get().labor.find(x => x.id === Number(id));
  const rs = await dbExecute('SELECT * FROM labor WHERE id = ?', [Number(id)]);
  if (!rs.rows.length) return null;
  const r = rs.rows[0];
  return { id: Number(r.id), name: String(r.name), date: String(r.date), session: String(r.session), time: String(r.time), ratings: JSON.parse(String(r.ratings || '{}')) };
}
async function laborInsert(l) {
  if (!USE_DB) { get().labor.push(l); scheduleSave(); return l; }
  await dbExecute('INSERT INTO labor (id, name, date, session, time, ratings) VALUES (?,?,?,?,?,?)',
    [l.id, l.name, l.date, l.session || 'Sáng', l.time || '', JSON.stringify(l.ratings || {})]);
  return l;
}
async function laborUpdate(id, fields) {
  if (!USE_DB) {
    const l = get().labor.find(x => x.id === Number(id));
    if (l) Object.assign(l, fields);
    scheduleSave();
    return l;
  }
  const cur = await laborGet(id);
  if (!cur) return null;
  const merged = Object.assign(cur, fields);
  await dbExecute('UPDATE labor SET name=?, date=?, session=?, time=?, ratings=? WHERE id=?',
    [merged.name, merged.date, merged.session, merged.time, JSON.stringify(merged.ratings || {}), Number(id)]);
  return merged;
}
async function laborDelete(id) {
  if (!USE_DB) { get().labor = get().labor.filter(x => x.id !== Number(id)); scheduleSave(); return; }
  await dbExecute('DELETE FROM labor WHERE id = ?', [Number(id)]);
}

async function cultureList() {
  if (!USE_DB) return get().culture;
  const rs = await dbExecute('SELECT * FROM culture');
  return rs.rows.map(r => ({ id: Number(r.id), name: String(r.name), date: String(r.date), desc: String(r.desc || ''), ratings: JSON.parse(String(r.ratings || '{}')) }));
}
async function cultureGet(id) {
  if (!USE_DB) return get().culture.find(x => x.id === Number(id));
  const rs = await dbExecute('SELECT * FROM culture WHERE id = ?', [Number(id)]);
  if (!rs.rows.length) return null;
  const r = rs.rows[0];
  return { id: Number(r.id), name: String(r.name), date: String(r.date), desc: String(r.desc || ''), ratings: JSON.parse(String(r.ratings || '{}')) };
}
async function cultureInsert(c) {
  if (!USE_DB) { get().culture.push(c); scheduleSave(); return c; }
  await dbExecute('INSERT INTO culture (id, name, date, desc, ratings) VALUES (?,?,?,?,?)',
    [c.id, c.name, c.date, c.desc || '', JSON.stringify(c.ratings || {})]);
  return c;
}
async function cultureUpdate(id, fields) {
  if (!USE_DB) {
    const c = get().culture.find(x => x.id === Number(id));
    if (c) Object.assign(c, fields);
    scheduleSave();
    return c;
  }
  const cur = await cultureGet(id);
  if (!cur) return null;
  const merged = Object.assign(cur, fields);
  await dbExecute('UPDATE culture SET name=?, date=?, desc=?, ratings=? WHERE id=?',
    [merged.name, merged.date, merged.desc, JSON.stringify(merged.ratings || {}), Number(id)]);
  return merged;
}
async function cultureDelete(id) {
  if (!USE_DB) { get().culture = get().culture.filter(x => x.id !== Number(id)); scheduleSave(); return; }
  await dbExecute('DELETE FROM culture WHERE id = ?', [Number(id)]);
}

async function reviewsList(weekParam) {
  if (!USE_DB) {
    let list = get().reviews;
    if (weekParam) list = list.filter(r => weekInRange(r.week, weekParam));
    return list;
  }
  const rs = await dbExecute('SELECT * FROM reviews');
  let list = rs.rows.map(r => ({ id: Number(r.id), week: Number(r.week), type: String(r.type), content: String(r.content || ''), updatedByName: String(r.updated_by_name || ''), updatedAt: r.updated_at }));
  if (weekParam) list = list.filter(r => weekInRange(r.week, weekParam));
  return list;
}
async function reviewsFind(week, type) {
  if (!USE_DB) return get().reviews.find(x => x.week === week && x.type === type);
  const rs = await dbExecute('SELECT * FROM reviews WHERE week = ? AND type = ?', [week, type]);
  if (!rs.rows.length) return null;
  const r = rs.rows[0];
  return { id: Number(r.id), week: Number(r.week), type: String(r.type), content: String(r.content || ''), updatedByName: String(r.updated_by_name || ''), updatedAt: r.updated_at };
}
async function reviewsUpsert(rv) {
  if (!USE_DB) {
    const existing = get().reviews.find(x => x.week === rv.week && x.type === rv.type);
    if (existing) { Object.assign(existing, rv); scheduleSave(); return existing; }
    get().reviews.push(rv);
    scheduleSave();
    return rv;
  }
  const existing = await reviewsFind(rv.week, rv.type);
  if (existing) {
    await dbExecute('UPDATE reviews SET content=?, updated_by_name=?, updated_at=? WHERE id=?',
      [rv.content || '', rv.updatedByName || '', rv.updatedAt || null, existing.id]);
    return Object.assign(existing, rv);
  }
  await dbExecute('INSERT INTO reviews (id, week, type, content, updated_by_name, updated_at) VALUES (?,?,?,?,?,?)',
    [rv.id, rv.week, rv.type, rv.content || '', rv.updatedByName || '', rv.updatedAt || null]);
  return rv;
}

async function removeStudentRatings(studentId) {
  const sid = String(studentId);
  if (!USE_DB) {
    get().labor.forEach(l => { if (l.ratings) delete l.ratings[sid]; });
    get().culture.forEach(c => { if (c.ratings) delete c.ratings[sid]; });
    scheduleSave();
    return;
  }
  const lrs = await dbExecute('SELECT id, ratings FROM labor');
  for (const r of lrs.rows) {
    const ratings = JSON.parse(String(r.ratings || '{}'));
    if (sid in ratings) {
      delete ratings[sid];
      await dbExecute('UPDATE labor SET ratings = ? WHERE id = ?', [JSON.stringify(ratings), Number(r.id)]);
    }
  }
  const crs = await dbExecute('SELECT id, ratings FROM culture');
  for (const r of crs.rows) {
    const ratings = JSON.parse(String(r.ratings || '{}'));
    if (sid in ratings) {
      delete ratings[sid];
      await dbExecute('UPDATE culture SET ratings = ? WHERE id = ?', [JSON.stringify(ratings), Number(r.id)]);
    }
  }
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
  if (USE_DB) {
    await flushDoc();
  } else {
    writeFileBackend();
  }
}

function nextId(collection) {
  const db = state;
  db.counters = db.counters || {};
  db.counters[collection] = (db.counters[collection] || Math.max(0, ...db[collection].map(x => Number(x.id) || 0))) + 1;
  return db.counters[collection];
}

const SEQ_TABLES = { reviews: 'reviews', labor: 'labor', culture: 'culture' };

async function nextSeq(collection) {
  const tbl = SEQ_TABLES[collection];
  if (!tbl) return nextId(collection);
  const rs = await dbExecute(
    'INSERT INTO seq (name, val) VALUES (?, 0) ON CONFLICT(name) DO UPDATE SET val = val + 1 RETURNING val',
    [collection]
  );
  let v = Number(rs.rows[0].val);
  const max = Number((await dbExecute(`SELECT COALESCE(MAX(id), 0) m FROM ${tbl}`)).rows[0].m);
  if (v <= max) {
    v = max + 1;
    await dbExecute('UPDATE seq SET val = ? WHERE name = ?', [v, collection]);
  }
  return v;
}

async function putFile(name, mime, buf) {
  if (USE_DB) {
    await dbExecute(
      `INSERT INTO files (name, mime, size, data) VALUES (?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET mime = excluded.mime, size = excluded.size, data = excluded.data`,
      [name, mime, buf.length, buf]
    );
  } else {
    putFileOnDisk(name, buf);
  }
}

async function getFile(name) {
  if (!/^[a-z0-9]+\.(png|jpg|gif|webp)$/i.test(name)) return null;
  if (USE_DB) {
    const rs = await dbExecute('SELECT mime, data FROM files WHERE name = ?', [name]);
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
  await dbExecute('INSERT OR REPLACE INTO tokens (token, uid) VALUES (?, ?)', [token, Number(uid)]);
}

async function delToken(token) {
  if (!USE_DB) {
    if (state.tokens) delete state.tokens[token];
    dirty = true;
    return;
  }
  await dbExecute('DELETE FROM tokens WHERE token = ?', [token]);
}

async function findUidByToken(token) {
  if (!token) return null;
  if (!USE_DB) {
    const v = (state.tokens || {})[token];
    return v == null ? null : Number(v);
  }
  const rs = await dbExecute('SELECT uid FROM tokens WHERE token = ?', [token]);
  return rs.rows.length ? Number(rs.rows[0].uid) : null;
}

async function delTokensOfUser(uid) {
  if (!USE_DB) {
    const t = state.tokens || {};
    Object.keys(t).forEach(k => { if (Number(t[k]) === Number(uid)) delete t[k]; });
    dirty = true;
    return;
  }
  await dbExecute('DELETE FROM tokens WHERE uid = ?', [Number(uid)]);
}

if (!USE_DB) {
  process.on('exit', () => { try { if (dirty && state) writeFileBackend(); } catch (_) {} });
}
process.on('SIGINT', () => process.exit(0));

module.exports = {
  ensureReady, get, scheduleSave, persistNow, persistIfDirty, isDirty,
  refreshDocIfStale, nextId, nextSeq, putFile, getFile, setToken, delToken, findUidByToken, delTokensOfUser,
  useSql, weekInRange, summaryRanges,
  laborList, laborGet, laborInsert, laborUpdate, laborDelete,
  cultureList, cultureGet, cultureInsert, cultureUpdate, cultureDelete,
  reviewsList, reviewsFind, reviewsUpsert, removeStudentRatings,
  get useDb() { return USE_DB; }
};
