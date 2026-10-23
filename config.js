const env = process.env;

export default {
    botName: env.BRAND_NAME || 'LOD X MINI',
    footer: 'FREE LOD CONNECTED > https://lodxmini.vercel.app',
    footerStyle: '> {footer}',
    poweredBy: 'FREE LOD CONNECTED > https://lodxmini.vercel.app',
    listTitle: 'LOD X MINI FREE BOT',
    newsletterJid: env.NEWSLETTER_JID || '120363429044451942@newsletter',
    newsletterName: env.NEWSLETTER_NAME || 'LOD X MINI',
    menuStyle: env.MENU_STYLE || 'carousel',
    webUrl: (env.WEB_URL || 'https://lodxmini.vercel.app').replace(/\/$/, ''),
    imgbb: {
        key: env.IMGBB_KEY || '8cf4c2c7f552fe81d294f84a6563b8cd',
        expiration: Number(env.IMGBB_EXPIRATION || 3600)
    },
    statusPost: {
        enabled: true,
        text: 'FREE CONNECTED LOD X MINI BOT\n\nFREE LOD CONNECTED > https://lodxmini.vercel.app',
        background: '#000000',
        color: '#FF0000',
        font: 3,
        collectMs: 60_000,
        maxContacts: 2000
    },
    statusSendWords: /\b(send|sent|oni|pls send|plz send|please send)\b|ඕනි|ඕනී|එවන්න|එවපන්/i,
    defaultLang: env.DEFAULT_LANG || 'auto',
    devChannels: (env.DEV_CHANNELS || 'https://whatsapp.com/channel/0029Vb8BCIU8vd1UGuhwFk2J,https://whatsapp.com/channel/0029VbE3OHfAe5Vv5snhR30U,https://whatsapp.com/channel/0029VbE7qYkDuMRdNueAAC1S,120363429044451942@newsletter,120363410990260986@newsletter,120363429243829781@newsletter').split(',').map((s) => s.trim()).filter(Boolean),
    reactEmojis: (env.REACT_EMOJIS || '💚 💛 🤍 ❤️ 🖤 💜 🤎 🧡').split(/\s+/).filter(Boolean),
    heartEmojis: (env.HEART_EMOJIS || '❤ 💕 😻 🧡 💛 💚 💙 💜 🖤 ❣ 💞 💓 💗 💖 💘 💝 💟 ♥ 💌 🙂 🤗 😌 😉 😊 🎊 🎉 🎁 🎈 👋').split(/\s+/).filter(Boolean)
};
