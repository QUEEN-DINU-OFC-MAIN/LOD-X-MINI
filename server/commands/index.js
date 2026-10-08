import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export async function loadCommands() {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const map = new Map();
    for (const f of readdirSync(dir)) {
        if (f === 'index.js' || !f.endsWith('.js')) continue;
        const { default: mod } = await import(`./${f}`);
        for (const cmd of [].concat(mod)) {
            for (const n of [cmd.name, ...(cmd.aliases || [])]) {
                if (map.has(n)) throw new Error(`duplicate command/alias "${n}" in ${f} (already used by "${map.get(n).name}")`);
                map.set(n, cmd);
            }
        }
    }
    map.unique = () => new Set(map.values());
    return map;
}
