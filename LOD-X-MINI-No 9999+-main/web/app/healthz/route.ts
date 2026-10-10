import { NextResponse } from 'next/server';
import { getActiveServers } from '../../lib/servers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const servers = getActiveServers();
  const checks = await Promise.allSettled(
    servers.map(async (srv) => {
      const res = await fetch(`${srv.url}/healthz`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(4000)
      });
      const data = await res.json().catch(() => ({}));
      return { id: srv.id, name: srv.name, ok: res.ok && Boolean(data?.ok), activePairings: Number(data?.activePairings) || 0 };
    })
  );

  let online = 0;
  let activePairings = 0;
  for (const c of checks) {
    if (c.status === 'fulfilled' && c.value.ok) {
      online += 1;
      activePairings += c.value.activePairings;
    }
  }

  return NextResponse.json({
    ok: online > 0,
    serversOnline: online,
    totalServers: servers.length,
    activePairings
  });
}
