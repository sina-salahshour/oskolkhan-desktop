/**
 * API barrel. Feature screens import the typed client, query/mutation hooks,
 * contract types and protobuf types from here (or from `lib/query`).
 */
export { client, rpc } from './client';
export type { ApiClient } from './client';
export * from './contract';
export * from './types';
