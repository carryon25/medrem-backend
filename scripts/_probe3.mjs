import http from 'node:http';

const s = http.createServer((q, r) => r.end('ok'));
s.on('error', (e) => console.log('ERROR EVENT:', e.code));
s.listen(3000, () => console.log('CB: listening =', s.listening, 'addr =', JSON.stringify(s.address())));
setTimeout(() => {
  console.log('after 2s: listening =', s.listening, 'handles =', process._getActiveHandles().map((h) => h.constructor.name).join(','));
  process.exit(9);
}, 2000);
