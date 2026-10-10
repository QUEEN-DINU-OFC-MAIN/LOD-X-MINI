const depthUnwrap = (m, includeViewOnce, maxDepth) => {
    let depth = 0;
    while (depth < maxDepth && m) {
        if (m.ephemeralMessage?.message) m = m.ephemeralMessage.message;
        else if (m.deviceSentMessage?.message) m = m.deviceSentMessage.message;
        else if (includeViewOnce && m.viewOnceMessage?.message) m = m.viewOnceMessage.message;
        else if (includeViewOnce && m.viewOnceMessageV2?.message) m = m.viewOnceMessageV2.message;
        else if (includeViewOnce && m.viewOnceMessageV2Extension?.message) m = m.viewOnceMessageV2Extension.message;
        else break;
        depth++;
    }
    return m;
};

export function isViewOnce(msg) {
    if (!msg) return false;
    const m = depthUnwrap(msg.message || msg, false, 6);
    if (!m) return false;
    return Boolean(m.viewOnceMessage || m.viewOnceMessageV2 || m.viewOnceMessageV2Extension
        || m.imageMessage?.viewOnce || m.videoMessage?.viewOnce || m.audioMessage?.viewOnce);
}

export function extractViewOnce(msg) {
    if (!msg) return null;
    const m = depthUnwrap(msg.message || msg, true, 8);
    return m ? { ...m, isViewOnce: true } : null;
}

export const VIEWONCE_MEDIA_KEYS = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
