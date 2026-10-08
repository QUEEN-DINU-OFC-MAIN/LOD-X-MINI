
export async function groupGetInviteInfo(sock, inviteCode) {
    const code = inviteCode.replace(/.*chat\.whatsapp\.com\//, '').trim();
    return await sock.groupGetInviteInfo(code);
}

export async function groupJoinViaInvite(sock, inviteCode) {
    const code = inviteCode.replace(/.*chat\.whatsapp\.com\//, '').trim();
    return await sock.groupAcceptInvite(code);
}

export async function groupSetAnnouncement(sock, jid, onlyAdminsCanSend = true) {
    return await sock.groupSettingUpdate(jid, onlyAdminsCanSend ? 'announcement' : 'not_announcement');
}

export async function groupSetLocked(sock, jid, onlyAdminsCanEdit = true) {
    return await sock.groupSettingUpdate(jid, onlyAdminsCanEdit ? 'locked' : 'unlocked');
}

export async function groupRequestParticipantsList(sock, jid) {
    return await sock.groupRequestParticipantsList(jid);
}

export async function groupApproveParticipants(sock, jid, participants) {
    return await sock.groupRequestParticipantsUpdate(jid, participants, 'approve');
}

export async function groupRejectParticipants(sock, jid, participants) {
    return await sock.groupRequestParticipantsUpdate(jid, participants, 'reject');
}
