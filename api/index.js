const app = require('../server/app');
const dbu = require('../server/db');
const store = require('../server/store');

module.exports = async (req, res) => {
  try {
    await dbu.init();
    if (!global.__initLogged) {
      global.__initLogged = true;
      console.log('[serverless] init — USE_DB:', store.useDb, 'VERCEL:', !!process.env.VERCEL, 'method:', req.method, req.url);
    }
    await new Promise(resolve => {
      res.on('finish', resolve);
      res.on('close', resolve);
      app(req, res);
    });
  } catch (e) {
    console.error('[serverless]', e);
    if (!res.headersSent) res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};
