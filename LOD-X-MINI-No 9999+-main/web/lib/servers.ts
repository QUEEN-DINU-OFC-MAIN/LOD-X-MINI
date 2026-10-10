import { SERVERS as CONFIG_SERVERS } from '../server.js';

export interface ServerNode {
  id: string;
  name: string;
  url: string;
  region?: string;
  enabled: boolean;
}

export function getActiveServers(): ServerNode[] {
  const list: ServerNode[] = [];
  const seenUrls = new Set<string>();

  const add = (node: ServerNode) => {
    const cleanUrl = String(node.url || '').trim().replace(/\/+$/, '');
    if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) return;
    if (node.enabled === false) return;
    if (seenUrls.has(cleanUrl)) return;
    seenUrls.add(cleanUrl);
    list.push({
      id: node.id || `server-${list.length + 1}`,
      name: node.name || `Server ${String(list.length + 1).padStart(2, '0')}`,
      url: cleanUrl,
      region: node.region || 'Cluster Node',
      enabled: true
    });
  };

  if (Array.isArray(CONFIG_SERVERS)) {
    for (const s of CONFIG_SERVERS) {
      if (s && typeof s === 'object') {
        add(s as ServerNode);
      }
    }
  }

  const envUrls = (process.env.BACKEND_URLS || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
  envUrls.forEach((url, idx) => {
    add({
      id: `env-server-${idx + 1}`,
      name: `Server ${String(list.length + 1).padStart(2, '0')}`,
      url,
      region: 'Cloud Cluster',
      enabled: true
    });
  });

  if (list.length === 0) {
    add({
      id: 'server-1',
      name: 'Server 01 · Primary',
      url: (process.env.BACKEND_URL || 'http://127.0.0.1:3000').replace(/\/+$/, ''),
      region: 'Primary Cluster',
      enabled: true
    });
  }

  return list;
}
