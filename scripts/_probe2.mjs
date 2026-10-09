import express from 'express';

const app = express();
const s = app.listen(3000, () => {
  console.log('CB: listening =', s.listening, 'addr =', JSON.stringify(s.address()));
});
s.on('close', () => console.log('SERVER CLOSE event'));
process.on('exit', (code) => console.log('PROCESS EXIT', code));
