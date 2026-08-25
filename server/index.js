const express = require('express');
const path = require('path');
const dbu = require('./db');
const store = require('./store');
const api = require('./api');

dbu.init();

const app = express();
app.use(express.json({ limit: '6mb' }));
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: res => res.setHeader('Cache-Control', 'no-cache')
}));
app.use('/api', api);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Lỗi máy chủ' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`QLClass đang chạy tại http://localhost:${PORT}`);
});
