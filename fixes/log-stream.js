/**
 * fixes/log-stream.js
 * Live auto-scrolling console output for the web panel (Server-Sent Events).
 *
 * Usage (site/index.js):
 *   const { streamLogs, capture } = require('./fixes/log-stream');
 *   streamLogs(app);                       // adds GET /api/logs/stream (SSE)
 *   // replace console.log with a tee so output also goes to the panel:
 *   const origLog = console.log;
 *   console.log = (...a) => { origLog(...a); capture(a.map(String).join(' ')); };
 *
 * Panel HTML (auto-scroll output):
 *   <pre id="output" style="height:300px;overflow:auto;background:#000;color:#0f0"></pre>
 *   <script>
 *     const out = document.getElementById('output');
 *     const es = new EventSource('/api/logs/stream');
 *     es.onmessage = (e) => {
 *       out.textContent += e.data + '\n';
 *       out.scrollTop = out.scrollHeight;   // ✅ auto-scroll
 *     };
 *   </script>
 */

const clients = new Set();
const buffer = [];
const MAX_BUFFER = 500;

/** Push one line into the ring buffer + broadcast to all SSE clients */
function capture(line) {
  const s = String(line);
  buffer.push(s);
  if (buffer.length > MAX_BUFFER) buffer.shift();
  const frame = `data: ${JSON.stringify(s)}\n\n`;
  for (const res of clients) {
    try { res.write(frame); } catch { clients.delete(res); }
  }
}

/** Register the SSE endpoint on the Express app */
function streamLogs(app) {
  app.get('/api/logs/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`data: ${JSON.stringify('--- live output connected ---')}\n\n`);
    // replay recent history
    for (const line of buffer) res.write(`data: ${JSON.stringify(line)}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
  });
}

module.exports = { streamLogs, capture };
