import crypto from 'crypto';
import { proto } from '../../WAProto/index.js';
import { getBinaryNodeChild, getBinaryNodeChildren } from '../WABinary/index.js';

export async function newsletterVoteMessage(sock, jid, serverId, option) {
    const sId = serverId.toString();
    const optionText = option || 'TEST';
    const optionHash = crypto.createHash('sha256').update(optionText).digest();
    const optionHashHex = optionHash.toString('hex');

    const channelPollUpdateMsg = {
        pollUpdateMessage: {
            pollCreationMessageKey: {
                remoteJid: jid,
                id: sId,
                fromMe: false
            },
            senderTimestampMs: Date.now()
        }
    };

    const relayResult = await sock.relayMessage(jid, channelPollUpdateMsg, {
        additionalAttributes: {
            server_id: sId
        }
    });

    try {
        await sock.query({
            tag: 'message',
            attrs: {
                to: jid,
                type: 'poll',
                server_id: sId,
                id: sock.generateMessageTag()
            },
            content: [
                {
                    tag: 'poll_vote',
                    attrs: {
                        option: optionHashHex
                    }
                }
            ]
        }).catch(() => {});
    } catch (e) {}

    return {
        success: true,
        channelJid: jid,
        serverId: sId,
        option: optionText,
        optionHashHex,
        relayResult
    };
}

export async function newsletterReact(sock, jid, serverId, reaction = '') {
    return await sock.newsletterReactMessage(jid, serverId.toString(), reaction);
}

export async function newsletterGetMessages(sock, jid, count = 20, since = undefined, after = undefined) {
    const rawUpdates = await sock.newsletterFetchMessages(jid, count, since, after);
    const updatesNode = getBinaryNodeChild(rawUpdates, 'message_updates');
    const messageContainers = getBinaryNodeChildren(updatesNode, 'messages');

    const result = [];
    if (!messageContainers) return result;

    for (const container of messageContainers) {
        const msgNodes = getBinaryNodeChildren(container, 'message');
        for (const m of msgNodes) {
            const serverId = m.attrs?.server_id;
            const messageId = m.attrs?.id;
            const timestamp = m.attrs?.time ? parseInt(m.attrs.time, 10) : null;

            const viewsNode = getBinaryNodeChild(m, 'views_count');
            const viewsCount = viewsNode?.attrs?.count ? parseInt(viewsNode.attrs.count, 10) : 0;

            const reactionsNode = getBinaryNodeChild(m, 'reactions');
            const reactions = [];
            if (reactionsNode) {
                const reactionList = getBinaryNodeChildren(reactionsNode, 'reaction');
                for (const r of reactionList) {
                    reactions.push({
                        emoji: r.attrs?.code,
                        count: parseInt(r.attrs?.count || '0', 10)
                    });
                }
            }

            const votesNode = getBinaryNodeChild(m, 'votes');
            const pollVotes = [];
            if (votesNode) {
                const voteList = getBinaryNodeChildren(votesNode, 'vote');
                for (const v of voteList) {
                    const hashBuffer = v.content;
                    pollVotes.push({
                        count: parseInt(v.attrs?.count || '0', 10),
                        optionHash: Buffer.isBuffer(hashBuffer) ? hashBuffer.toString('hex') : null
                    });
                }
            }

            const pTextNode = getBinaryNodeChild(m, 'plaintext');
            let decodedMessage = null;
            let text = null;
            let mediaType = null;
            let poll = null;

            if (pTextNode && pTextNode.content) {
                try {
                    decodedMessage = proto.Message.decode(pTextNode.content);
                    text = decodedMessage.conversation || 
                           decodedMessage.extendedTextMessage?.text || 
                           decodedMessage.imageMessage?.caption || 
                           decodedMessage.videoMessage?.caption;

                    if (decodedMessage.imageMessage) mediaType = 'image';
                    else if (decodedMessage.videoMessage) mediaType = 'video';
                    else if (decodedMessage.audioMessage) mediaType = 'audio';
                    else if (decodedMessage.documentMessage) mediaType = 'document';

                    const pollMsg = decodedMessage.pollCreationMessage || 
                                    decodedMessage.pollCreationMessageV2 || 
                                    decodedMessage.pollCreationMessageV3;

                    if (pollMsg) {
                        mediaType = 'poll';
                        poll = {
                            name: pollMsg.name,
                            options: (pollMsg.options || []).map(o => ({
                                name: o.optionName,
                                hash: crypto.createHash('sha256').update(o.optionName || '').digest('hex')
                            })),
                            selectableCount: pollMsg.selectableOptionsCount || 1,
                            votes: pollVotes
                        };
                    }
                } catch (e) {}
            }

            result.push({
                serverId,
                messageId,
                timestamp,
                mediaType: mediaType || (pollVotes.length > 0 ? 'poll' : 'text'),
                text,
                poll,
                viewsCount,
                reactions,
                rawProto: decodedMessage
            });
        }
    }

    return result;
}

export async function newsletterSearch(sock, query) {
    if (!query) throw new Error('Search query is required');
    const result = await sock.query({
        tag: 'iq',
        attrs: {
            id: sock.generateMessageTag(),
            type: 'get',
            xmlns: 'newsletter',
            to: 's.whatsapp.net'
        },
        content: [
            {
                tag: 'search',
                attrs: { query }
            }
        ]
    }).catch(async () => {
        return await sock.newsletterMetadata('invite', query);
    });
    return result;
}

export async function newsletterList(sock) {
    try {
        const result = await sock.query({
            tag: 'iq',
            attrs: {
                id: sock.generateMessageTag(),
                type: 'get',
                xmlns: 'newsletter',
                to: 's.whatsapp.net'
            },
            content: [{ tag: 'subscribed', attrs: {} }]
        });
        return result;
    } catch (e) {
        return [];
    }
}

export async function channelVote(sock, target, option, explicitServerId = null) {
    if (!sock) throw new Error('Socket instance is required');
    if (!target) throw new Error('Target (link, JID, or quoted message) is required');
    if (option === undefined || option === null || option === '') {
        throw new Error('Option or option number to vote for is required');
    }

    let jid = null;
    let serverId = explicitServerId ? explicitServerId.toString() : null;
    let pollOptions = null;

    if (typeof target === 'object') {
        const ctx = target.extendedTextMessage?.contextInfo || target.contextInfo || target;

        if (ctx.forwardedNewsletterMessageInfo?.newsletterJid) {
            jid = ctx.forwardedNewsletterMessageInfo.newsletterJid;
            if (ctx.forwardedNewsletterMessageInfo.serverMessageId) {
                serverId = ctx.forwardedNewsletterMessageInfo.serverMessageId.toString();
            }
        } else if (ctx.remoteJid?.endsWith('@newsletter')) {
            jid = ctx.remoteJid;
        } else if (ctx.participant?.endsWith('@newsletter')) {
            jid = ctx.participant;
        }

        if (!serverId && (ctx.stanzaId || ctx.server_id || ctx.serverId)) {
            serverId = (ctx.server_id || ctx.serverId || ctx.stanzaId).toString();
        }

        const qm = ctx.quotedMessage || target.message;
        const pollMsg = qm?.pollCreationMessage || qm?.pollCreationMessageV2 || qm?.pollCreationMessageV3;
        if (pollMsg?.options?.length) {
            pollOptions = pollMsg.options.map((o) => o.optionName);
        }
    } else if (typeof target === 'string') {
        const trimmed = target.trim();
        const channelLinkMatch = trimmed.match(/whatsapp\.com\/channel\/([a-zA-Z0-9_-]+)(?:\/(\d+))?/i);
        if (channelLinkMatch) {
            const inviteCode = channelLinkMatch[1];
            const urlServerId = channelLinkMatch[2];
            if (urlServerId) serverId = urlServerId;

            try {
                const meta = await sock.newsletterMetadata('invite', inviteCode);
                jid = meta?.id || meta?.jid;
            } catch (err) {
                throw new Error(`Could not resolve channel invite "${inviteCode}": ${err.message}`);
            }
        } else if (trimmed.endsWith('@newsletter')) {
            jid = trimmed;
        }
    }

    if (!jid) {
        throw new Error('Could not determine Channel (Newsletter) JID from target.');
    }

    if (!serverId || !pollOptions) {
        try {
            const recent = await newsletterGetMessages(sock, jid, 25);
            const targetPoll = serverId
                ? recent.find((m) => m.serverId?.toString() === serverId && (m.mediaType === 'poll' || m.poll)) ||
                  recent.find((m) => m.serverId?.toString() === serverId)
                : recent.find((m) => m.mediaType === 'poll' || m.poll);
            if (targetPoll) {
                if (!serverId) serverId = targetPoll.serverId?.toString();
                if (targetPoll.poll?.options?.length) {
                    pollOptions = targetPoll.poll.options.map((o) => o.name);
                }
            }
        } catch {}
    }

    if (!serverId) {
        throw new Error('Could not find poll message server ID in this channel.');
    }

    let selectedOptionText = String(option).trim();
    if (pollOptions && pollOptions.length > 0) {
        if (/^\d+$/.test(selectedOptionText)) {
            const idx = parseInt(selectedOptionText, 10) - 1;
            if (idx >= 0 && idx < pollOptions.length) {
                selectedOptionText = pollOptions[idx];
            }
        } else if (/^[a-zA-Z]$/.test(selectedOptionText)) {
            const letterIdx = selectedOptionText.toUpperCase().charCodeAt(0) - 65;
            const exactLetterMatch = pollOptions.find((o) => o.trim().toUpperCase() === selectedOptionText.toUpperCase());
            if (exactLetterMatch) {
                selectedOptionText = exactLetterMatch;
            } else if (letterIdx >= 0 && letterIdx < pollOptions.length) {
                selectedOptionText = pollOptions[letterIdx];
            }
        } else {
            const matched = pollOptions.find((o) => o.toLowerCase() === selectedOptionText.toLowerCase());
            if (matched) selectedOptionText = matched;
        }
    }

    const voteResult = await newsletterVoteMessage(sock, jid, serverId, selectedOptionText);
    return {
        ...voteResult,
        channelJid: jid,
        serverId,
        selectedOption: selectedOptionText,
        option: selectedOptionText
    };
}

