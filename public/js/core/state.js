import { api } from './http.js';

export const POS_LABEL = {
  thanh_vien: 'Thành viên', lop_truong: 'Lớp trưởng', pho_hoc_tap: 'Lớp phó HT',
  pho_lao_dong: 'Lớp phó LD', pho_van_the: 'Lớp phó VT', thu_quy: 'Thủ quỹ',
  to_truong: 'Tổ trưởng', bi_thu: 'Bí thư', pho_bi_thu: 'Phó bí thư', uy_vien: 'Ủy viên'
};

export const WEEK_LABEL = { s1mid: 'Giữa HK I', s1end: 'Cuối HK I', s2mid: 'Giữa HK II', s2end: 'Cuối HK II', year: 'Cả năm' };
export const SUMMARY_KEYS = Object.keys(WEEK_LABEL);

export function weekDisplay(w) {
  if (typeof w === 'string' && WEEK_LABEL[w]) return WEEK_LABEL[w];
  return 'Tuần ' + w;
}

function applyClassToSettings(c) {
  S.settings = { ...(S.settings || {}), ...{
    className: c.name, schoolYear: c.schoolYear, grade: c.grade,
    weeks: c.weeks, startDate: c.startDate,
    baseStudentWeek: c.baseStudentWeek, baseClassWeek: c.baseClassWeek
  } };
  S.currentClassId = Number(c.id);
}

export function findClass(id) {
  return (S.classes || []).find(c => Number(c.id) === Number(id));
}

export function applyClassSettingsById(id) {
  const c = findClass(id);
  if (c) { applyClassToSettings(c); return true; }
  return false;
}

export function persistTeacherClass(id) {
  if (S.me && S.me.role === 'teacher') {
    localStorage.setItem('qlc_teacher_class_' + S.me.id, String(id));
  }
}

export function teacherSavedClassId() {
  if (!S.me || S.me.role !== 'teacher') return null;
  const v = localStorage.getItem('qlc_teacher_class_' + S.me.id);
  return v == null ? null : Number(v);
}

export const S = {
  me: null, student: null, settings: null, groups: [], types: [], perms: {},
  classes: [], currentClassId: null, managedClassIds: null,
  week: 1, selSid: null, lifeTab: 'labor', counts: {}
};

export async function loadBootstrap() {
  const b = await api('/bootstrap');
  S.me = b.me;
  S.student = b.student;
  S.settings = b.settings;
  S.groups = b.groups;
  S.types = b.types;
  S.perms = b.permissions;
  S.counts = b.counts || {};
  S.classes = b.classes || [];
  S.currentClassId = b.currentClassId;
  S.managedClassIds = b.managedClassIds ?? null;
  S.week = b.currentWeek;
  const saved = localStorage.getItem('qlc_week');
  if (saved !== null) {
    const num = Number(saved);
    if (Number.isInteger(num) && num >= 0 && num <= (b.settings.weeks || 36)) {
      S.week = num;
    } else if (SUMMARY_KEYS.includes(saved)) {
      S.week = saved;
    }
  }
  return b;
}
