let active = false, held = false, tasks = 0;
const state = () => ({ active, tasks });
function trackHttp(req, res, next) {
  if (req.path.startsWith('/api/backups')) return next();
  if (active) return res.status(503).json({ status: 'error', message: 'The shop is temporarily paused for backup or restore. Try again shortly.' });
  tasks++; let finished = false;
  const done = () => { if (!finished) { finished = true; tasks--; } };
  res.once('finish', done); res.once('close', done); next();
}
async function background(fn) {
  if (active) return;
  tasks++;
  try { return await fn(); } finally { tasks--; }
}
async function exclusive(fn) {
  if (active) throw Object.assign(new Error('Another backup or restore is already running.'), { status: 409 });
  active = true;
  try {
    const deadline = Date.now() + 60000;
    while (tasks) {
      if (Date.now() > deadline) throw new Error('The shop is still busy. Finish active requests and try again.');
      await new Promise(r => setTimeout(r, 50));
    }
    return await fn();
  } finally { active = held; }
}
module.exports = { hold: () => { held = true; active = true; }, state, trackHttp, background, exclusive };
