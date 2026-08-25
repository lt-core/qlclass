import { api } from './http.js';

export const POS_LABEL = {
  thanh_vien: 'Thành viên', lop_truong: 'Lớp trưởng', pho_hoc_tap: 'Lớp phó HT',
  pho_lao_dong: 'Lớp phó LD', pho_van_the: 'Lớp phó VT', thu_quy: 'Thủ quỹ',
  to_truong: 'Tổ trưởng', bi_thu: 'Bí thư', pho_bi_thu: 'Phó bí thư', uy_vien: 'Ủy viên'
};

export const S = {
  me: null, student: null, settings: null, groups: [], types: [], perms: {},
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
  S.week = b.currentWeek;
  const saved = Number(localStorage.getItem('qlc_week'));
  if (Number.isInteger(saved) && saved >= 1 && saved <= (b.settings.weeks || 35)) {
    S.week = saved;
  }
  return b;
}
