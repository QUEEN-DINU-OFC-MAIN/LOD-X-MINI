import { translateText } from './i18n.js';

const EN = {
    installing: ({ brand, prefix, number, webUrl, password }) =>
`╭━━━━━━━━━━━━━━━━━━━━╮
   ✅ *${brand}* — Connected!
╰━━━━━━━━━━━━━━━━━━━━╯

👋 Your WhatsApp number (+${number}) is linked successfully!

⚙️ *Your bot is getting ready…*
⏳ Please wait about *5 minutes*.

🔎 Then send \`${prefix}menu\` or \`${prefix}ping\`.
🔁 If a command does not answer yet, try again in 5 minutes.

━━━━━━━━━━━━━━━━━━━━
🔐 *YOUR SETTINGS PANEL*
Change every bot setting from your phone.

🌐 ${webUrl}/panel
📱 Number : *${number}*
🔑 Password : *${password}*

💡 Or send \`${prefix}web\` to your bot for a link that needs no password.
🗣️ The bot speaks your language automatically — change it with \`${prefix}lang\`.

> *FREE RCD CONNECTED > https://rcdxmini.dexterid.org*`,
    live: ({ brand, prefix }) =>
`🟢 *${brand}* is now *LIVE!*

📜 Send \`${prefix}menu\` to see every command.
🌐 Send \`${prefix}web\` for your settings panel link.
🗣️ Send \`${prefix}lang\` to change the language.

> *FREE RCD CONNECTED > https://rcdxmini.dexterid.org*`
};

const SI = {
    installing: ({ brand, prefix, number, webUrl, password }) =>
`╭━━━━━━━━━━━━━━━━━━━━╮
   ✅ *${brand}* — සම්බන්ධ වුණා!
╰━━━━━━━━━━━━━━━━━━━━╯

👋 ඔයාගේ WhatsApp number එක (+${number}) සාර්ථකව link වුණා!

⚙️ *Bot එක සූදානම් වෙමින් පවතී…*
⏳ කරුණාකර *විනාඩි 5ක්* විතර ඉන්න.

🔎 ඊට පස්සේ \`${prefix}menu\` හෝ \`${prefix}ping\` ටයිප් කරන්න.
🔁 Command වැඩ කළේ නැත්නම් විනාඩි 5කින් නැවත උත්සාහ කරන්න.

━━━━━━━━━━━━━━━━━━━━
🔐 *ඔයාගේ SETTINGS PANEL එක*
Bot එකේ හැම setting එකක්ම ෆෝන් එකෙන්ම වෙනස් කරන්න පුළුවන්.

🌐 ${webUrl}/panel
📱 Number : *${number}*
🔑 Password : *${password}*

💡 නැත්නම් Bot එකට \`${prefix}web\` යවන්න — password එකක් නැතුව කෙලින්ම ඇතුල් වෙන link එකක් එනවා.
🗣️ Bot ඔයාගේ භාෂාවෙන් ඉබේම කතා කරනවා — \`${prefix}lang\` වලින් වෙනස් කරන්න.

> *FREE RCD CONNECTED > https://rcdxmini.dexterid.org*`,
    live: ({ brand, prefix }) =>
`🟢 *${brand}* දැන් ක්‍රියාත්මකයි!

📜 සියලුම commands බලන්න \`${prefix}menu\` යවන්න.
🌐 Settings panel link එක සඳහා \`${prefix}web\` යවන්න.
🗣️ භාෂාව වෙනස් කරන්න \`${prefix}lang\` යවන්න.

> *FREE RCD CONNECTED > https://rcdxmini.dexterid.org*`
};

const pick = (lang) => (lang === 'si' ? SI : EN);

export async function installingCaption(lang, vars) {
    const t = pick(lang).installing(vars);
    return lang === 'si' || lang === 'en' ? t : translateText(t, lang, { args: `${vars.password} ${vars.webUrl}`, budgetMs: 6000 });
}

export async function liveCaption(lang, vars) {
    const t = pick(lang).live(vars);
    return lang === 'si' || lang === 'en' ? t : translateText(t, lang, { budgetMs: 6000 });
}
