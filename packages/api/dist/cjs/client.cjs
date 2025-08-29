'use strict';

var near = require('./near.js');
var state_js = require('./state.js');
var intear_js = require('./intear.js');
var utils = require('@fastnear/utils');

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var near__namespace = /*#__PURE__*/_interopNamespace(near);

/* ⋈ 🏃🏻💨 FastNEAR API - CJS (fastintear version 0.2.4) */
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
    ...state_js.NETWORKS[initialConfig?.networkId || state_js.DEFAULT_NETWORK_ID],
    ...initialConfig
  };
  let clientTxHistory = {};
  const clientAdapter = new intear_js.WalletAdapter({
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
    walletUrl: state_js.WIDGET_URL
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
      clientState.publicKey = newState.privateKey ? utils.publicKeyFromPrivate(newState.privateKey) : null;
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
          clientConfig = { ...state_js.NETWORKS[newConfig.networkId], networkId: newConfig.networkId };
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
      const originalState = { ...state_js._state };
      const originalConfig = { ...state_js._config };
      try {
        Object.assign(state_js._state, clientState);
        Object.assign(state_js._config, clientConfig);
        const result = await near__namespace.requestSignIn(params, callbacks);
        clientUpdate({
          accountId: state_js._state.accountId,
          privateKey: state_js._state.privateKey,
          publicKey: state_js._state.publicKey,
          accessKeyContractId: state_js._state.accessKeyContractId
        });
        return result;
      } finally {
        Object.assign(state_js._state, originalState);
        Object.assign(state_js._config, originalConfig);
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
      const originalConfig = { ...state_js._config };
      try {
        Object.assign(state_js._config, clientConfig);
        return near__namespace.view(params);
      } finally {
        Object.assign(state_js._config, originalConfig);
      }
    }, "view"),
    queryAccount: /* @__PURE__ */ __name((params) => {
      const originalConfig = { ...state_js._config };
      try {
        Object.assign(state_js._config, clientConfig);
        return near__namespace.queryAccount(params);
      } finally {
        Object.assign(state_js._config, originalConfig);
      }
    }, "queryAccount"),
    queryBlock: /* @__PURE__ */ __name((params) => {
      const originalConfig = { ...state_js._config };
      try {
        Object.assign(state_js._config, clientConfig);
        return near__namespace.queryBlock(params);
      } finally {
        Object.assign(state_js._config, originalConfig);
      }
    }, "queryBlock"),
    queryAccessKey: /* @__PURE__ */ __name((params) => {
      const originalConfig = { ...state_js._config };
      try {
        Object.assign(state_js._config, clientConfig);
        return near__namespace.queryAccessKey(params);
      } finally {
        Object.assign(state_js._config, originalConfig);
      }
    }, "queryAccessKey"),
    queryTx: /* @__PURE__ */ __name((params) => {
      const originalConfig = { ...state_js._config };
      try {
        Object.assign(state_js._config, clientConfig);
        return near__namespace.queryTx(params);
      } finally {
        Object.assign(state_js._config, originalConfig);
      }
    }, "queryTx"),
    // Transaction methods
    sendTx: /* @__PURE__ */ __name(async (params) => {
      const originalState = { ...state_js._state };
      const originalConfig = { ...state_js._config };
      try {
        Object.assign(state_js._state, clientState);
        Object.assign(state_js._config, clientConfig);
        const result = await near__namespace.sendTx(params);
        clientUpdate({
          accountId: state_js._state.accountId,
          privateKey: state_js._state.privateKey,
          publicKey: state_js._state.publicKey,
          accessKeyContractId: state_js._state.accessKeyContractId
        });
        return result;
      } finally {
        Object.assign(state_js._state, originalState);
        Object.assign(state_js._config, originalConfig);
      }
    }, "sendTx"),
    signMessage: /* @__PURE__ */ __name(async (params) => {
      const originalState = { ...state_js._state };
      try {
        Object.assign(state_js._state, clientState);
        return await near__namespace.signMessage(params);
      } finally {
        Object.assign(state_js._state, originalState);
      }
    }, "signMessage"),
    // Transaction history
    localTxHistory: /* @__PURE__ */ __name(() => clientTxHistory, "localTxHistory"),
    // Events
    event: clientEvents,
    // Action helpers (these are pure functions, no state needed)
    actions: near__namespace.actions,
    // Utils and exports (these are pure, no state needed)
    utils: near__namespace.utils,
    exp: near__namespace.exp
  };
}
__name(createNearClient, "createNearClient");

exports.createNearClient = createNearClient;
//# sourceMappingURL=client.cjs.map
//# sourceMappingURL=client.cjs.map