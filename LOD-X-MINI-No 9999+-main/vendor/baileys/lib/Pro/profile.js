
export async function checkNumber(sock, phoneNumber) {
    const cleaned = phoneNumber.replace(/[^0-9]/g, '');
    const results = await sock.onWhatsApp(cleaned);
    const first = results?.[0];
    if (first && first.exists) {
        return {
            exists: true,
            jid: first.jid,
            number: cleaned,
            formatted: `+${cleaned}`
        };
    }
    return {
        exists: false,
        number: cleaned,
        formatted: `+${cleaned}`
    };
}

export async function setBio(sock, text) {
    return await sock.updateProfileStatus(text);
}

export async function updateProfileName(sock, name) {
    return await sock.updateProfileName(name);
}

export async function setProfilePicture(sock, jid, content) {
    const targetJid = (!jid || jid === 'me') 
        ? sock.user?.id?.split(':')[0] + '@s.whatsapp.net' 
        : jid;
    return await sock.updateProfilePicture(targetJid, content);
}

export async function removeProfilePicture(sock, jid) {
    const targetJid = (!jid || jid === 'me') 
        ? sock.user?.id?.split(':')[0] + '@s.whatsapp.net' 
        : jid;
    return await sock.removeProfilePicture(targetJid);
}

export async function rejectCall(sock, callId, callFrom) {
    if (typeof sock.rejectCall === 'function') {
        return await sock.rejectCall(callId, callFrom);
    }
    return await sock.query({
        tag: 'call',
        attrs: {
            from: sock.user?.id,
            to: callFrom
        },
        content: [
            {
                tag: 'reject',
                attrs: {
                    'call-id': callId,
                    'call-creator': callFrom,
                    count: '0'
                },
                content: undefined
            }
        ]
    });
}
