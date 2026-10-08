import test from 'node:test';
import assert from 'node:assert/strict';
import { emojiSet, isDevChannelJid, configureChannels } from '../server/lib/channels.js';
import { sanitize } from '../shared/panel-settings.js';
import config from '../config.js';

test('reaction emoji set: panel override wins, config default is the fallback', () => {
    assert.deepEqual(emojiSet({ reactEmojis: '🦄 ⭐ , ❤️' }), ['🦄', '⭐', '❤️']);
    assert.deepEqual(emojiSet({ reactEmojis: '' }), config.reactEmojis);
    assert.deepEqual(emojiSet({}), config.reactEmojis);
    assert.ok(config.reactEmojis.includes('💚') && config.reactEmojis.includes('🧡'));
});

test('dev channel registry accepts only configured channels', () => {
    configureChannels(['120000000000222@newsletter']);
    assert.equal(isDevChannelJid('120000000000222@newsletter'), true);
    assert.equal(isDevChannelJid('120333@newsletter'), false);
    configureChannels(config.devChannels);
});

test('panel accepts a custom reaction emoji set and allows clearing it', () => {
    assert.equal(sanitize({ reactEmojis: '🦄 ⭐ ❤️' }).reactEmojis, '🦄 ⭐ ❤️');
    assert.ok('reactEmojis' in sanitize({ reactEmojis: '' }));
});
