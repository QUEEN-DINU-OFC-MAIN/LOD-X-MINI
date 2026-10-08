import pg from 'pg';

export class MetaDb {
    static async open(url, log = console) {
        if (!url) return null;
        let u;
        try {
            u = new URL(String(url).trim());
        } catch {
            log.warn?.({ err: 'Invalid URL' }, 'PostgreSQL unavailable – DATABASE_URL is malformed – settings stay in R2');
            return null;
        }
        if (!['postgres:', 'postgresql:'].includes(u.protocol) || !u.hostname) {
            log.warn?.({ err: 'Invalid URL' }, 'PostgreSQL unavailable – DATABASE_URL must be postgres://user:pass@host/db – settings stay in R2');
            return null;
        }
        u.searchParams.delete('channel_binding');
        if (['require', 'prefer', 'verify-ca'].includes(u.searchParams.get('sslmode'))) u.searchParams.set('sslmode', 'verify-full');
        const isLocal = ['localhost', '127.0.0.1', '::1'].includes(u.hostname);
        const pool = new pg.Pool({
            connectionString: u.toString(),
            max: 4,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 10_000,
            ssl: isLocal ? undefined : { rejectUnauthorized: false }
        });
        pool.on('error', (e) => log.warn?.({ err: e.message }, 'postgres pool error'));
        let lastErr = null;
        for (let i = 1; i <= 5; i++) {
            try {
                await pool.query(`create table if not exists rcd_session_meta (
                    id text primary key, data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now())`);
                log.info?.({ db: u.hostname.split('.')[0] }, 'settings: PostgreSQL');
                return new MetaDb(pool);
            } catch (e) {
                lastErr = e;
                if (i < 5) await new Promise((r) => setTimeout(r, i * 1000));
            }
        }
        log.warn?.({ err: lastErr?.message }, 'PostgreSQL unavailable – settings stay in R2');
        await pool.end().catch(() => {});
        return null;
    }
    constructor(pool) { this.pool = pool; }
    async get(id) {
        const r = await this.pool.query('select data from rcd_session_meta where id = $1', [id]);
        return r.rows[0]?.data ?? null;
    }
    async put(id, data) {
        await this.pool.query(
            `insert into rcd_session_meta (id, data) values ($1, $2::jsonb)
             on conflict (id) do update set data = excluded.data, updated_at = now()`, [id, JSON.stringify(data)]);
    }
    async del(id) { await this.pool.query('delete from rcd_session_meta where id = $1', [id]); }
    async close() { await this.pool.end().catch(() => {}); }
}
