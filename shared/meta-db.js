import pg from 'pg';

export class MetaDb {
    static async open(url, log = console) {
        if (!url) return null;
        const u = new URL(url);
        u.searchParams.delete('channel_binding');
        if (['require', 'prefer', 'verify-ca'].includes(u.searchParams.get('sslmode'))) u.searchParams.set('sslmode', 'verify-full');
        const pool = new pg.Pool({ connectionString: u.toString(), max: 4, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
        pool.on('error', (e) => log.warn?.({ err: e.message }, 'postgres pool error'));
        await pool.query(`create table if not exists rcd_session_meta (
            id text primary key, data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now())`);
        log.info?.({ db: u.hostname.split('.')[0] }, 'settings: PostgreSQL');
        return new MetaDb(pool);
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
