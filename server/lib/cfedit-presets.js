export const FACE_LOCK =
    'keep the same subject, person or animal, the same face, pose, framing, background and identity as the original photo, natural skin and fur detail, photorealistic';

export const CF_PRESETS = [
    {
        key: 'old vibe',
        label: 'Old vintage film look ⭐',
        prompt: 'old vintage 1970s film photograph, faded warm sepia colour grade, heavy film grain, soft focus, slight vignette, old photo paper texture, retro analog camera'
    },
    { key: 'vintage', label: 'Vintage retro colour', prompt: 'vintage retro colour photograph, faded tones, light film grain, retro 35mm look' },
    { key: 'bw', label: 'Black & white classic', prompt: 'classic black and white photograph, fine grain, dramatic contrast, timeless' },
    { key: 'colorize', label: 'Colourise an old photo', prompt: 'natural colourised version of this photo, realistic skin tones, soft period-accurate colours' },
    { key: 'cinematic', label: 'Cinematic movie still', prompt: 'cinematic film still, dramatic teal and amber lighting, shallow depth of field, movie poster grade' },
    { key: 'studio', label: 'Professional studio lighting', prompt: 'professional studio photography, softbox lighting, clean neutral grey background, sharp detail' },
    { key: 'hd', label: 'HD sharpen / clean up', prompt: 'enhanced version of this exact photo, sharp natural detail, cleaned noise, balanced light, high resolution look, only the quality improved' },
    { key: 'golden hour', label: 'Golden hour glow', prompt: 'golden hour sunlight, warm backlight, lens flare, dreamy warm tones' },
    { key: 'rainy', label: 'Rainy night mood', prompt: 'rainy night atmosphere, wet street reflections, bokeh city lights, moody blue tones, cinematic' },
    { key: 'snow', label: 'Snowy winter', prompt: 'snowy winter setting, soft falling snow, cold blue light, cinematic' },
    { key: 'beach', label: 'Sri Lanka beach', prompt: 'tropical Sri Lankan beach setting, palm trees, turquoise sea, bright sunny daylight' },
    { key: 'traditional', label: 'Traditional / cultural outfit', prompt: 'traditional Sri Lankan cultural outfit and jewellery, elegant festive background, warm natural light' },
    { key: 'anime', label: 'Anime / illustration', prompt: 'anime illustration style, clean cel shading, vibrant colours, detailed anime background' },
    { key: 'cartoon', label: 'Cartoon 3D', prompt: 'friendly 3D cartoon character style, pixar-like rendering, big bright colours, soft lighting' },
    { key: 'oil', label: 'Oil painting', prompt: 'classical oil painting on canvas, visible brush strokes, warm museum lighting' },
    { key: 'sketch', label: 'Pencil sketch', prompt: 'detailed graphite pencil sketch on textured paper, fine hatching, monochrome' },
    { key: 'watercolor', label: 'Watercolour art', prompt: 'soft watercolour painting, loose brush strokes, paper texture, pastel palette' },
    { key: 'cyberpunk', label: 'Neon cyberpunk', prompt: 'cyberpunk neon city, magenta and cyan lights, futuristic jacket, reflective street' },
    { key: 'mountain', label: 'Mountain adventure', prompt: 'misty mountain range in the background, adventure look, dramatic clouds, natural light' },
    { key: 'city', label: 'Modern city rooftop', prompt: 'modern city skyline in the background, rooftop at dusk, cinematic urban lighting' }
];

export const SINHALA_KEYWORDS = [
    { keys: ['kalu sudu', 'sudu kalu', 'kalusudu', 'කලු සුදු', 'කළු සුදු', 'kalu saha sudu'], preset: 'bw' },
    { keys: ['parana', 'purna', 'පරණ', 'පැරණි', 'paraniya', 'old vibe', 'purana film'], preset: 'old vibe' },
    { keys: ['wassa', 'wessa', 'වැස්ස', 'වහින', 'rainy', 'rain'], preset: 'rainy' },
    { keys: ['hima', 'හිම', 'hima aluth', 'snow'], preset: 'snow' },
    { keys: ['muhuda', 'මුහුද', 'මුහුදු', 'beach', 'velawa', 'වෙරළ'], preset: 'beach' },
    { keys: ['sinama', 'සිනමා', 'cinema', 'film ekak wage', 'movie'], preset: 'cinematic' },
    { keys: ['hadanna', 'පැහැදිලි', 'clear karanna', 'sharp', 'hd', 'quality wadi'], preset: 'hd' },
    { keys: ['anime', 'ඇනිමේ', 'japan cartoon', 'anime wage'], preset: 'anime' },
    { keys: ['cartoon', 'කාටූන්', 'babaa wage', 'baba wage'], preset: 'cartoon' },
    { keys: ['golden hour', 'හැන්දෑවේ', 'handawe', 'sunset', 'hama'], preset: 'golden hour' },
    { keys: ['studio', 'ස්ටුඩියෝ', 'professional photo'], preset: 'studio' },
    { keys: ['traditional', 'සාම්ප්‍රදායික', 'kandyan', 'උඩරට', 'osari'], preset: 'traditional' },
    { keys: ['cyberpunk', 'නියොන්', 'neon', 'futuristic'], preset: 'cyberpunk' },
    { keys: ['oil painting', 'තෙල්', 'oil'], preset: 'oil' },
    { keys: ['sketch', 'පැන්සල්', 'pencil'], preset: 'sketch' },
    { keys: ['watercolor', 'water colour', 'වතුර පාට'], preset: 'watercolor' },
    { keys: ['kanda', 'කන්ද', 'mountain', 'kandu'], preset: 'mountain' },
    { keys: ['city', 'නගරය', 'nagaraya', 'rooftop'], preset: 'city' },
    { keys: ['colour karanna', 'color karanna', 'පාට කරන්න', 'rang karanna', 'colorize'], preset: 'colorize' }
];

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\u0D80-\u0DFF ]/g, ' ').replace(/\s+/g, ' ').trim();

function matchesWords(text, key) {
    const kw = norm(key).split(' ').filter(Boolean);
    const tw = norm(text).split(' ').filter(Boolean);
    for (let i = 0; i + kw.length <= tw.length; i++) {
        let ok = true;
        for (let j = 0; j < kw.length; j++) {
            if (!tw[i + j].startsWith(kw[j])) { ok = false; break; }
        }
        if (ok) return true;
    }
    return false;
}

export function looksSinhala(text) {
    const s = String(text || '');
    if (/[\u0D80-\u0DFF]/.test(s)) return true;
    const words = norm(s).split(' ').filter(Boolean);
    const hints = new Set([
        'eka', 'ekak', 'karanna', 'karnna', 'karanawa', 'kalin', 'thawa', 'tawa', 'wage', 'vage', 'mata', 'mage',
        'hariyata', 'puluwan', 'puluwanada', 'ona', 'oni', 'neda', 'nehe', 'kiyala', 'hama', 'wadi', 'lassana',
        'hodata', 'hodai', 'hondata', 'karala', 'denna', 'danna', 'balanna', 'hadanna', 'wenna', 'wena', 'patavu',
        'haawa', 'kuda', 'loku', 'podi', 'aluth', 'alut', 'parana', 'wassa', 'hima', 'muhuda', 'kanda'
    ]);
    let hits = 0;
    for (const w of words) if (hints.has(w)) hits += 1;
    return words.length > 0 && hits >= Math.max(1, Math.floor(words.length / 3));
}

export function presetPrompt(text) {
    const n = norm(text);
    if (!n) return null;
    const exact = CF_PRESETS.find((p) => norm(p.key) === n);
    if (exact) return `${exact.prompt}, ${FACE_LOCK}`;
    const hits = CF_PRESETS.filter((p) => matchesWords(n, p.key)).sort((a, b) => norm(b.key).length - norm(a.key).length);
    if (hits.length) return `${hits[0].prompt}, ${FACE_LOCK}`;
    return null;
}

export function sinhalaPrompt(text) {
    const n = norm(text);
    if (!n) return null;
    for (const entry of SINHALA_KEYWORDS) {
        for (const k of entry.keys) {
            const key = norm(k);
            if (!key) continue;
            if (matchesWords(n, key) || n.includes(key)) {
                const preset = CF_PRESETS.find((p) => p.key === entry.preset);
                if (preset) return { key: entry.preset, prompt: `${preset.prompt}, ${FACE_LOCK}` };
            }
        }
    }
    return null;
}

export const presetKeys = () => CF_PRESETS.map((p) => p.key);
