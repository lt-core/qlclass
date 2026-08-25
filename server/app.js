const express = require('express');
const path = require('path');
const store = require('./store');
const api = require('./api');

const app = express();
app.use(express.json({ limit: '4mb' }));

app.use((req, res, next) => {
  res.on('finish', () => {
    store.persistIfDirty().catch(e => console.error('[store] Loi luu du lieu:', e));
  });
  next();
});

app.get('/uploads/:name', async (req, res) => {
  try {
    const f = await store.getFile(req.params.name);
    if (!f) return res.status(404).json({ error: 'Khong tim thay anh' });
    res.setHeader('Content-Type', f.mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(f.buf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Loi doc anh' });
  }
});

if (!process.env.VERCEL) {
  app.use(express.static(path.join(__dirname, '..', 'public'), {
    setHeaders: res => res.setHeader('Cache-Control', 'no-cache')
  }));
}

app.use('/api', api);

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Lỗi máy chủ' });
});

module.exports = app;
