const BASES = ['https://results.exams.gov.lk', 'http://www.results.exams.gov.lk'];
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124 Safari/537.36' };
const txt = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;|&#034;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

async function call(base, path, { method = 'GET', body, jar }) {
    const r = await fetch(`${base}/${path}`, {
        method, redirect: 'follow', signal: AbortSignal.timeout(15000),
        headers: { ...UA, ...(jar.c ? { cookie: jar.c } : {}), ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) }, body
    });
    const sc = r.headers.getSetCookie?.() || [];
    if (sc.length) jar.c = [...new Set([...(jar.c ? jar.c.split('; ') : []), ...sc.map((x) => x.split(';')[0])])].join('; ');
    if (!r.ok) throw new Error(`results portal ${r.status}`);
    return r.text();
}

export const KINDS = {
    ol: { re: /G\.C\.E\.?\s*\(O\/L\)/i, label: 'G.C.E. O/L' },
    al: { re: /G\.C\.E\.?\s*\(A\/L\)\s*Examination/i, label: 'G.C.E. A/L' },
    scholarship: { re: /Grade 5 Scholarship/i, label: 'Grade 5 Scholarship' }
};

export async function examResult(kind, index, year) {
    let last;
    for (const base of BASES) {
        try {
            const jar = {};
            const home = await call(base, '', { jar });
            const forms = [...home.matchAll(/<form action="viewresultsforexam\.htm"[\s\S]*?<\/form>/g)].map((m) => {
                const f = {}; for (const x of m[0].matchAll(/name="(\w+)" value="([^"]*)"/g)) f[x[1]] = txt(x[2]);
                return f;
            });
            const hit = forms.find((f) => KINDS[kind].re.test(f.typeTitle || '') && (!year || (f.typeTitle || '').includes(year) || f.year === year));
            if (!hit) return { notFound: true, noExam: true, title: KINDS[kind].label };
            const base1 = new URLSearchParams(hit);
            await call(base, 'viewresultsforexam.htm', { method: 'POST', body: base1.toString(), jar });
            base1.set('indexNumber', index);
            const html = await call(base, 'viewresults.htm', { method: 'POST', body: base1.toString(), jar });
            if (/Invalid index number|No results? found|Results? not (found|available)/i.test(txt(html))) return { notFound: true, title: hit.typeTitle };
            const rows = [];
            for (const tr of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
                const cells = [...tr[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => txt(c[1])).filter(Boolean);
                if (cells.length && cells.length <= 4 && cells.join(' ').length < 160) rows.push(cells);
            }
            return { title: hit.typeTitle, year: hit.year, rows, plain: txt(html).slice(0, 1200), base };
        } catch (e) { last = e; }
    }
    throw last || new Error('results portal unavailable');
}
