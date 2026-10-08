const int = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
const bool = (v, d) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));

export function loadConfig(env = process.env) {
    const dynoIndex = (() => {
        const m = /\.(\d+)$/.exec(env.DYNO || '');
        return m ? Number(m[1]) - 1 : 0;
    })();
    return {
        storage: {
            driver: env.STORAGE_DRIVER || (env.R2_BUCKET ? 'r2' : 'local'),
            localDir: env.LOCAL_STORAGE_DIR || './.local-r2',
            endpoint: env.R2_ENDPOINT || (env.R2_ACCOUNT_ID ? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : ''),
            bucket: env.R2_BUCKET || '',
            accessKeyId: env.R2_ACCESS_KEY_ID || '',
            secretAccessKey: env.R2_SECRET_ACCESS_KEY || '',
            forcePathStyle: bool(env.R2_FORCE_PATH_STYLE, false)
        },
        encKey: env.SESSION_ENC_KEY || '',
        databaseUrl: env.DATABASE_URL || '',
        requireEnc: bool(env.REQUIRE_ENCRYPTION, env.NODE_ENV === 'production'),
        dataDir: env.DATA_DIR || '/tmp/wa-data',

        site: {
            port: int(env.PORT, 3000),
            maxPairings: int(env.MAX_CONCURRENT_PAIRINGS, 15),
            pairingTtlMs: int(env.PAIRING_TTL_SEC, 180) * 1000,
            linksPerIpPer10Min: int(env.LINKS_PER_IP, 6),
            settleMs: int(env.PAIR_SETTLE_MS, 5000),
            brand: env.BRAND_NAME || 'Mini Bot',
            prefix: env.DEFAULT_PREFIX || '.'
        },

        worker: {
            shardCount: int(env.SHARD_COUNT, 1),
            shardIndex: int(env.SHARD_INDEX, dynoIndex),
            maxSessions: int(env.MAX_SESSIONS, 120),
            memLimitMb: int(env.MEM_LIMIT_MB, 450),
            startDelayMs: int(env.START_DELAY_MS, 1500),
            startConcurrency: int(env.START_CONCURRENCY, 1),
            pollMs: int(env.QUEUE_POLL_SEC, 15) * 1000,
            reconcileMs: int(env.RECONCILE_SEC, 600) * 1000,
            keysSyncMinMs: int(env.KEYS_SYNC_MIN_SEC, 120) * 1000,
            credsDebounceMs: int(env.CREDS_DEBOUNCE_MS, 1500),
            cmdConcurrency: int(env.CMD_CONCURRENCY, 8),
            maxPairings: int(env.WORKER_MAX_PAIRINGS, 3),
            downloadSlots: int(env.DOWNLOAD_SLOTS, 5),
            staleMsgSec: int(env.STALE_MSG_SEC, 60),
            cooldownMs: int(env.CMD_COOLDOWN_MS, 1500),
            statsMs: int(env.STATS_SEC, 60) * 1000,
            shutdownBudgetMs: int(env.SHUTDOWN_BUDGET_SEC, 22) * 1000,
            prefix: env.DEFAULT_PREFIX || '.',
            brand: env.BRAND_NAME || 'Mini Bot',
            logLevel: env.LOG_LEVEL || 'info'
        }
    };
}
