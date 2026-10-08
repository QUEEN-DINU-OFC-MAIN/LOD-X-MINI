import { NextRequest, NextResponse } from 'next/server';
import { getActiveServers, ServerNode } from '../../../lib/servers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function fetchJsonWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 6000) {
  const started = Date.now();
  const res = await fetch(url, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs)
  });
  const latencyMs = Date.now() - started;
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data, latencyMs };
}

async function handleStats() {
  const servers = getActiveServers();
  const results = await Promise.allSettled(
    servers.map(async (srv) => {
      const r = await fetchJsonWithTimeout(`${srv.url}/api/stats`, {}, 5000);
      return { srv, ...r };
    })
  );

  let connected = 0;
  let reconnecting = 0;
  let totalSessions = 0;
  let workersOnline = 0;
  let capacity = 0;
  let rssMb = 0;
  let brand = 'RCD X MINI';
  let onlineServers = 0;

  const serverStatuses = servers.map((srv, idx) => {
    const res = results[idx];
    if (res.status === 'fulfilled' && res.value.ok && res.value.data) {
      const d = res.value.data;
      const srvConnected = Number(d.connected) || 0;
      const srvReconnecting = Number(d.reconnecting) || 0;
      const srvTotal = Number(d.totalSessions) || srvConnected;
      const srvWorkers = Number(d.workersOnline) || (srvConnected > 0 ? 1 : 0);
      const srvCap = Number(d.capacity) || 0;

      connected += srvConnected;
      reconnecting += srvReconnecting;
      totalSessions += srvTotal;
      workersOnline += srvWorkers;
      capacity += srvCap;
      rssMb += Number(d.rssMb) || 0;
      if (d.brand) brand = d.brand;
      onlineServers += 1;

      return {
        id: srv.id,
        name: srv.name,
        region: srv.region || 'Cluster Node',
        online: true,
        latencyMs: res.value.latencyMs,
        connected: srvConnected,
        reconnecting: srvReconnecting,
        totalSessions: srvTotal,
        workersOnline: srvWorkers,
        capacity: srvCap
      };
    }
    return {
      id: srv.id,
      name: srv.name,
      region: srv.region || 'Cluster Node',
      online: false,
      latencyMs: null,
      connected: 0,
      reconnecting: 0,
      totalSessions: 0,
      workersOnline: 0,
      capacity: 0
    };
  });

  return NextResponse.json(
    {
      brand,
      totalSessions: Math.max(totalSessions, connected),
      workersOnline: Math.max(workersOnline, onlineServers),
      connected,
      reconnecting,
      capacity,
      rssMb,
      serversOnline: onlineServers,
      totalServers: servers.length,
      servers: serverStatuses,
      at: Date.now()
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

async function handleStatsHistory() {
  const servers = getActiveServers();
  const results = await Promise.allSettled(
    servers.map((srv) => fetchJsonWithTimeout(`${srv.url}/api/stats/history`, {}, 5000))
  );

  const buckets = new Map<number, { t: number; on: number; re: number; tot: number }>();
  let everySec = 60;
  let maxSec = 259200;

  for (const res of results) {
    if (res.status === 'fulfilled' && res.value.ok && res.value.data) {
      const d = res.value.data;
      if (d.everySec) everySec = d.everySec;
      if (d.maxSec) maxSec = d.maxSec;
      const pts = Array.isArray(d.points) ? d.points : [];
      for (const p of pts) {
        if (!p || typeof p.t !== 'number') continue;
        const key = Math.round(p.t / 60000) * 60000;
        const cur = buckets.get(key) || { t: key, on: 0, re: 0, tot: 0 };
        cur.on += Number(p.on) || 0;
        cur.re += Number(p.re) || 0;
        cur.tot += Number(p.tot) || 0;
        buckets.set(key, cur);
      }
    }
  }

  const points = Array.from(buckets.values()).sort((a, b) => a.t - b.t);
  return NextResponse.json(
    { everySec, maxSec, points },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

async function handleLinkStart(req: NextRequest) {
  const servers = getActiveServers();
  const bodyText = await req.text();
  let parsed: any = {};
  try {
    parsed = bodyText ? JSON.parse(bodyText) : {};
  } catch {}

  let ordered: ServerNode[] = [...servers];
  if (parsed?.serverId) {
    const chosen = servers.find((s) => s.id === parsed.serverId);
    if (chosen) {
      ordered = [chosen, ...servers.filter((s) => s.id !== chosen.id)];
    }
  } else if (servers.length > 1) {
    const statsChecks = await Promise.allSettled(
      servers.map(async (srv) => {
        const r = await fetchJsonWithTimeout(`${srv.url}/api/stats`, {}, 3000);
        return { srv, ok: r.ok, connected: Number(r.data?.connected) || 0 };
      })
    );
    const online = statsChecks
      .filter((r): r is PromiseFulfilledResult<{ srv: ServerNode; ok: boolean; connected: number }> => r.status === 'fulfilled' && r.value.ok)
      .sort((a, b) => a.value.connected - b.value.connected)
      .map((r) => r.value.srv);
    if (online.length > 0) {
      ordered = [...online, ...servers.filter((s) => !online.includes(s))];
    }
  }

  let lastErr = { status: 502, data: { error: 'All bot servers are currently unreachable.' } };
  for (const srv of ordered) {
    try {
      const r = await fetchJsonWithTimeout(
        `${srv.url}/api/link`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyText
        },
        10000
      );
      if (r.ok && r.data?.token) {
        return NextResponse.json({
          ...r.data,
          serverId: srv.id,
          serverName: srv.name
        });
      }
      lastErr = { status: r.status, data: r.data || { error: 'Pairing failed' } };
      if (r.status === 400) break;
    } catch (e: any) {
      lastErr = { status: 502, data: { error: e?.message || 'Server connection error' } };
    }
  }
  return NextResponse.json(lastErr.data, { status: lastErr.status });
}

async function handleFulldpUpload(req: NextRequest) {
  const primary = getActiveServers()[0];
  if (!primary) return NextResponse.json({ error: 'No backend available.' }, { status: 502 });
  const bodyText = await req.text();
  try {
    const r = await fetchJsonWithTimeout(
      `${primary.url}/api/fulldp/upload`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: bodyText },
      35000
    );
    return NextResponse.json(r.data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Upload failed' }, { status: 502 });
  }
}

async function handleLinkToken(req: NextRequest, token: string) {
  const servers = getActiveServers();
  const method = req.method;

  const results = await Promise.allSettled(
    servers.map(async (srv) => {
      const r = await fetchJsonWithTimeout(
        `${srv.url}/api/link/${encodeURIComponent(token)}`,
        { method },
        6000
      );
      return { srv, ...r };
    })
  );

  for (const res of results) {
    if (res.status === 'fulfilled' && res.value.ok) {
      return NextResponse.json({
        ...res.value.data,
        serverId: res.value.srv.id,
        serverName: res.value.srv.name
      });
    }
  }

  return NextResponse.json({ error: 'unknown' }, { status: 404 });
}

async function handlePanelLogin(req: NextRequest) {
  const servers = getActiveServers();
  const bodyText = await req.text();

  const results = await Promise.allSettled(
    servers.map(async (srv) => {
      const r = await fetchJsonWithTimeout(
        `${srv.url}/api/panel/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyText
        },
        7000
      );
      return { srv, ...r };
    })
  );

  const succeeded = results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value.ok && r.value.data?.token)
    .map((r) => r.value);

  if (succeeded.length === 1) {
    const win = succeeded[0];
    return NextResponse.json({
      ...win.data,
      serverId: win.srv.id,
      serverName: win.srv.name
    });
  }

  if (succeeded.length > 1) {
    const meChecks = await Promise.allSettled(
      succeeded.map(async (cand) => {
        const me = await fetchJsonWithTimeout(
          `${cand.srv.url}/api/panel/me`,
          {
            headers: { Authorization: `Bearer ${cand.data.number}.${cand.data.token}` }
          },
          4000
        );
        return { cand, state: me.data?.state || 'offline' };
      })
    );
    const active = meChecks.find(
      (m): m is PromiseFulfilledResult<any> => m.status === 'fulfilled' && m.value.state === 'open'
    );
    const win = active ? active.value.cand : succeeded[0];
    return NextResponse.json({
      ...win.data,
      serverId: win.srv.id,
      serverName: win.srv.name
    });
  }

  for (const res of results) {
    if (res.status === 'fulfilled' && res.value.data?.error) {
      return NextResponse.json(res.value.data, { status: res.value.status || 401 });
    }
  }
  return NextResponse.json({ error: 'Wrong number or password.' }, { status: 401 });
}

async function handlePanelProxy(req: NextRequest, subPath: string) {
  const servers = getActiveServers();
  const authHeader = req.headers.get('authorization') || '';
  const contentType = req.headers.get('content-type') || '';
  const preferredServerId = req.headers.get('x-server-id') || '';
  const search = req.nextUrl.search || '';
  const method = req.method;

  const rawBody = method !== 'GET' && method !== 'HEAD' ? await req.arrayBuffer() : undefined;

  const headers: Record<string, string> = {};
  if (authHeader) headers['authorization'] = authHeader;
  if (contentType) headers['content-type'] = contentType;

  const ordered = preferredServerId
    ? [
        ...servers.filter((s) => s.id === preferredServerId),
        ...servers.filter((s) => s.id !== preferredServerId)
      ]
    : servers;

  const results = await Promise.allSettled(
    ordered.map(async (srv) => {
      const r = await fetchJsonWithTimeout(
        `${srv.url}/api/panel/${subPath}${search}`,
        {
          method,
          headers,
          body: rawBody ? Buffer.from(rawBody) : undefined
        },
        15000
      );
      return { srv, ...r };
    })
  );

  const succeeded = results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value.ok)
    .map((r) => r.value);

  if (succeeded.length > 0) {
    const openMatch = succeeded.find((s) => s.data?.state === 'open') || succeeded[0];
    return NextResponse.json({
      ...openMatch.data,
      serverId: openMatch.srv.id,
      serverName: openMatch.srv.name
    });
  }

  for (const res of results) {
    if (res.status === 'fulfilled' && res.value.data?.error) {
      return NextResponse.json(res.value.data, { status: res.value.status || 400 });
    }
  }
  return NextResponse.json({ error: 'Could not reach bot server.' }, { status: 502 });
}


async function handleAdminOverview(req: NextRequest) {
  const servers = getActiveServers();
  const key = req.headers.get('x-admin-key') || req.nextUrl.searchParams.get('key') || '';

  const results = await Promise.allSettled(
    servers.map(async (srv) => {
      const r = await fetchJsonWithTimeout(
        `${srv.url}/api/admin/overview`,
        { headers: key ? { 'x-admin-key': key } : {} },
        8000
      );
      return { srv, ...r };
    })
  );

  const unauthorized = results.every(
    (r) => r.status === 'fulfilled' && (r.value.status === 401 || (r.value.data as any)?.authRequired)
  );
  if (unauthorized) {
    return NextResponse.json({ ok: false, authRequired: true, error: 'Wrong admin key.' }, { status: 401 });
  }

  const online: any[] = [];
  const editOwners = new Map<string, { owner: string; count: number; limit: number }>();
  const editModels = new Map<string, number>();
  const editDays = new Map<string, number>();
  const aiDays = new Map<string, { date: string; calls: number; neurons: number }>();
  const blocked = new Map<string, { ip: string; hits: number; last: number; server: string }>();
  const rates = new Map<string, { route: string; calls: number; errors: number; msTotal: number }>();
  let editTotal = 0;
  let editTodayTotal = 0;
  let aiTodayCalls = 0;
  let aiTodayNeurons = 0;
  let rssMb = 0;
  let sessionsTotal = 0;
  let blockedTotal = 0;
  const sessionRows: any[] = [];
  const serverRows: any[] = [];

  results.forEach((res, i) => {
    const srv = servers[i];
    if (res.status === 'fulfilled' && res.value.ok && res.value.data?.ok) {
      const d = res.value.data;
      rssMb += Number(d.server?.rssMb) || 0;
      sessionsTotal += Number(d.sessions?.count) || 0;
      editTotal += Number(d.edit?.total) || 0;
      editTodayTotal += (d.edit?.today || []).reduce((n: number, x: any) => n + (Number(x.count) || 0), 0);
      aiTodayCalls += Number(d.ai?.today?.calls) || 0;
      aiTodayNeurons += Number(d.ai?.today?.neurons) || 0;
      blockedTotal += Number(d.limits?.blockedTotal) || 0;

      (d.edit?.today || []).forEach((x: any) => {
        const k = String(x.owner);
        const cur = editOwners.get(k) || { owner: k, count: 0, limit: Number(x.limit) || 0 };
        cur.count += Number(x.count) || 0;
        editOwners.set(k, cur);
      });
      (d.edit?.models || []).forEach((m: any) => editModels.set(m.model, (editModels.get(m.model) || 0) + (Number(m.count) || 0)));
      (d.edit?.days || []).forEach((x: any) => editDays.set(x.date, (editDays.get(x.date) || 0) + (Number(x.count) || 0)));
      (d.ai?.days || []).forEach((x: any) => {
        const cur = aiDays.get(x.date) || { date: x.date, calls: 0, neurons: 0 };
        cur.calls += Number(x.calls) || 0;
        cur.neurons += Number(x.neurons) || 0;
        aiDays.set(x.date, cur);
      });
      (d.limits?.blockedList || []).forEach((b: any) => {
        const k = `${srv.id}|${b.ip}`;
        blocked.set(k, { ip: b.ip, hits: Number(b.hits) || 0, last: Number(b.last) || 0, server: srv.name });
      });
      (d.limits?.rates || []).forEach((r: any) => {
        const cur = rates.get(r.route) || { route: r.route, calls: 0, errors: 0, msTotal: 0 };
        cur.calls += Number(r.calls) || 0;
        cur.errors += Number(r.errors) || 0;
        cur.msTotal += (Number(r.avgMs) || 0) * (Number(r.calls) || 0);
        rates.set(r.route, cur);
      });
      (d.sessions?.list || []).forEach((s: any) => sessionRows.push({ ...s, server: srv.name }));

      online.push(srv.id);
      serverRows.push({
        id: srv.id,
        name: srv.name,
        region: d.server?.region || srv.region,
        online: true,
        latencyMs: res.value.latencyMs,
        uptimeSec: Number(d.server?.uptimeSec) || 0,
        rssMb: Number(d.server?.rssMb) || 0,
        heapUsedMb: Number(d.server?.heapUsedMb) || 0,
        node: d.server?.node || '',
        shard: d.server?.shard || null,
        maxSessions: Number(d.server?.maxSessions) || 0,
        sessions: Number(d.sessions?.count) || 0,
        connected: Number(d.stats?.connected) || 0,
        reconnecting: Number(d.stats?.reconnecting) || 0,
        editToday: (d.edit?.today || []).reduce((n: number, x: any) => n + (Number(x.count) || 0), 0),
        aiToday: Number(d.ai?.today?.calls) || 0,
        neuronsToday: Number(d.ai?.today?.neurons) || 0,
        blockedHits: Number(d.limits?.blockedTotal) || 0
      });
    } else {
      serverRows.push({
        id: srv.id,
        name: srv.name,
        region: srv.region,
        online: false,
        latencyMs: null,
        uptimeSec: 0,
        rssMb: 0,
        heapUsedMb: 0,
        node: '',
        shard: null,
        maxSessions: 0,
        sessions: 0,
        connected: 0,
        reconnecting: 0,
        editToday: 0,
        aiToday: 0,
        neuronsToday: 0,
        blockedHits: 0
      });
    }
  });

  return NextResponse.json(
    {
      ok: true,
      at: Date.now(),
      cluster: {
        serversOnline: online.length,
        totalServers: servers.length,
        rssMb,
        sessionsTotal,
        connected: serverRows.reduce((n, s) => n + s.connected, 0),
        reconnecting: serverRows.reduce((n, s) => n + s.reconnecting, 0),
        capacity: serverRows.reduce((n, s) => n + s.maxSessions, 0),
        blockedTotal
      },
      servers: serverRows,
      sessions: { count: sessionsTotal, list: sessionRows.slice(0, 200) },
      edit: {
        total: editTotal,
        todayTotal: editTodayTotal,
        today: Array.from(editOwners.values()).sort((a, b) => b.count - a.count),
        models: Array.from(editModels.entries()).map(([model, count]) => ({ model, count })).sort((a, b) => b.count - a.count),
        days: Array.from(editDays.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => (a.date < b.date ? 1 : -1))
      },
      ai: {
        today: { calls: aiTodayCalls, neurons: aiTodayNeurons },
        days: Array.from(aiDays.values()).sort((a, b) => (a.date < b.date ? 1 : -1))
      },
      limits: {
        blockedTotal,
        blockedList: Array.from(blocked.values()).sort((a, b) => b.hits - a.hits),
        rates: Array.from(rates.values())
          .map((r) => ({ route: r.route, calls: r.calls, errors: r.errors, avgMs: r.calls ? Math.round(r.msTotal / r.calls) : 0 }))
          .sort((a, b) => b.calls - a.calls)
          .slice(0, 40)
      }
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

async function dispatch(req: NextRequest, params: { path?: string[] }) {
  const parts = params.path || [];
  const route = parts.join('/');

  if (req.method === 'GET' && route === 'stats') {
    return handleStats();
  }
  if (req.method === 'GET' && route === 'stats/history') {
    return handleStatsHistory();
  }
  if (req.method === 'GET' && route === 'servers') {
    return handleStats();
  }
  if (req.method === 'GET' && route === 'admin/overview') {
    return handleAdminOverview(req);
  }
  if (req.method === 'POST' && route === 'link') {
    return handleLinkStart(req);
  }
  if (req.method === 'POST' && route === 'fulldp/upload') {
    return handleFulldpUpload(req);
  }
  if ((req.method === 'GET' || req.method === 'DELETE') && parts[0] === 'link' && parts[1]) {
    return handleLinkToken(req, parts[1]);
  }
  if (req.method === 'POST' && route === 'panel/login') {
    return handlePanelLogin(req);
  }
  if (parts[0] === 'panel' && parts.length >= 2) {
    return handlePanelProxy(req, parts.slice(1).join('/'));
  }

  const primary = getActiveServers()[0];
  try {
    const r = await fetchJsonWithTimeout(`${primary.url}/api/${route}${req.nextUrl.search}`, {
      method: req.method
    });
    return NextResponse.json(r.data, { status: r.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 502 });
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return dispatch(req, await ctx.params);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return dispatch(req, await ctx.params);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return dispatch(req, await ctx.params);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return dispatch(req, await ctx.params);
}
