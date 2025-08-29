import * as near from './near.js';
import { NETWORKS, DEFAULT_NETWORK_ID, WIDGET_URL, _state, _config } from './state.js';
import { WalletAdapter } from './intear.js';
import { publicKeyFromPrivate } from '@fastnear/utils';

/* ⋈ 🏃🏻💨 FastNEAR API - ESM (fastintear version 0.2.4) */
/* https://www.npmjs.com/package/fastintear/v/0.2.4 */
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
function createNearClient(initialConfig) {
  const clientState = {
    accountId: null,
    privateKey: null,
    lastWalletId: null,
    publicKey: null,
    accessKeyContractId: null
  };
  let clientConfig = {
    ...NETWORKS[initialConfig?.networkId || DEFAULT_NETWORK_ID],
    ...initialConfig
  };
  let clientTxHistory = {};
  const clientAdapter = new WalletAdapter({
    onStateUpdate: /* @__PURE__ */ __name((state) => {
      const { accountId, lastWalletId, privateKey } = state;
      const newAccountId = accountId || null;
      if (newAccountId !== clientState.accountId) {
        clientUpdate({
          accountId: newAccountId,
          lastWalletId: lastWalletId || void 0,
          ...privateKey ? { privateKey } : {}
        });
      }
    }, "onStateUpdate"),
    walletUrl: WIDGET_URL
  });
  const clientEvents = {
    _eventListeners: {
      account: /* @__PURE__ */ new Set(),
      tx: /* @__PURE__ */ new Set()
    },
    notifyAccountListeners: /* @__PURE__ */ __name((accountId) => {
      clientEvents._eventListeners.account.forEach((callback) => {
        try {
          callback(accountId);
        } catch (e) {
          console.error(e);
        }
      });
    }, "notifyAccountListeners"),
    notifyTxListeners: /* @__PURE__ */ __name((tx) => {
      clientEvents._eventListeners.tx.forEach((callback) => {
        try {
          callback(tx);
        } catch (e) {
          console.error(e);
        }
      });
    }, "notifyTxListeners"),
    onAccount: /* @__PURE__ */ __name((callback) => {
      clientEvents._eventListeners.account.add(callback);
      return callback;
    }, "onAccount"),
    onTx: /* @__PURE__ */ __name((callback) => {
      clientEvents._eventListeners.tx.add(callback);
      return callback;
    }, "onTx"),
    offAccount: /* @__PURE__ */ __name((callback) => {
      clientEvents._eventListeners.account.delete(callback);
    }, "offAccount"),
    offTx: /* @__PURE__ */ __name((callback) => {
      clientEvents._eventListeners.tx.delete(callback);
    }, "offTx")
  };
  const clientUpdate = /* @__PURE__ */ __name((newState) => {
    const oldState = { ...clientState };
    Object.assign(clientState, newState);
    if (newState.hasOwnProperty("privateKey") && newState.privateKey !== oldState.privateKey) {
      clientState.publicKey = newState.privateKey ? publicKeyFromPrivate(newState.privateKey) : null;
    }
    if (newState.hasOwnProperty("accountId") && newState.accountId !== oldState.accountId) {
      clientEvents.notifyAccountListeners(newState.accountId);
    }
    if (newState.hasOwnProperty("lastWalletId") && newState.lastWalletId !== oldState.lastWalletId || newState.hasOwnProperty("accountId") && newState.accountId !== oldState.accountId || newState.hasOwnProperty("privateKey") && newState.privateKey !== oldState.privateKey) {
      clientAdapter.setState({
        publicKey: clientState.publicKey,
        accountId: clientState.accountId,
        lastWalletId: clientState.lastWalletId,
        networkId: clientConfig.networkId
      });
    }
  }, "clientUpdate");
  const clientSendRpc = /* @__PURE__ */ __name(async (method, params) => {
    if (!clientConfig?.nodeUrl) {
      throw new Error("fastnear: client config missing nodeUrl.");
    }
    const response = await fetch(clientConfig.nodeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `fastnear-${Date.now()}`,
        method,
        params
      })
    });
    const result = await response.json();
    if (result.error) {
      throw new Error(JSON.stringify(result.error));
    }
    return result;
  }, "clientSendRpc");
  return {
    // State accessors
    accountId: /* @__PURE__ */ __name(() => clientState.accountId, "accountId"),
    publicKey: /* @__PURE__ */ __name(() => clientState.publicKey, "publicKey"),
    authStatus: /* @__PURE__ */ __name(() => clientState.accountId ? "SignedIn" : "SignedOut", "authStatus"),
    // Config management
    config: /* @__PURE__ */ __name((newConfig) => {
      if (newConfig) {
        if (newConfig.networkId && clientConfig.networkId !== newConfig.networkId) {
          clientConfig = { ...NETWORKS[newConfig.networkId], networkId: newConfig.networkId };
          clientUpdate({ accountId: null, privateKey: null, lastWalletId: null });
          clientTxHistory = {};
        }
        clientConfig = { ...clientConfig, ...newConfig };
      }
      return clientConfig;
    }, "config"),
    // Selection info
    selected: /* @__PURE__ */ __name(() => {
      const network = clientConfig.networkId;
      const nodeUrl = clientConfig.nodeUrl;
      const walletUrl = clientConfig.walletUrl;
      const helperUrl = clientConfig.helperUrl;
      const explorerUrl = clientConfig.explorerUrl;
      const account = clientState.accountId;
      const contract = clientState.accessKeyContractId;
      const publicKey = clientState.publicKey;
      return {
        network,
        nodeUrl,
        walletUrl,
        helperUrl,
        explorerUrl,
        account,
        contract,
        publicKey
      };
    }, "selected"),
    // Authentication - using the existing function but with client state
    requestSignIn: /* @__PURE__ */ __name(async (params = {}, callbacks = {}) => {
      const originalState = { ..._state };
      const originalConfig = { ..._config };
      try {
        Object.assign(_state, clientState);
        Object.assign(_config, clientConfig);
        const result = await near.requestSignIn(params, callbacks);
        clientUpdate({
          accountId: _state.accountId,
          privateKey: _state.privateKey,
          publicKey: _state.publicKey,
          accessKeyContractId: _state.accessKeyContractId
        });
        return result;
      } finally {
        Object.assign(_state, originalState);
        Object.assign(_config, originalConfig);
      }
    }, "requestSignIn"),
    signOut: /* @__PURE__ */ __name(async () => {
      await clientAdapter.signOut();
      clientUpdate({ accountId: null, privateKey: null, accessKeyContractId: null, lastWalletId: null });
    }, "signOut"),
    // RPC methods - using client config
    sendRpc: clientSendRpc,
    // Wrap other functions to use client state/config
    view: /* @__PURE__ */ __name((params) => {
      const originalConfig = { ..._config };
      try {
        Object.assign(_config, clientConfig);
        return near.view(params);
      } finally {
        Object.assign(_config, originalConfig);
      }
    }, "view"),
    queryAccount: /* @__PURE__ */ __name((params) => {
      const originalConfig = { ..._config };
      try {
        Object.assign(_config, clientConfig);
        return near.queryAccount(params);
      } finally {
        Object.assign(_config, originalConfig);
      }
    }, "queryAccount"),
    queryBlock: /* @__PURE__ */ __name((params) => {
      const originalConfig = { ..._config };
      try {
        Object.assign(_config, clientConfig);
        return near.queryBlock(params);
      } finally {
        Object.assign(_config, originalConfig);
      }
    }, "queryBlock"),
    queryAccessKey: /* @__PURE__ */ __name((params) => {
      const originalConfig = { ..._config };
      try {
        Object.assign(_config, clientConfig);
        return near.queryAccessKey(params);
      } finally {
        Object.assign(_config, originalConfig);
      }
    }, "queryAccessKey"),
    queryTx: /* @__PURE__ */ __name((params) => {
      const originalConfig = { ..._config };
      try {
        Object.assign(_config, clientConfig);
        return near.queryTx(params);
      } finally {
        Object.assign(_config, originalConfig);
      }
    }, "queryTx"),
    // Transaction methods
    sendTx: /* @__PURE__ */ __name(async (params) => {
      const originalState = { ..._state };
      const originalConfig = { ..._config };
      try {
        Object.assign(_state, clientState);
        Object.assign(_config, clientConfig);
        const result = await near.sendTx(params);
        clientUpdate({
          accountId: _state.accountId,
          privateKey: _state.privateKey,
          publicKey: _state.publicKey,
          accessKeyContractId: _state.accessKeyContractId
        });
        return result;
      } finally {
        Object.assign(_state, originalState);
        Object.assign(_config, originalConfig);
      }
    }, "sendTx"),
    signMessage: /* @__PURE__ */ __name(async (params) => {
      const originalState = { ..._state };
      try {
        Object.assign(_state, clientState);
        return await near.signMessage(params);
      } finally {
        Object.assign(_state, originalState);
      }
    }, "signMessage"),
    // Transaction history
    localTxHistory: /* @__PURE__ */ __name(() => clientTxHistory, "localTxHistory"),
    // Events
    event: clientEvents,
    // Action helpers (these are pure functions, no state needed)
    actions: near.actions,
    // Utils and exports (these are pure, no state needed)
    utils: near.utils,
    exp: near.exp
  };
}
__name(createNearClient, "createNearClient");

export { createNearClient };
//# sourceMappingURL=client.js.map
//# sourceMappingURL=client.js.map