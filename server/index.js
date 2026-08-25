const dbu = require('./db');
const app = require('./app');

(async () => {
  await dbu.init();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`QLClass đang chạy tại http://localhost:${PORT}`);
  });
})().catch(e => {
  console.error('Khoi dong that bai:', e);
  process.exit(1);
});
