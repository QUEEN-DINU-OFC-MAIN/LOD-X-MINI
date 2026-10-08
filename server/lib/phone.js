export function normalizePhone(raw, defaultCc = '94') {
    let d = String(raw || '').replace(/[^\d]/g, '');
    if (!d) return null;
    if (d.startsWith('00')) d = d.slice(2);
    else if (d.startsWith('0') && d.length >= 9 && d.length <= 11) d = defaultCc + d.slice(1);
    else if (d.length === 9 && d.startsWith('7')) d = defaultCc + d;
    return d.length >= 8 && d.length <= 15 ? d : null;
}
