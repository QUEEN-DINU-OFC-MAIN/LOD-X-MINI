import makeWASocket from './Socket/index.js';
import { attachProMethods } from './Pro/index.js';

export * from '../WAProto/index.js';
export * from './Utils/index.js';
export * from './Types/index.js';
export * from './Defaults/index.js';
export * from './WABinary/index.js';
export * from './WAM/index.js';
export * from './WAUSync/index.js';
export * from './Pro/index.js';
export { attachProMethods };

const makeSocket = (config = {}) => attachProMethods(makeWASocket(config));
export { makeSocket as makeWASocket };
export default makeSocket;
