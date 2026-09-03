const express = require('express');
const crypto = require('crypto');
const store = require('./store');
const dbu = require('./db');

const router = express.Router();
const COOKIE = 'qlc_token';
const POSITIONS = ['lop_truong', 'pho_hoc_tap', 'pho_lao_dong', 'pho_van_the', 'thu_quy', 'to_truong', 'bi_thu', 'pho_bi_thu', 'uy_vien'];
const weekInRange = store.weekInRange;

function getDb() { return store.get(); }

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

async function currentUser(req) {
  const token = parseCookies(req)[COOKIE];
  if (!token) return null;
  const db = getDb();
  const uid = await store.findUidByToken(token);
  return uid ? (db.users.find(u => u.id === Number(uid)) || null) : null;
}

async function requireAuth(req, res, next) {
  try {
    const u = await currentUser(req);
    if (!u) return res.status(401).json({ error: 'Chưa đăng nhập' });
    req.user = u;
    next();
  } catch (e) { next(e); }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Chỉ ADMIN được phép' });
  next();
}

function requireTeacher(req, res, next) {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Chỉ GIÁO VIÊN mới có quyền này' });
  next();
}

function positionsOf(st) {
  if (!st) return [];
  if (Array.isArray(st.positions) && st.positions.length) return st.positions;
  if (st.position) return [st.position];
  return [];
}

function normalizePositions(input) {
  if (Array.isArray(input)) {
    const arr = [...new Set(input.map(p => String(p)).filter(p => POSITIONS.includes(p)))];
    return arr.length ? arr : ['thanh_vien'];
  }
  const pos = POSITIONS.includes(input) ? input : 'thanh_vien';
  return [pos];
}

function myPosition(req) {
  if (req.user.role !== 'student') return null;
  const st = getDb().students.find(s => s.id === req.user.studentId);
  return positionsOf(st);
}

function requirePos(list) {
  return (req, res, next) => {
    const pos = myPosition(req);
    if (!pos || !pos.some(p => list.includes(p))) return res.status(403).json({ error: 'Chức vụ của bạn không có quyền này' });
    next();
  };
}

function weekOf(dateStr) {
  const s = getDb().settings;
  const start = new Date(s.startDate + 'T00:00:00');
  const d = new Date((dateStr || new Date().toISOString().slice(0, 10)) + 'T00:00:00');
  if (isNaN(start) || isNaN(d)) return 1;
  let w = Math.floor((d - start) / (7 * 86400000)) + 1;
  if (w < 1) w = 0;
  return Math.min(w, s.weeks || 36);
}

function currentWeek() { return weekOf(new Date().toISOString().slice(0, 10)); }

function publicUser(u) {
  return { id: u.id, username: u.username, role: u.role, name: u.name, studentId: u.studentId };
}

function buildPermissions(req) {
  const pos = myPosition(req) || [];
  const has = p => pos.includes(p);
  const r = req.user.role;
  return {
    admin: r === 'admin',
    isTeacher: r === 'teacher',
    isStudent: r === 'student',
    viewClass: r !== 'admin',
    manageSettings: r === 'admin',
    manageTeachers: r === 'admin',
    manageGroups: r === 'teacher',
    manageStudents: r === 'teacher',
    approveRecords: r === 'teacher',
    addRecords: has('to_truong'),
    reviewClass: has('lop_truong'),
    reviewStudy: has('pho_hoc_tap'),
    reviewLeader: has('to_truong'),
    manageLabor: has('pho_lao_dong'),
    manageCulture: has('pho_van_the'),
    manageTreasury: has('thu_quy'),
    manageAnnouncements: ['bi_thu', 'pho_bi_thu', 'uy_vien'].some(p => has(p)),
    positions: pos
  };
}

function isHttps(req) {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

function setAuthCookie(req, res, token, maxAge) {
  const secure = isHttps(req) ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}

router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  const db = getDb();
  const u = db.users.find(x => x.username === String(username || '').trim());
  if (!u || !dbu.verifyPassword(password || '', u.salt, u.passHash)) {
    return res.status(400).json({ error: 'Sai tài khoản hoặc mật khẩu' });
  }
  const token = dbu.newToken();
  await store.setToken(token, u.id);
  setAuthCookie(req, res, token, 604800);
  res.json({ ok: true });
});

router.post('/auth/change-password', requireAuth, (req, res) => {
  const b = req.body || {};
  const oldP = String(b.oldPassword || '');
  const newP = String(b.newPassword || '');
  if (newP.length < 4) return res.status(400).json({ error: 'Mật khẩu mới tối thiểu 4 ký tự' });
  if (!dbu.verifyPassword(oldP, req.user.salt, req.user.passHash)) {
    return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
  }
  const { salt, hash } = dbu.hashPassword(newP);
  req.user.salt = salt;
  req.user.passHash = hash;
  store.scheduleSave();
  res.json({ ok: true });
});

router.post('/auth/logout', async (req, res) => {
  const token = parseCookies(req)[COOKIE];
  if (token) { await store.delToken(token); }
  setAuthCookie(req, res, '', 0);
  res.json({ ok: true });
});

function classIdOf(req) {
  const db = getDb();
  const sup = req.query && req.query.classId != null ? req.query.classId : (req.body && req.body.classId != null ? req.body.classId : null);
  const id = sup != null ? Number(sup) : (db.settings && db.settings.currentClassId);
  const c = (db.classes || []).find(x => Number(x.id) === Number(id));
  return c ? Number(c.id) : ((db.classes[0] && db.classes[0].id) || null);
}

function scopeStudents(req) {
  const db = getDb();
  const cid = classIdOf(req);
  const byClass = (list) => (cid == null ? list : list.filter(s => (s.classId === undefined ? true : Number(s.classId) === cid)));
  if (req.user.role === 'teacher') return byClass(db.students);
  if (req.user.role === 'student') {
    const meSt = db.students.find(s => Number(s.id) === Number(req.user.studentId));
    if (!meSt) return [];
    return byClass(db.students).filter(s => s.groupId === meSt.groupId);
  }
  return [];
}

router.get('/bootstrap', requireAuth, (req, res) => {
  const db = getDb();
  const classes = db.classes || [];
  let managedClassIds = null;
  if (req.user.role === 'teacher') {
    managedClassIds = classes.filter(c => (c.managerIds || []).includes(req.user.id)).map(c => c.id);
  }
  const cid = classIdOf(req);
  const groups = (db.groups || []).filter(g => (g.classId === undefined ? true : Number(g.classId) === cid));
  const cls = (db.classes || []).find(c => Number(c.id) === cid) || null;
  const clsSettings = cls ? {
    className: cls.name,
    schoolYear: cls.schoolYear,
    grade: cls.grade,
    weeks: cls.weeks,
    startDate: cls.startDate,
    baseStudentWeek: cls.baseStudentWeek,
    baseClassWeek: cls.baseClassWeek,
    currentClassId: cid
  } : null;
  res.json({
    me: publicUser(req.user),
    student: db.students.find(s => s.id === req.user.studentId) || null,
    settings: clsSettings || db.settings,
    classes: classes,
    currentClassId: cid,
    managedClassIds: managedClassIds,
    groups: groups,
    types: cls && Array.isArray(cls.types) && cls.types.length ? cls.types : db.types,
    currentWeek: currentWeek(),
    permissions: buildPermissions(req),
    counts: {
      teachers: db.users.filter(u => u.role === 'teacher').length,
      students: (db.students || []).filter(s => s.classId === undefined ? true : Number(s.classId) === cid).length,
      groups: groups.length,
      types: db.types.length
    }
  });
});

router.put('/settings', requireAuth, requireAdmin, async (req, res) => {
  const db = getDb();
  const b = req.body || {};
  const num = (v, min, dflt) => { const n = Number(v); return isFinite(n) && n >= min ? n : dflt; };
  db.settings = {
    schoolYear: String(b.schoolYear || db.settings.schoolYear).trim(),
    className: String(b.className || db.settings.className).trim(),
    grade: num(b.grade, 1, db.settings.grade),
    weeks: Math.round(num(b.weeks, 1, db.settings.weeks)),
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(b.startDate || '') ? b.startDate : db.settings.startDate,
    baseStudentWeek: num(b.baseStudentWeek, 0, db.settings.baseStudentWeek),
    baseClassWeek: num(b.baseClassWeek, 0, db.settings.baseClassWeek),
    currentClassId: db.settings.currentClassId
  };
  try {
    await store.persistNow();
  } catch (e) {
    console.error('[api] Loi luu settings:', e.message || e);
    return res.status(500).json({ error: 'Không lưu được cài đặt, thử lại' });
  }
  res.json(db.settings);
});

/* ---------- Quan ly lop hoc (classes) ---------- */

function publicClass(c) {
  return {
    id: c.id,
    name: c.name,
    schoolYear: c.schoolYear,
    grade: c.grade,
    weeks: c.weeks,
    startDate: c.startDate,
    baseStudentWeek: c.baseStudentWeek,
    baseClassWeek: c.baseClassWeek,
    managerIds: c.managerIds || []
  };
}

router.get('/classes', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const teacherNames = {};
  db.users.filter(u => u.role === 'teacher').forEach(u => { teacherNames[u.id] = u.name; });
  res.json((db.classes || []).map(c => ({
    ...publicClass(c),
    managers: (c.managerIds || []).map(id => ({ id, name: teacherNames[id] || 'Giáo viên' }))
  })));
});

router.post('/classes', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  db.classes = db.classes || [];
  const b = req.body || {};
  if (!String(b.name || '').trim()) return res.status(400).json({ error: 'Thiếu tên lớp' });
  const num = (v, min, dflt) => { const n = Number(v); return isFinite(n) && n >= min ? n : dflt; };
  const c = {
    id: store.nextId('classes'),
    name: String(b.name).trim(),
    schoolYear: String(b.schoolYear || '').trim(),
    grade: num(b.grade, 1, 10),
    weeks: Math.round(num(b.weeks, 1, 36)),
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(b.startDate || '') ? b.startDate : '',
    baseStudentWeek: num(b.baseStudentWeek, 0, 0),
    baseClassWeek: num(b.baseClassWeek, 0, 0),
    managerIds: (Array.isArray(b.managerIds) ? b.managerIds : []).map(Number).filter(id => db.users.some(u => u.id === id && u.role === 'teacher')),
    types: (db.types || []).map(t => ({ ...t }))
  };
  db.classes.push(c);
  if (db.settings && db.settings.currentClassId == null) db.settings.currentClassId = c.id;
  store.scheduleSave();
  res.json(publicClass(c));
});
router.put('/classes/:id', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  db.classes = db.classes || [];
  const c = db.classes.find(x => x.id === Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Không tìm thấy lớp' });
  const b = req.body || {};
  const num = (v, min, dflt) => { const n = Number(v); return isFinite(n) && n >= min ? n : dflt; };
  if (b.name !== undefined && String(b.name).trim()) c.name = String(b.name).trim();
  if (b.schoolYear !== undefined) c.schoolYear = String(b.schoolYear).trim();
  if (b.grade !== undefined) c.grade = num(b.grade, 1, c.grade);
  if (b.weeks !== undefined) c.weeks = Math.round(num(b.weeks, 1, c.weeks));
  if (b.startDate !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(b.startDate)) c.startDate = b.startDate;
  if (b.baseStudentWeek !== undefined) c.baseStudentWeek = num(b.baseStudentWeek, 0, c.baseStudentWeek);
  if (b.baseClassWeek !== undefined) c.baseClassWeek = num(b.baseClassWeek, 0, c.baseClassWeek);
  if (db.settings && db.settings.currentClassId === c.id) store.syncSettingsToCurrentClass();
  store.scheduleSave();
  res.json(publicClass(c));
});

router.put('/classes/:id/managers', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  db.classes = db.classes || [];
  const c = db.classes.find(x => x.id === Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Không tìm thấy lớp' });
  const { managerIds } = req.body || {};
  if (!Array.isArray(managerIds)) return res.status(400).json({ error: 'Danh sách quản lý không hợp lệ' });
  c.managerIds = managerIds.map(Number).filter(id => db.users.some(u => u.id === id && u.role === 'teacher'));
  store.scheduleSave();
  res.json(publicClass(c));
});

router.delete('/classes/:id', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  db.classes = db.classes || [];
  const id = Number(req.params.id);
  const idx = db.classes.findIndex(x => x.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy lớp' });
  if (db.classes.length === 1) return res.status(400).json({ error: 'Không thể xóa lớp duy nhất' });
  db.classes.splice(idx, 1);
  // xoa du lieu thuoc lop nay
  const cid = id;
  const keep = (arr, k) => Array.isArray(arr) ? arr.filter(x => (x[k] === undefined ? true : Number(x[k]) !== cid)) : arr;
  db.students = keep(db.students, 'classId');
  db.groups = keep(db.groups, 'classId');
  db.records = keep(db.records, 'classId');
  db.transactions = keep(db.transactions, 'classId');
  db.announcements = keep(db.announcements, 'classId');
  if ((db.settings && db.settings.currentClassId) === id) {
    db.settings.currentClassId = db.classes[0].id;
    store.syncSettingsToCurrentClass();
    store.syncTypesToCurrentClass();
  }
  store.scheduleSave();
  res.json({ ok: true });
});

router.put('/current-class', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const b = req.body || {};
  const id = Number(b.id);
  const c = (db.classes || []).find(x => x.id === id);
  if (!c) return res.status(404).json({ error: 'Không tìm thấy lớp' });
  db.settings = db.settings || {};
  db.settings.currentClassId = c.id;
  store.syncSettingsToCurrentClass();
  store.syncTypesToCurrentClass();
  store.scheduleSave();
  res.json({ currentClassId: c.id, className: c.name });
});

router.get('/types', requireAuth, (req, res) => {
  res.json(getDb().types);
});

router.post('/types', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const { kind, name, points } = req.body || {};
  if (!['achievement', 'violation'].includes(kind)) return res.status(400).json({ error: 'Loại không hợp lệ' });
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Thiếu tên loại' });
  const p = Number(points);
  if (!(p > 0)) return res.status(400).json({ error: 'Điểm phải > 0' });
  const t = { id: store.nextId('types'), kind, name: String(name).trim(), points: p };
  db.types.push(t);
  const cls = store.currentClass();
  if (cls) { (cls.types = cls.types || []).push({ ...t }); }
  store.scheduleSave();
  res.json(t);
});

router.put('/types/:id', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const t = db.types.find(x => x.id === Number(req.params.id));
  if (!t) return res.status(404).json({ error: 'Không tìm thấy' });
  const b = req.body || {};
  if (b.name !== undefined) t.name = String(b.name).trim() || t.name;
  if (b.points !== undefined) { const p = Number(b.points); if (p > 0) t.points = p; }
  const cls = store.currentClass();
  if (cls) {
    const ct = (cls.types || []).find(x => x.id === t.id);
    if (ct) { ct.name = t.name; ct.points = t.points; }
  }
  store.scheduleSave();
  res.json(t);
});

router.delete('/types/:id', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  db.types = db.types.filter(t => t.id !== id);
  const cls = store.currentClass();
  if (cls) cls.types = (cls.types || []).filter(t => t.id !== id);
  store.scheduleSave();
  res.json({ ok: true });
});

router.get('/users', requireAuth, requireAdmin, (req, res) => {
  res.json(getDb().users.filter(u => u.role === 'teacher').map(publicUser));
});

router.post('/users', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const { username, password, name } = req.body || {};
  const un = String(username || '').trim();
  if (!un || !password) return res.status(400).json({ error: 'Thiếu tài khoản/mật khẩu' });
  if (db.users.some(u => u.username === un)) return res.status(400).json({ error: 'Tài khoản đã tồn tại' });
  const { salt, hash } = dbu.hashPassword(password);
  const u = { id: store.nextId('users'), username: un, role: 'teacher', name: String(name || un).trim(), studentId: null, salt, passHash: hash, createdAt: new Date().toISOString() };
  db.users.push(u);
  store.scheduleSave();
  res.json(publicUser(u));
});

router.put('/users/:id', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const u = db.users.find(x => x.id === Number(req.params.id) && x.role === 'teacher');
  if (!u) return res.status(404).json({ error: 'Không tìm thấy giáo viên' });
  const b = req.body || {};
  if (b.name !== undefined) u.name = String(b.name).trim() || u.name;
  if (b.password) { const { salt, hash } = dbu.hashPassword(b.password); u.salt = salt; u.passHash = hash; }
  store.scheduleSave();
  res.json(publicUser(u));
});

router.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const u = db.users.find(x => x.id === id);
  if (!u || u.role !== 'teacher') return res.status(404).json({ error: 'Không tìm thấy giáo viên' });
  await store.delTokensOfUser(id);
  db.users = db.users.filter(x => x.id !== id);
  store.scheduleSave();
  res.json({ ok: true });
});

router.get('/groups', requireAuth, (req, res) => {
  const db = getDb();
  const cid = classIdOf(req);
  res.json((db.groups || []).filter(g => g.classId === undefined ? true : Number(g.classId) === cid));
});

router.post('/groups', requireAuth, requireTeacher, (req, res) => {
  const db = getDb();
  const { name, rows, cols } = req.body || {};
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Thiếu tên tổ' });
  const r = Math.min(Math.max(Number(rows) || 2, 1), 10);
  const c = Math.min(Math.max(Number(cols) || 2, 1), 10);
  const cid = classIdOf(req);
  const g = { id: store.nextId('groups'), name: String(name).trim(), rows: r, cols: c, classId: cid };
  db.groups.push(g);
  store.scheduleSave();
  res.json(g);
});

router.put('/groups/:id', requireAuth, requireTeacher, (req, res) => {
  const db = getDb();
  const cid = classIdOf(req);
  const g = (db.groups || []).find(x => x.id === Number(req.params.id) && (x.classId === undefined ? true : Number(x.classId) === cid));
  if (!g) return res.status(404).json({ error: 'Không tìm thấy tổ' });
  const b = req.body || {};
  if (b.name !== undefined && String(b.name).trim()) g.name = String(b.name).trim();
  if (b.rows !== undefined) g.rows = Math.min(Math.max(Number(b.rows) || g.rows, 1), 10);
  if (b.cols !== undefined) g.cols = Math.min(Math.max(Number(b.cols) || g.cols, 1), 10);
  db.students.forEach(s => {
    if (s.groupId === g.id) {
      if (s.row !== null && s.row >= g.rows) { s.row = null; s.col = null; }
      else if (s.col !== null && s.col >= g.cols) { s.row = null; s.col = null; }
    }
  });
  store.scheduleSave();
  res.json(g);
});

router.delete('/groups/:id', requireAuth, requireTeacher, (req, res) => {
  const db = getDb();
  const cid = classIdOf(req);
  const id = Number(req.params.id);
  if (db.students.some(s => (s.classId === undefined ? true : Number(s.classId) === cid) && s.groupId === id)) return res.status(400).json({ error: 'Tổ còn học sinh, hãy chuyển họ sang tổ khác trước' });
  db.groups = db.groups.filter(g => g.id !== id && (g.classId === undefined ? true : Number(g.classId) === cid));
  store.scheduleSave();
  res.json({ ok: true });
});

router.get('/students', requireAuth, (req, res) => {
  const db = getDb();
  const cid = classIdOf(req);
  if (req.query.all === '1' && req.user.role === 'student') {
    const perms = buildPermissions(req);
    if (perms.manageLabor || perms.manageCulture || perms.manageTreasury || perms.reviewClass || perms.reviewStudy || perms.addRecords) {
      return res.json((db.students || []).filter(s => s.classId === undefined ? true : Number(s.classId) === cid));
    }
  }
  res.json(scopeStudents(req));
});

router.post('/students', requireAuth, requireTeacher, (req, res) => {
  const db = getDb();
  const b = req.body || {};
  if (!String(b.name || '').trim()) return res.status(400).json({ error: 'Thiếu tên học sinh' });
  const cid = classIdOf(req);
  const g = (db.groups || []).find(x => x.id === Number(b.groupId) && (x.classId === undefined ? true : Number(x.classId) === cid));
  if (!g) return res.status(400).json({ error: 'Tổ không tồn tại' });
  const positions = normalizePositions(b.positions);
  if (positions.some(p => p !== 'thanh_vien')) {
    const clash = (db.students || []).find(o => (o.classId === undefined ? true : Number(o.classId) === cid) && positionsOf(o).some(op => op !== 'thanh_vien' && positions.includes(op) && ['lop_truong', 'pho_hoc_tap', 'pho_lao_dong', 'pho_van_the', 'thu_quy'].includes(op)));
    if (clash) return res.status(400).json({ error: `Chức vụ đã có ${clash.name} giữ` });
  }
  let row = Number.isInteger(Number(b.row)) ? Number(b.row) : null;
  let col = Number.isInteger(Number(b.col)) ? Number(b.col) : null;
  if (row !== null && col !== null) {
    row = row < g.rows ? row : null;
    col = col < g.cols ? col : null;
    if (row !== null && db.students.some(s => (s.classId === undefined ? true : Number(s.classId) === cid) && s.groupId === g.id && s.row === row && s.col === col)) { row = null; col = null; }
  }
  const st = {
    id: store.nextId('students'),
    name: String(b.name).trim(),
    dob: b.dob || '',
    gender: b.gender === 'Nữ' ? 'Nữ' : 'Nam',
    address: String(b.address || ''),
    photo: String(b.photo || ''),
    groupId: g.id, row, col, positions, position: positions[0], classId: cid
  };
  db.students.push(st);
  store.scheduleSave();
  res.json(st);
});

router.put('/students/:id', requireAuth, requireTeacher, (req, res) => {
  const db = getDb();
  const cid = classIdOf(req);
  const st = (db.students || []).find(s => s.id === Number(req.params.id) && (s.classId === undefined ? true : Number(s.classId) === cid));
  if (!st) return res.status(404).json({ error: 'Không tìm thấy học sinh' });
  const b = req.body || {};
  if (b.name !== undefined && String(b.name).trim()) st.name = String(b.name).trim();
  if (b.dob !== undefined) st.dob = b.dob || '';
  if (b.gender !== undefined) st.gender = b.gender === 'Nữ' ? 'Nữ' : 'Nam';
  if (b.address !== undefined) st.address = String(b.address);
  if (b.photo !== undefined) st.photo = String(b.photo);
  if (b.positions !== undefined) {
    const newPositions = normalizePositions(b.positions);
    if (newPositions.some(p => p !== 'thanh_vien')) {
      const clash = (db.students || []).find(o => o.id !== st.id && o.positions && o.positions.some(op => op !== 'thanh_vien' && newPositions.includes(op) && ['lop_truong', 'pho_hoc_tap', 'pho_lao_dong', 'pho_van_the', 'thu_quy'].includes(op)));
      if (clash) return res.status(400).json({ error: `Chức vụ đã có ${clash.name} giữ` });
    }
    st.positions = newPositions;
    st.position = newPositions[0];
  }
  if (b.groupId !== undefined) {
    const g = (db.groups || []).find(x => x.id === Number(b.groupId) && (x.classId === undefined ? true : Number(x.classId) === cid));
    if (!g) return res.status(400).json({ error: 'Tổ không tồn tại' });
    if (g.id !== st.groupId) {
      st.groupId = g.id;
      st.row = null;
      st.col = null;
    }
  }
  store.scheduleSave();
  res.json(st);
});

router.put('/students/:id/seat', requireAuth, requireTeacher, (req, res) => {
  const db = getDb();
  const cid = classIdOf(req);
  const st = (db.students || []).find(s => s.id === Number(req.params.id) && (s.classId === undefined ? true : Number(s.classId) === cid));
  if (!st) return res.status(404).json({ error: 'Không tìm thấy học sinh' });
  const { groupId, row, col } = req.body || {};
  const g = (db.groups || []).find(x => x.id === Number(groupId) && (x.classId === undefined ? true : Number(x.classId) === cid));
  if (!g) return res.status(400).json({ error: 'Tổ không tồn tại' });
  const r = Number(row), c = Number(col);
  if (!(r >= 0 && r < g.rows && c >= 0 && c < g.cols)) return res.status(400).json({ error: 'Vị trí không hợp lệ' });
  const occupant = (db.students || []).find(s => (s.classId === undefined ? true : Number(s.classId) === cid) && s.groupId === g.id && s.row === r && s.col === c && s.id !== st.id);
  if (occupant) {
    if (st.groupId === g.id && st.row !== null) {
      const oldRow = st.row, oldCol = st.col;
      occupant.row = oldRow; occupant.col = oldCol;
    } else {
      occupant.row = null; occupant.col = null;
    }
  }
  st.groupId = g.id; st.row = r; st.col = c;
  store.scheduleSave();
  res.json({ ok: true });
});

router.delete('/students/:id', requireAuth, requireTeacher, async (req, res) => {
  const db = getDb();
  const cid = classIdOf(req);
  const id = Number(req.params.id);
  db.students = db.students.filter(s => !(s.id === id && (s.classId === undefined ? true : Number(s.classId) === cid)));
  db.users = db.users.filter(u => u.studentId !== id);
  db.records = db.records.filter(r => r.studentId !== id && (r.classId === undefined ? true : Number(r.classId) === cid));
  await store.removeStudentRatings(id, cid);
  store.scheduleSave();
  res.json({ ok: true });
});

router.post('/students/:id/account', requireAuth, requireTeacher, (req, res) => {
  const db = getDb();
  const cid = classIdOf(req);
  const st = (db.students || []).find(s => s.id === Number(req.params.id) && (s.classId === undefined ? true : Number(s.classId) === cid));
  if (!st) return res.status(404).json({ error: 'Không tìm thấy học sinh' });
  const { username, password } = req.body || {};
  const un = String(username || '').trim();
  let u = db.users.find(x => x.studentId === st.id);
  if (!un || !password) return res.status(400).json({ error: 'Thiếu tài khoản/mật khẩu' });
  if (db.users.some(x => x.username === un && (!u || x.id !== u.id))) return res.status(400).json({ error: 'Tài khoản đã tồn tại' });
  const { salt, hash } = dbu.hashPassword(password);
  if (u) { u.username = un; u.salt = salt; u.passHash = hash; u.name = st.name; }
  else {
    u = { id: store.nextId('users'), username: un, role: 'student', name: st.name, studentId: st.id, salt, passHash: hash, createdAt: new Date().toISOString() };
    db.users.push(u);
  }
  store.scheduleSave();
  res.json({ ok: true, userId: u.id });
});

router.get('/records', requireAuth, (req, res) => {
  const db = getDb();
  const { week, status } = req.query;
  const allowed = new Set(scopeStudents(req).map(s => s.id));
  const cid = classIdOf(req);
  let list = (db.records || []).filter(r => r.classId === undefined ? true : Number(r.classId) === cid).slice().reverse();
  if (req.user.role === 'student') list = list.filter(r => allowed.has(r.studentId));
  if (week) list = list.filter(r => weekInRange(r.week, week));
  if (status) list = list.filter(r => r.status === status);
  res.json(list.map(r => ({
    ...r,
    studentName: (db.students.find(s => s.id === r.studentId) || {}).name || '(đã xóa)',
    groupName: ((db.groups.find(g => g.id === (db.students.find(s => s.id === r.studentId) || {}).groupId) || {}).name) || '',
    typeName: (db.types.find(t => t.id === r.typeId) || {}).name || '',
    typePoints: (db.types.find(t => t.id === r.typeId) || {}).points || 0
  })));
});

router.post('/records', requireAuth, requirePos(['to_truong']), (req, res) => {
  const db = getDb();
  const cid = classIdOf(req);
  const b = req.body || {};
  const st = (db.students || []).find(s => s.id === Number(b.studentId) && (s.classId === undefined ? true : Number(s.classId) === cid));
  const t = db.types.find(x => x.id === Number(b.typeId));
  if (!st) return res.status(400).json({ error: 'Học sinh không hợp lệ' });
  if (!t) return res.status(400).json({ error: 'Loại thành tích/vi phạm không hợp lệ' });
  const meSt = (db.students || []).find(s => s.id === req.user.studentId && (s.classId === undefined ? true : Number(s.classId) === cid));
  if (!meSt || st.groupId !== meSt.groupId) return res.status(403).json({ error: 'Chỉ được gửi cho học sinh trong tổ mình' });
  const r = {
    id: store.nextId('records'),
    studentId: st.id,
    typeId: t.id,
    kind: t.kind,
    week: Math.min(Math.max(Number(b.week) || currentWeek(), 0), db.settings.weeks || 36),
    note: String(b.note || ''),
    status: 'pending',
    createdBy: req.user.id,
    createdByName: req.user.name,
    reviewedBy: null,
    classId: (st.classId === undefined ? cid : st.classId),
    createdAt: new Date().toISOString()
  };
  db.records.push(r);
  store.scheduleSave();
  res.json(r);
});

router.put('/records/:id/status', requireAuth, requireTeacher, (req, res) => {
  const db = getDb();
  const cid = classIdOf(req);
  const r = (db.records || []).find(x => x.id === Number(req.params.id) && (x.classId === undefined ? true : Number(x.classId) === cid));
  if (!r) return res.status(404).json({ error: 'Không tìm thấy' });
  const { status } = req.body || {};
  if (!['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
  r.status = status;
  r.reviewedBy = req.user.name;
  store.scheduleSave();
  res.json(r);
});

router.delete('/records/:id', requireAuth, (req, res) => {
  const db = getDb();
  const cid = classIdOf(req);
  const id = Number(req.params.id);
  const r = (db.records || []).find(x => x.id === id && (x.classId === undefined ? true : Number(x.classId) === cid));
  if (!r) return res.status(404).json({ error: 'Không tìm thấy' });
  if (req.user.role !== 'teacher' && !(r.createdBy === req.user.id && r.status === 'pending')) {
    return res.status(403).json({ error: 'Không thể xóa bản ghi này' });
  }
  db.records = db.records.filter(x => !(x.id === id && (x.classId === undefined ? true : Number(x.classId) === cid)));
  store.scheduleSave();
  res.json({ ok: true });
});

router.get('/reviews', requireAuth, async (req, res) => {
  const cid = classIdOf(req);
  const list = await store.reviewsList(req.query.week || null, cid);
  res.json(list);
});

router.put('/reviews', requireAuth, requirePos(['lop_truong', 'pho_hoc_tap']), async (req, res) => {
  const cid = classIdOf(req);
  const { week, type, content } = req.body || {};
  if (!['class', 'study'].includes(type)) return res.status(400).json({ error: 'Loại nhận xét không hợp lệ' });
  const w = Number(week) || currentWeek();
  const rv = {
    id: await store.nextSeq('reviews'),
    week: w,
    type,
    content: String(content || ''),
    updatedByName: req.user.name,
    updatedAt: new Date().toISOString()
  };
  const saved = await store.reviewsUpsert(rv, cid);
  res.json(saved);
});

router.put('/reviews/mine', requireAuth, requirePos(['to_truong']), async (req, res) => {
  const cid = classIdOf(req);
  const { week, content } = req.body || {};
  const w = Number(week) || currentWeek();
  const meSt = (getDb().students || []).find(s => s.id === req.user.studentId && (s.classId === undefined ? true : Number(s.classId) === cid));
  const rv = {
    id: await store.nextSeq('reviews'),
    week: w,
    type: 'leader',
    content: String(content || ''),
    updatedByName: req.user.name,
    updatedAt: new Date().toISOString(),
    uid: req.user.id,
    groupId: meSt && meSt.groupId != null ? Number(meSt.groupId) : null
  };
  const saved = await store.reviewsUpsert(rv, cid);
  res.json(saved);
});

router.get('/labor', requireAuth, async (req, res) => {
  const cid = classIdOf(req);
  let list = await store.laborList(cid);
  list.sort((a, b) => (a.date < b.date ? 1 : -1));
  if (req.query.week) {
    const wq = req.query.week;
    const wn = Number(wq);
    if (!isNaN(wn)) {
      list = list.filter(l => weekOf(l.date) === wn);
    } else {
      const range = store.summaryRanges()[wq];
      if (range) list = list.filter(l => { const w = weekOf(l.date); return w >= range[0] && w <= range[1]; });
    }
  }
  res.json(list);
});

router.post('/labor', requireAuth, requirePos(['pho_lao_dong']), async (req, res) => {
  const cid = classIdOf(req);
  const b = req.body || {};
  if (!String(b.name || '').trim()) return res.status(400).json({ error: 'Thiếu tên buổi lao động' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return res.status(400).json({ error: 'Ngày không hợp lệ' });
  const l = {
    id: await store.nextSeq('labor'),
    name: String(b.name).trim(),
    date: b.date,
    session: ['Sáng', 'Chiều', 'Tối'].includes(b.session) ? b.session : 'Sáng',
    time: String(b.time || ''),
    ratings: {},
    classId: cid
  };
  await store.laborInsert(l);
  res.json(l);
});

router.put('/labor/:id', requireAuth, requirePos(['pho_lao_dong']), async (req, res) => {
  const cid = classIdOf(req);
  const b = req.body || {};
  const fields = {};
  if (b.name !== undefined && String(b.name).trim()) fields.name = String(b.name).trim();
  if (b.date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) fields.date = b.date;
  if (b.session !== undefined && ['Sáng', 'Chiều', 'Tối'].includes(b.session)) fields.session = b.session;
  if (b.time !== undefined) fields.time = String(b.time);
  const l = await store.laborUpdate(req.params.id, fields, cid);
  if (!l) return res.status(404).json({ error: 'Không tìm thấy buổi lao động' });
  res.json(l);
});

router.put('/labor/:id/ratings', requireAuth, requirePos(['pho_lao_dong']), async (req, res) => {
  const cid = classIdOf(req);
  const l = await store.laborGet(Number(req.params.id), cid);
  if (!l) return res.status(404).json({ error: 'Không tìm thấy buổi lao động' });
  const { ratings } = req.body || {};
  l.ratings = l.ratings || {};
  Object.entries(ratings || {}).forEach(([sid, lv]) => {
    if (['A', 'B', 'C', 'V', ''].includes(lv)) {
      if (lv === '') delete l.ratings[sid];
      else l.ratings[sid] = lv;
    }
  });
  const updated = await store.laborUpdate(req.params.id, { ratings: l.ratings }, cid);
  res.json(updated);
});

router.delete('/labor/:id', requireAuth, requirePos(['pho_lao_dong']), async (req, res) => {
  const cid = classIdOf(req);
  await store.laborDelete(req.params.id, cid);
  res.json({ ok: true });
});

router.get('/culture', requireAuth, async (req, res) => {
  const cid = classIdOf(req);
  let list = await store.cultureList(cid);
  list.sort((a, b) => (a.date < b.date ? 1 : -1));
  if (req.query.week) {
    const wq = req.query.week;
    const wn = Number(wq);
    if (!isNaN(wn)) {
      list = list.filter(c => weekOf(c.date) === wn);
    } else {
      const range = store.summaryRanges()[wq];
      if (range) list = list.filter(c => { const w = weekOf(c.date); return w >= range[0] && w <= range[1]; });
    }
  }
  res.json(list);
});

router.post('/culture', requireAuth, requirePos(['pho_van_the']), async (req, res) => {
  const cid = classIdOf(req);
  const b = req.body || {};
  if (!String(b.name || '').trim()) return res.status(400).json({ error: 'Thiếu tên hoạt động' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return res.status(400).json({ error: 'Ngày không hợp lệ' });
  const c = { id: await store.nextSeq('culture'), name: String(b.name).trim(), date: b.date, desc: String(b.desc || ''), ratings: {}, classId: cid };
  await store.cultureInsert(c);
  res.json(c);
});

router.put('/culture/:id', requireAuth, requirePos(['pho_van_the']), async (req, res) => {
  const cid = classIdOf(req);
  const b = req.body || {};
  const fields = {};
  if (b.name !== undefined && String(b.name).trim()) fields.name = String(b.name).trim();
  if (b.date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) fields.date = b.date;
  if (b.desc !== undefined) fields.desc = String(b.desc);
  const c = await store.cultureUpdate(req.params.id, fields, cid);
  if (!c) return res.status(404).json({ error: 'Không tìm thấy hoạt động' });
  res.json(c);
});

router.put('/culture/:id/ratings', requireAuth, requirePos(['pho_van_the']), async (req, res) => {
  const cid = classIdOf(req);
  const c = await store.cultureGet(Number(req.params.id), cid);
  if (!c) return res.status(404).json({ error: 'Không tìm thấy hoạt động' });
  const { ratings } = req.body || {};
  c.ratings = c.ratings || {};
  Object.entries(ratings || {}).forEach(([sid, lv]) => {
    if (['A', 'B', 'C', 'V', ''].includes(lv)) {
      if (lv === '') delete c.ratings[sid];
      else c.ratings[sid] = lv;
    }
  });
  const updated = await store.cultureUpdate(req.params.id, { ratings: c.ratings }, cid);
  res.json(updated);
});

router.delete('/culture/:id', requireAuth, requirePos(['pho_van_the']), async (req, res) => {
  const cid = classIdOf(req);
  await store.cultureDelete(req.params.id, cid);
  res.json({ ok: true });
});

router.get('/transactions', requireAuth, (req, res) => {
  const db = getDb();
  const cid = classIdOf(req);
  const scoped = (db.transactions || []).filter(x => x.classId === undefined ? true : Number(x.classId) === cid);
  const list = scoped.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  res.json({ list, balance: scoped.reduce((t, x) => t + Number(x.amount || 0), 0) });
});

router.post('/transactions', requireAuth, requirePos(['thu_quy']), (req, res) => {
  const db = getDb();
  const cid = classIdOf(req);
  const b = req.body || {};
  const amount = Number(b.amount);
  if (!isFinite(amount) || amount === 0) return res.status(400).json({ error: 'Số tiền không hợp lệ' });
  if (!String(b.desc || '').trim()) return res.status(400).json({ error: 'Thiếu nội dung chi tiêu' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return res.status(400).json({ error: 'Ngày không hợp lệ' });
  const t = { id: store.nextId('transactions'), amount: Math.round(amount), desc: String(b.desc).trim(), date: b.date, createdBy: req.user.id, classId: cid };
  db.transactions.push(t);
  store.scheduleSave();
  res.json(t);
});

router.put('/transactions/:id', requireAuth, requirePos(['thu_quy']), (req, res) => {
  const db = getDb();
  const cid = classIdOf(req);
  const t = (db.transactions || []).find(x => x.id === Number(req.params.id) && (x.classId === undefined ? true : Number(x.classId) === cid));
  if (!t) return res.status(404).json({ error: 'Không tìm thấy giao dịch' });
  const b = req.body || {};
  if (b.amount !== undefined) { const a = Number(b.amount); if (isFinite(a) && a !== 0) t.amount = Math.round(a); }
  if (b.desc !== undefined && String(b.desc).trim()) t.desc = String(b.desc).trim();
  if (b.date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) t.date = b.date;
  store.scheduleSave();
  res.json(t);
});

router.delete('/transactions/:id', requireAuth, requirePos(['thu_quy']), (req, res) => {
  const db = getDb();
  const cid = classIdOf(req);
  db.transactions = (db.transactions || []).filter(x => !(x.id === Number(req.params.id) && (x.classId === undefined ? true : Number(x.classId) === cid)));
  store.scheduleSave();
  res.json({ ok: true });
});

router.get('/announcements', requireAuth, (req, res) => {
  const db = getDb();
  const cid = classIdOf(req);
  const now = Date.now();
  let list = (db.announcements || []).filter(a => a.classId === undefined ? true : Number(a.classId) === cid).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (req.query.all !== '1') list = list.filter(a => !a.expiresAt || new Date(a.expiresAt).getTime() > now);
  else db.announcements.forEach(a => {
    if (a.expiresAt && new Date(a.expiresAt).getTime() <= now && !a.expiredSeen) a.expiredSeen = true;
  });
  if (req.user.role === 'student') list = list.filter(a => a.audience !== 'teachers');
  if (req.user.role === 'teacher' || req.user.role === 'admin') list = list.filter(a => a.audience !== 'students');
  res.json(list);
});

router.post('/announcements', requireAuth, requirePos(['bi_thu', 'pho_bi_thu', 'uy_vien']), (req, res) => {
  const db = getDb();
  const cid = classIdOf(req);
  const b = req.body || {};
  if (!String(b.title || '').trim()) return res.status(400).json({ error: 'Thiếu tiêu đề' });
  const a = {
    id: store.nextId('announcements'),
    title: String(b.title).trim(),
    content: String(b.content || ''),
    audience: ['all', 'students', 'teachers'].includes(b.audience) ? b.audience : 'all',
    expiresAt: b.expiresAt ? new Date(b.expiresAt).toISOString() : null,
    createdBy: req.user.name,
    createdAt: new Date().toISOString(),
    classId: cid
  };
  db.announcements.push(a);
  store.scheduleSave();
  res.json(a);
});

router.put('/announcements/:id', requireAuth, requirePos(['bi_thu', 'pho_bi_thu', 'uy_vien']), (req, res) => {
  const db = getDb();
  const cid = classIdOf(req);
  const a = (db.announcements || []).find(x => x.id === Number(req.params.id) && (x.classId === undefined ? true : Number(x.classId) === cid));
  if (!a) return res.status(404).json({ error: 'Không tìm thấy thông báo' });
  const b = req.body || {};
  if (b.title !== undefined && String(b.title).trim()) a.title = String(b.title).trim();
  if (b.content !== undefined) a.content = String(b.content);
  if (b.audience !== undefined && ['all', 'students', 'teachers'].includes(b.audience)) a.audience = b.audience;
  if (b.expiresAt !== undefined) a.expiresAt = b.expiresAt ? new Date(b.expiresAt).toISOString() : null;
  store.scheduleSave();
  res.json(a);
});

router.delete('/announcements/:id', requireAuth, requirePos(['bi_thu', 'pho_bi_thu', 'uy_vien']), (req, res) => {
  const db = getDb();
  const cid = classIdOf(req);
  db.announcements = (db.announcements || []).filter(x => !(x.id === Number(req.params.id) && (x.classId === undefined ? true : Number(x.classId) === cid)));
  store.scheduleSave();
  res.json({ ok: true });
});

router.get('/summary', requireAuth, (req, res) => {
  const db = getDb();
  const cid = classIdOf(req);
  const cls = (db.classes || []).find(c => Number(c.id) === cid) || {};
  const baseStu = Number(cls.baseStudentWeek != null ? cls.baseStudentWeek : db.settings.baseStudentWeek) || 0;
  const baseCls = Number(cls.baseClassWeek != null ? cls.baseClassWeek : db.settings.baseClassWeek) || 0;
  if (req.user.role === 'admin') {
    return res.json({
      students: [], groups: [], classTotal: 0,
      baseStudentWeek: baseStu,
      baseClassWeek: baseCls,
      pendingCount: 0
    });
  }
  const weekQ = req.query.week || null;
  const recs = db.records.filter(r => (r.classId === undefined ? true : Number(r.classId) === cid) && r.status === 'approved' && weekInRange(r.week, weekQ));
  const studentsScope = scopeStudents(req);
  const groupsScope = req.user.role === 'student'
    ? db.groups.filter(g => g.id === (studentsScope[0] || {}).groupId)
    : db.groups.filter(g => g.classId === undefined ? true : Number(g.classId) === cid);
  let netAll = 0;
  const perStudent = studentsScope.map(st => {
    let ach = 0, vio = 0;
    recs.filter(r => r.studentId === st.id).forEach(r => {
      const t = db.types.find(x => x.id === r.typeId);
      const p = t ? t.points : 0;
      if (r.kind === 'achievement') { ach += p; netAll += p; } else { vio += p; netAll -= p; }
    });
    return { id: st.id, name: st.name, groupId: st.groupId, achievement: ach, violation: vio, total: baseStu + ach - vio };
  }).sort((a, b) => b.total - a.total);
  const perGroup = groupsScope.map(g => {
    const members = perStudent.filter(s => s.groupId === g.id);
    const avg = members.length ? members.reduce((t, s) => t + s.total, 0) / members.length : 0;
    return { id: g.id, name: g.name, total: Math.round(avg * 10) / 10, count: members.length };
  });
  res.json({
    students: perStudent,
    groups: perGroup,
    classTotal: baseCls + netAll,
    baseStudentWeek: baseStu,
    baseClassWeek: baseCls,
    pendingCount: req.user.role === 'teacher' ? db.records.filter(r => (r.classId === undefined ? true : Number(r.classId) === cid) && r.status === 'pending').length : 0
  });
});

router.post('/upload', requireAuth, async (req, res) => {
  const { dataUrl } = req.body || {};
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return res.status(400).json({ error: 'Ảnh không hợp lệ' });
  if (dataUrl.length > 3 * 1024 * 1024) return res.status(400).json({ error: 'Ảnh quá lớn (tối đa ~2MB)' });
  const m = /^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/.exec(dataUrl);
  if (!m) return res.status(400).json({ error: 'Định dạng ảnh không hỗ trợ' });
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const name = crypto.randomBytes(8).toString('hex') + '.' + ext;
  try {
    await store.putFile(name, 'image/' + m[1], Buffer.from(m[2], 'base64'));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Lỗi lưu ảnh' });
  }
  res.json({ url: '/uploads/' + name });
});

module.exports = router;
