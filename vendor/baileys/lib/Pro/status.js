
function hexToArgb(hex) {
    if (!hex) return 0xFF25D366;
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 6) {
        cleanHex = 'FF' + cleanHex;
    }
    return parseInt(cleanHex, 16);
}

export async function sendStatusText(sock, text, options = {}) {
    if (!text) throw new Error('Status text cannot be empty');

    const backgroundColor = options.backgroundColor || '#25D366';
    const font = options.font || 1;

    return await sock.sendMessage('status@broadcast', { text }, {
        backgroundColor,
        font,
        statusJidList: options.statusJidList
    });
}

export async function sendStatusMedia(sock, media, options = {}) {
    const isVideo = options.type === 'video' || (typeof media === 'string' && /\.(mp4|mov|mkv)$/i.test(media));
    const mediaContent = isVideo ? { video: media, caption: options.caption } : { image: media, caption: options.caption };

    return await sock.sendMessage('status@broadcast', mediaContent, {
        statusJidList: options.statusJidList
    });
}

export async function readStatus(sock, key) {
    if (!key) throw new Error('Status key is required to mark as viewed');
    return await sock.readMessages([key]);
}

export async function reactStatus(sock, key, emoji = '💚') {
    if (!key) throw new Error('Status key is required to react');
    const targetParticipant = key.participant || key.remoteJid;

    return await sock.sendMessage('status@broadcast', {
        react: {
            text: emoji,
            key
        }
    }, {
        statusJidList: [targetParticipant]
    });
}
