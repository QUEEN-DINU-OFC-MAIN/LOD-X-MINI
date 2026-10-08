import config from '../../config.js';
import { B, waLogger } from '../../shared/wa.js';
import { CATS, FOOTER, BOT_NAME, menuImageFor } from './ui.js';

const P = B.proto.Message.InteractiveMessage;

function cardsFor(ctx) {
    const all = [...ctx.platform.commands.unique()]
        .filter((c) => !c.ownerMenu || ctx.isSelf)
        .sort((a, b) => a.name.localeCompare(b.name));
    const cards = [];
    for (const [cat, icon, label] of CATS) {
        const list = all.filter((c) => c.cat === cat && !c.hidden);
        if (!list.length) continue;
        cards.push({ cat, icon, label, list });
    }
    return cards.sort((a, b) => b.list.length - a.list.length);
}

async function buildCard(ctx, sock, upload, { icon, label, list }) {
    const lines = list.map((c) => `• ${ctx.prefix}${c.name}${c.ownerOnly ? ' 🔒' : ''}`).join('\n');
    const media = await B.prepareWAMessageMedia({ image: menuImageFor(list[0].cat) }, { upload, logger: waLogger });
    return {
        header: P.Header.create({ ...media, title: `${icon} ${label} MENU`, subtitle: `${list.length} commands`, hasMediaAttachment: true }),
        body: P.Body.create({ text: `${icon} ${label} MENU — ${list.length}\n${lines}` }),
        nativeFlowMessage: P.NativeFlowMessage.create({ buttons: [] })
    };
}

export function menuHeaderText(ctx, count) {
    const NAME = ctx.settings.botName || BOT_NAME;
    const h = new Date().getUTCHours() + 5.5;
    const greet = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : h < 21 ? 'Good Evening' : 'Good Night';
    return [
        `╭────❲ ${NAME} ❳────❑`,
        `┃ ${greet}, *${ctx.msg.pushName || 'User'}*`,
        `┃`,
        `┃ ❯ ʀᴇɪx   : *${ctx.prefix}*`,
        `┃ ❯ ᴍᴏᴅᴇ    : *${ctx.settings.mode.toUpperCase()}*`,
        `┃ ❯ ᴄᴍᴅꜱ    : *${count}*`,
        `┃ ❯ ᴘᴛᴍᴇ  : *${ctx.runner.uptime()}*`,
        `╰──────────────❑`,
        '',
        '👉 Swipe the cards to open a category.',
        `🌐 ${config.webUrl}`
    ].join('\n');
}

export async function buildCarouselContent(ctx) {
    const sock = ctx.sock;
    const upload = sock.waUploadToServer;
    const cards = cardsFor(ctx);
    const built = await Promise.all(cards.map((c) => buildCard(ctx, sock, upload, c)));
    const all = [...ctx.platform.commands.unique()].filter((c) => !c.hidden || ctx.isSelf);
    const content = {
        viewOnceMessage: {
            message: {
                interactiveMessage: P.create({
                    body: P.Body.create({ text: menuHeaderText(ctx, all.length) }),
                    footer: P.Footer.create({ text: FOOTER }),
                    carouselMessage: P.CarouselMessage.create({ cards: built, messageVersion: 1 }),
                    contextInfo: {
                        mentionedJid: [ctx.sender],
                        forwardingScore: 999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: config.newsletterJid,
                            newsletterName: config.newsletterName,
                            serverMessageId: 143
                        }
                    }
                })
            }
        }
    };
    return content;
}

export async function sendCarouselMenu(ctx) {
    const content = await buildCarouselContent(ctx);
    const msg = B.generateWAMessageFromContent(ctx.jid, content, { logger: waLogger });
    await ctx.sock.relayMessage(ctx.jid, msg.message, { messageId: msg.key.id });
    return msg.key;
}
