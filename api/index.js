const app = require('../server/app');
const dbu = require('../server/db');
const store = require('../server/store');

module.exports = async (req, res) => {
  try {
    await dbu.init();
    await new Promise(resolve => {
      res.on('finish', resolve);
      res.on('close', resolve);
      app(req, res);
    });
    await store.persistNow();
  } catch (e) {
    console.error('[serverless]', e);
    if (!res.headersSent) res.status(500).json({ error: 'Lỗi máy chủ' });
  }
};
