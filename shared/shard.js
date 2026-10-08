export function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
}
export const shardOf = (id, count) => (count <= 1 ? 0 : fnv1a(String(id)) % count);
export const makeOwns = (index, count) => (id) => shardOf(id, count) === index;
