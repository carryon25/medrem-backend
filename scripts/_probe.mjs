import express from 'express';

const app = express();
const s = app.listen(3000, () => {
  console.log('CB: listening =', s.listening, 'addr =', JSON.stringify(s.address()));
});
s.on('error', (e) => console.log('SERVER ERROR:', e.code, e.message));
s.on('close', () => console.log('SERVER CLOSE event'));

let n = 0;
const t = setInterval(() => {
  n++;
  console.log(`tick ${n}: listening=${s.listening} handles=${process._getActiveHandles().map((h) => h.constructor.name).join(',')}`);
  if (n >= 5) {
    clearInterval(t);
    s.close();
    console.log('done');
  }
}, 1000);

process.on('exit', (code) => console.log('PROCESS EXIT', code));
