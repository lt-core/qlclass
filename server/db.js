const crypto = require('crypto');
const store = require('./store');

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const h = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash));
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

function slugName(name) {
  return String(name)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

function defaults() {
  const mk = (password) => {
    const { salt, hash } = hashPassword(password);
    return { salt, passHash: hash };
  };
  const admin = mk('admin');
  const teacher = mk('teacher123');
  const now = new Date().toISOString();

  // [ten, gioiTinh, hang(0-based), cot(0-based), chucVu]
  const T1 = [
    ['Nguyễn Văn Đạt', 'Nam', 0, 0, 'thanh_vien'],
    ['Võ Hoàng Anh', 'Nam', 1, 0, 'thanh_vien'],
    ["Kpă Kha", 'Nam', 1, 1, 'thanh_vien'],
    ['Nông Việt Vương', 'Nam', 2, 0, 'thanh_vien'],
    ['Lê Khắc Tín', 'Nam', 2, 1, 'lop_truong'],
    ['Nguyễn Tiến Thường', 'Nam', 3, 0, 'thanh_vien'],
    ['Đặng Tường Vy', 'Nữ', 3, 1, 'to_truong'],
    ["Ksor H' Linh", 'Nữ', 4, 0, 'thanh_vien'],
    ["Hiao H' Ryiong", 'Nữ', 4, 1, 'thanh_vien'],
    ['Tạ Văn Phát', 'Nam', 5, 0, 'thanh_vien']
  ];
  const T2 = [
    ['Đinh Đang', 'Nam', 0, 0, 'thanh_vien'],
    ["Ksor H' Lan", 'Nữ', 0, 1, 'thanh_vien'],
    ['Trần Văn Hiệp', 'Nam', 1, 0, 'thanh_vien'],
    ['Hà Thị Khánh Quyên', 'Nữ', 1, 1, 'thu_quy'],
    ['Dương Thị Ngọc Hằng', 'Nữ', 2, 0, 'thanh_vien'],
    ['Cù Thị Anh Thư', 'Nữ', 2, 1, 'to_truong'],
    ['Đặng Trịnh Hồng Duyên', 'Nữ', 3, 0, 'pho_van_the'],
    ['Trịnh Phạm Bảo Vy', 'Nữ', 3, 1, 'pho_bi_thu'],
    ['Ngô Phan Lưu', 'Nam', 4, 0, 'thanh_vien'],
    ['Tạ Lê Tiến Thành', 'Nam', 4, 1, 'thanh_vien'],
    ['Hà Tiến Đạt', 'Nam', 5, 1, 'thanh_vien']
  ];
  const T3 = [
    ["Nay H' Sinh", 'Nữ', 0, 0, 'thanh_vien'],
    ["Nay H' Lyna", 'Nữ', 0, 1, 'thanh_vien'],
    ['Lương Thế Duy', 'Nam', 1, 0, 'thanh_vien'],
    ['Trần Thị Ngọc', 'Nữ', 1, 1, 'thanh_vien'],
    ['Lê Minh Tuân', 'Nam', 2, 0, 'thanh_vien'],
    ['Hoàng Thị Khánh Linh', 'Nữ', 2, 1, 'to_truong'],
    ['Nông Thị Hoài Thương', 'Nữ', 3, 0, 'thanh_vien'],
    ['Nông Thị Linh Nhâm', 'Nữ', 3, 1, 'uy_vien'],
    ['Lê Thị Nguyên', 'Nữ', 4, 0, 'thanh_vien'],
    ['Nguyễn Thị Hân', 'Nữ', 4, 1, 'thanh_vien']
  ];
  const T4 = [
    ['Ralan Trung', 'Nam', 0, 0, 'thanh_vien'],
    ['Bùi Thị Thuỳ Trang', 'Nữ', 1, 0, 'bi_thu'],
    ['Đỗ Ngọc Tuấn Anh', 'Nam', 1, 1, 'pho_hoc_tap'],
    ['Nguyễn Thị Kim Phụng', 'Nữ', 2, 0, 'thanh_vien'],
    ['Hoàng Thị Diễm Quỳnh', 'Nữ', 2, 1, 'thanh_vien'],
    ['Trần Đông Anh', 'Nam', 3, 0, 'pho_lao_dong'],
    ['Nguyễn Lê Trà My', 'Nữ', 3, 1, 'thanh_vien'],
    ['Nguyễn Đăng Trung Tài', 'Nam', 4, 0, 'thanh_vien']
  ];

  const groups = [
    { id: 1, name: 'Tổ 1', rows: 6, cols: 2 },
    { id: 2, name: 'Tổ 2', rows: 6, cols: 2 },
    { id: 3, name: 'Tổ 3', rows: 6, cols: 2 },
    { id: 4, name: 'Tổ 4', rows: 5, cols: 2 }
  ];
  const roster = { 1: T1, 2: T2, 3: T3, 4: T4 };

  const students = [];
  let sid = 0;
  for (const g of groups) {
    for (const [name, gender, row, col, position] of roster[g.id]) {
      sid++;
      students.push({
        id: sid,
        name,
        dob: '',
        gender,
        address: '',
        photo: '',
        groupId: g.id,
        row,
        col,
        position
      });
    }
  }

  const users = [
    { id: 1, username: 'admin', role: 'admin', name: 'Quản trị viên', studentId: null, salt: admin.salt, passHash: admin.passHash, createdAt: now },
    { id: 2, username: 'giaovien', role: 'teacher', name: 'Cô chủ nhiệm', studentId: null, salt: teacher.salt, passHash: teacher.passHash, createdAt: now }
  ];

  // Tai khoan tung hoc sinh: ten khong dau, mat khau chung hocsinh123
  const used = new Set(users.map(u => u.username));
  let uid = users.length;
  for (const s of students) {
    let u = slugName(s.name);
    if (!u) u = 'hs' + s.id;
    let base = u, n = 2;
    while (used.has(u)) u = base + n++;
    used.add(u);
    const { salt, hash } = hashPassword('hocsinh123');
    users.push({ id: ++uid, username: u, role: 'student', name: s.name, studentId: s.id, salt, passHash: hash, createdAt: now });
  }

  // Tai khoan ngan gon theo chuc vu (tien loi cho lop su dung)
  const shortAccounts = [
    ['loptruong', 'Lê Khắc Tín'],
    ['totruong1', 'Đặng Tường Vy'],
    ['totruong2', 'Cù Thị Anh Thư'],
    ['totruong3', 'Hoàng Thị Khánh Linh'],
    ['thuquy', 'Hà Thị Khánh Quyên'],
    ['bithu', 'Bùi Thị Thuỳ Trang'],
    ['phobithu', 'Trịnh Phạm Bảo Vy'],
    ['phovanthe', 'Đặng Trịnh Hồng Duyên'],
    ['phohoctap', 'Đỗ Ngọc Tuấn Anh'],
    ['pholaodong', 'Trần Đông Anh'],
    ['uyvien', 'Nông Thị Linh Nhâm']
  ];
  for (const [username, stuName] of shortAccounts) {
    const s = students.find(x => x.name === stuName);
    if (!s || used.has(username)) continue;
    used.add(username);
    const { salt, hash } = hashPassword('hocsinh123');
    users.push({ id: ++uid, username, role: 'student', name: s.name, studentId: s.id, salt, passHash: hash, createdAt: now });
  }

  return {
    settings: {
      schoolYear: '2025-2026',
      className: '12A1',
      grade: 12,
      weeks: 35,
      startDate: '2025-09-08',
      baseStudentWeek: 100,
      baseClassWeek: 400
    },
    users,
    tokens: {},
    types: [
      { id: 1, kind: 'achievement', name: 'Giỏi thi đấu văn nghệ', points: 5 },
      { id: 2, kind: 'achievement', name: 'Trực tuần tốt', points: 2 },
      { id: 3, kind: 'achievement', name: 'Đóng góp sách vở', points: 1 },
      { id: 4, kind: 'violation', name: 'Đi muộn', points: 2 },
      { id: 5, kind: 'violation', name: 'Không làm bài tập', points: 3 },
      { id: 6, kind: 'violation', name: 'Nói chuyện trong giờ', points: 1 }
    ],
    groups,
    students,
    reviews: [],
    labor: [],
    culture: [],
    transactions: [],
    records: [],
    announcements: []
  };
}

function init() {
  return store.ensureReady(defaults);
}

module.exports = { init, hashPassword, verifyPassword, newToken };
