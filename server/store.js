const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

let state = null;
let saveTimer = null;

function load() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DATA_FILE)) {
    try {
      state = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
      console.error('Loi doc db.json, tao du lieu moi:', e.message);
      state = null;
    }
  }
  return state;
}

function init(defaults) {
  const loaded = load();
  if (!loaded) {
    state = defaults();
    persistNow();
    console.log('Da khoi tao du lieu mac dinh (data/db.json)');
  }
  return state;
}

function get() {
  return state;
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 150);
}

function persistNow() {
  clearTimeout(saveTimer);
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 1), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

function nextId(collection) {
  const db = state;
  db.counters = db.counters || {};
  db.counters[collection] = (db.counters[collection] || Math.max(0, ...db[collection].map(x => Number(x.id) || 0))) + 1;
  return db.counters[collection];
}

process.on('exit', () => { try { if (state) persistNow(); } catch (_) {} });
process.on('SIGINT', () => process.exit(0));

module.exports = { init, get, scheduleSave, persistNow, nextId };
