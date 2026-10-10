import { writeFileSync } from 'node:fs';
import { isLocked } from '../shared/cmd-access.js';
import { loadCommands } from '../server/commands/index.js';
const list = [...(await loadCommands()).unique()].filter((c) => !c.hidden)
    .map((c) => ({ name: c.name, cat: c.cat, desc: c.desc, aliases: c.aliases || [], ownerOnly: !!c.ownerOnly, groupOnly: !!c.groupOnly, devOnly: !!c.devOnly, locked: isLocked(c) }))
    .sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(new URL('../web/lib/commands.json', import.meta.url), JSON.stringify(list, null, 1));
console.log(list.length, 'commands written');
