import { B, waLogger } from '../shared/wa.js';
import { BoundedCache } from '../shared/cache.js';
const N = Number(process.argv[2] || 20);
const mb = () => { global.gc?.(); return +(process.memoryUsage().rss / 1048576).toFixed(1); };
const shared = new BoundedCache({ shared: true, max: 5000 });
const socks = [];
const base = mb();
for (let i = 0; i < N; i++) {
    const creds = B.initAuthCreds(); const store = new Map();
    const keys = { get: async (t, ids) => Object.fromEntries(ids.map((id) => [id, store.get(`${t}${id}`)])), set: async (d) => { for (const t in d) for (const id in d[t]) store.set(`${t}${id}`, d[t][id]); } };
    const sock = B.makeWASocket({ version: B.DEFAULT_CONNECTION_CONFIG.version, auth: { creds, keys: B.makeCacheableSignalKeyStore(keys, waLogger, new BoundedCache({ max: 400 })) }, logger: waLogger, printQRInTerminal: false, markOnlineOnConnect: false, syncFullHistory: false, userDevicesCache: shared, getMessage: async () => undefined });
    socks.push(sock);
    await new Promise((r) => setTimeout(r, 250));
}
await new Promise((r) => setTimeout(r, 8000));
const after = mb();
console.log(JSON.stringify({ sockets: N, baselineMb: base, afterMb: after, perSocketMb: +((after - base) / N).toFixed(2), heapUsedMb: +(process.memoryUsage().heapUsed / 1048576).toFixed(1) }));
socks.forEach((s) => { try { s.end(undefined); } catch {} });
process.exit(0);
