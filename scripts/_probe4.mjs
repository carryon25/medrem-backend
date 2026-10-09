import express from 'express';

const app = express();
const s = app.listen(3000, () => console.log('CB: listening =', s.listening));
s.on('error', (e) => console.log('ERROR EVENT:', e.code));
process.on('exit', (code) => console.log('PROCESS EXIT', code));
