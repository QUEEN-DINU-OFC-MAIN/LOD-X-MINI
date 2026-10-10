import { promises as fs } from 'node:fs';
import path from 'node:path';

export const SAFE_KEY_NAME = /^[A-Za-z0-9_.@-]+\.json$/;

export async function collectKeyFiles(dir, { skip = 'creds.json', log } = {}) {
    const names = (await fs.readdir(dir)).filter((n) => SAFE_KEY_NAME.test(n) && n !== skip);
    const files = {};
    const gone = [];
    for (const n of names) {
        const file = path.join(dir, n);
        let body;
        try {
            body = await fs.readFile(file, 'utf8');
        } catch (e) {
            if (e.code !== 'ENOENT') {
                try { body = await fs.readFile(file, 'utf8'); } catch (e2) {
                    log?.error?.({ file: n, err: e2.message }, 'key file unreadable – bundle upload aborted so the key is not lost');
                    throw e2;
                }
            }
        }
        if (body === undefined) { gone.push(n); continue; }
        files[n] = body;
    }
    if (gone.length) log?.debug?.({ gone: gone.length, kept: Object.keys(files).length }, 'key files removed during read');
    return { files, gone };
}
