
export async function editMessage(sock, jid, key, newText) {
    if (!key) throw new Error('Message key is required to edit');
    return await sock.sendMessage(jid, {
        text: newText,
        edit: key
    });
}

export async function deleteMessage(sock, jid, key) {
    if (!key) throw new Error('Message key is required to delete');
    return await sock.sendMessage(jid, {
        delete: key
    });
}

export async function pinMessage(sock, jid, key, durationInSeconds = 86400) {
    if (!key) throw new Error('Message key is required to pin');
    return await sock.sendMessage(jid, {
        pin: key,
        type: 1,
        time: durationInSeconds
    });
}

export async function unpinMessage(sock, jid, key) {
    if (!key) throw new Error('Message key is required to unpin');
    return await sock.sendMessage(jid, {
        pin: key,
        type: 2
    });
}

export async function starMessage(sock, jid, key, star = true) {
    if (!key?.id) throw new Error('Message key with id is required');
    return await sock.chatModify({
        star: {
            messages: [{ id: key.id, fromMe: key.fromMe || false }],
            star
        }
    }, jid);
}

export async function reactMessage(sock, jid, key, emoji = '') {
    if (!key) throw new Error('Message key is required to react');
    return await sock.sendMessage(jid, {
        react: {
            text: emoji,
            key
        }
    });
}

export async function sendPresence(sock, jid, presence = 'composing') {
    if (presence === 'available' || presence === 'unavailable') {
        return await sock.sendPresenceUpdate(presence);
    }
    return await sock.sendPresenceUpdate(presence, jid);
}

export async function reply(sock, jid, text, quotedMessage = undefined) {
    return await sock.sendMessage(jid, { text }, { quoted: quotedMessage });
}
