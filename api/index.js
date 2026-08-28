const app = require('../server/app');
const dbu = require('../server/db');
const store = require('../server/store');

let curRes = null;

if (!global.__rejHandler) {
  global.__rejHandler = true;
  process.on('unhandledRejection', (err) => {
    console.error('[serverless] unhandledRejection:', err);
    if (curRes && !curRes.headersSent) {
      try { curRes.status(500).json({ error: 'Lỗi máy chủ: ' + ((err && err.message) || '') }); } catch (_) {}
    }
    curRes = null;
  });
}

module.exports = async (req, res) => {
  try {
    await dbu.init();
    if (!global.__initLogged) {
      global.__initLogged = true;
      console.log('[serverless] init — USE_DB:', store.useDb, 'VERCEL:', !!process.env.VERCEL, 'method:', req.method, req.url);
    }
    curRes = res;
    await new Promise(resolve => {
      res.on('finish', resolve);
      res.on('close', resolve);
      app(req, res);
    });
    if (curRes === res) curRes = null;
  } catch (e) {
    console.error('[serverless]', e);
    if (!res.headersSent) res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};