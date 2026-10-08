import { getJson, enc } from '../lib/http.js';
const need = (ctx, usage) => { if (!ctx.text) { ctx.reply(`ℹ️ Usage: ${ctx.prefix}${usage}`); return true; } };
const WX = { 0: 'Clear ☀️', 1: 'Mostly clear 🌤️', 2: 'Partly cloudy ⛅', 3: 'Overcast ☁️', 45: 'Fog 🌫️', 48: 'Fog 🌫️', 51: 'Drizzle 🌦️', 53: 'Drizzle 🌦️', 55: 'Drizzle 🌦️', 61: 'Rain 🌧️', 63: 'Rain 🌧️', 65: 'Heavy rain 🌧️', 80: 'Showers 🌦️', 81: 'Showers 🌦️', 82: 'Heavy showers ⛈️', 95: 'Thunderstorm ⛈️', 96: 'Thunderstorm ⛈️', 99: 'Thunderstorm ⛈️' };

export default [
    {
        name: 'wiki', aliases: ['wikipedia'], cat: 'search', desc: 'Wikipedia summary',
        async run(ctx) {
            if (need(ctx, 'wiki Sri Lanka')) return;
            const s = await getJson(`https://en.wikipedia.org/w/api.php?action=opensearch&limit=1&format=json&search=${enc(ctx.text)}`);
            const title = s?.[1]?.[0]; if (!title) return ctx.reply('❌ Nothing found');
            const j = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${enc(title)}`);
            await ctx.reply(`📚 *${j.title}*\n\n${(j.extract || '').slice(0, 900)}\n\n🔗 ${j.content_urls?.desktop?.page || ''}`);
        }
    },
    {
        name: 'weather', aliases: ['wx', 'wt', 'clima'], cat: 'search', desc: 'Weather  (.weather Colombo)',
        async run(ctx) {
            if (need(ctx, 'weather Colombo')) return;
            const g = (await getJson(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${enc(ctx.text)}`)).results?.[0];
            if (!g) return ctx.reply('❌ City not found');
            const w = (await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code`)).current;
            await ctx.reply(`🌦️ *${g.name}, ${g.country || ''}*\n\n▫️ ${WX[w.weather_code] || 'n/a'}\n▫️ Temp : ${w.temperature_2m}°C (feels ${w.apparent_temperature}°C)\n▫️ Humidity : ${w.relative_humidity_2m}%\n▫️ Wind : ${w.wind_speed_10m} km/h`);
        }
    },
    {
        name: 'github', aliases: ['gh', 'ghuser', 'gituser'], cat: 'search', desc: 'GitHub user info',
        async run(ctx) {
            if (need(ctx, 'github octocat')) return;
            const j = await getJson(`https://api.github.com/users/${enc(ctx.args[0])}`);
            if (!j.login) return ctx.reply('❌ User not found');
            await ctx.sock.sendMessage(ctx.jid, { image: { url: j.avatar_url }, caption: `🐙 *${j.name || j.login}* (@${j.login})\n\n${j.bio || ''}\n\n▫️ Repos : ${j.public_repos}\n▫️ Followers : ${j.followers}\n▫️ Following : ${j.following}\n🔗 ${j.html_url}` }, { quoted: ctx.msg });
        }
    },
    {
        name: 'crypto', aliases: ['btc', 'cryptoprice'], cat: 'search', desc: 'Crypto price  (.crypto bitcoin)',
        async run(ctx) {
            const id = (ctx.args[0] || 'bitcoin').toLowerCase();
            const j = (await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${enc(id)}&vs_currencies=usd,lkr&include_24hr_change=true`))[id];
            if (!j) return ctx.reply('❌ Unknown coin id (use names like bitcoin, ethereum, solana)');
            await ctx.reply(`🪙 *${id}*\n\n💵 $${j.usd}\n🇱🇰 Rs ${j.lkr}\n📈 24h : ${j.usd_24h_change?.toFixed(2)}%`);
        }
    }
];
