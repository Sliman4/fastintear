'use strict';

var utils = require('@fastnear/utils');
var intear = require('./intear');

/* ⋈ 🏃🏻💨 FastNEAR API - CJS (fastintear version 0.2.4) */
/* https://www.npmjs.com/package/fastintear/v/0.2.4 */
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
const WIDGET_URL = "https://wallet.intear.tech";
const DEFAULT_NETWORK_ID = "mainnet";
const NETWORKS = {
  testnet: {
    networkId: "testnet",
    nodeUrl: "https://rpc.testnet.fastnear.com/"
  },
  mainnet: {
    networkId: "mainnet",
    nodeUrl: "https://rpc.mainnet.fastnear.com/"
  }
};
exports._config = utils.lsGet("config") || {
  ...NETWORKS[DEFAULT_NETWORK_ID]
};
exports._state = utils.lsGet("state") || {};
const onAdapterStateUpdate = /* @__PURE__ */ __name((state) => {
  const { accountId, lastWalletId, privateKey } = state;
  const newAccountId = accountId || null;
  if (newAccountId !== exports._state.accountId) {
    update({
      accountId: newAccountId,
      lastWalletId: lastWalletId || void 0,
      ...privateKey ? { privateKey } : {}
    });
  }
}, "onAdapterStateUpdate");
const getWalletAdapterState = /* @__PURE__ */ __name(() => {
  return {
    publicKey: exports._state.publicKey,
    accountId: exports._state.accountId,
    lastWalletId: exports._state.lastWalletId,
    networkId: exports._config.networkId
  };
}, "getWalletAdapterState");
let _adapter = new intear.WalletAdapter({
  onStateUpdate: onAdapterStateUpdate,
  walletUrl: WIDGET_URL
});
try {
  exports._state.publicKey = exports._state.privateKey ? utils.publicKeyFromPrivate(exports._state.privateKey) : null;
} catch (e) {
  console.error("Error parsing private key:", e);
  exports._state.privateKey = null;
  utils.lsSet("nonce", null);
}
exports._txHistory = utils.lsGet("txHistory") || {};
const _unbroadcastedEvents = {
  account: [],
  tx: []
};
const events = {
  _eventListeners: {
    account: /* @__PURE__ */ new Set(),
    tx: /* @__PURE__ */ new Set()
  },
  notifyAccountListeners: /* @__PURE__ */ __name((accountId) => {
    if (events._eventListeners.account.size === 0) {
      _unbroadcastedEvents.account.push(accountId);
      return;
    }
    events._eventListeners.account.forEach((callback) => {
      try {
        callback(accountId);
      } catch (e) {
        console.error(e);
      }
    });
  }, "notifyAccountListeners"),
  notifyTxListeners: /* @__PURE__ */ __name((tx) => {
    if (events._eventListeners.tx.size === 0) {
      _unbroadcastedEvents.tx.push(tx);
      return;
    }
    events._eventListeners.tx.forEach((callback) => {
      try {
        callback(tx);
      } catch (e) {
        console.error(e);
      }
    });
  }, "notifyTxListeners"),
  onAccount: /* @__PURE__ */ __name((callback) => {
    events._eventListeners.account.add(callback);
    if (_unbroadcastedEvents.account.length > 0) {
      const accountEvent = _unbroadcastedEvents.account;
      _unbroadcastedEvents.account = [];
      accountEvent.forEach(events.notifyAccountListeners);
    }
    return callback;
  }, "onAccount"),
  onTx: /* @__PURE__ */ __name((callback) => {
    events._eventListeners.tx.add(callback);
    if (_unbroadcastedEvents.tx.length > 0) {
      const txEvent = _unbroadcastedEvents.tx;
      _unbroadcastedEvents.tx = [];
      txEvent.forEach(events.notifyTxListeners);
    }
    return callback;
  }, "onTx"),
  offAccount: /* @__PURE__ */ __name((callback) => {
    events._eventListeners.account.delete(callback);
  }, "offAccount"),
  offTx: /* @__PURE__ */ __name((callback) => {
    events._eventListeners.tx.delete(callback);
  }, "offTx")
};
const update = /* @__PURE__ */ __name((newState) => {
  const oldState = exports._state;
  exports._state = { ...exports._state, ...newState };
  utils.lsSet("state", {
    accountId: exports._state.accountId,
    privateKey: exports._state.privateKey,
    lastWalletId: exports._state.lastWalletId,
    accessKeyContractId: exports._state.accessKeyContractId
  });
  if (newState.hasOwnProperty("privateKey") && newState.privateKey !== oldState.privateKey) {
    exports._state.publicKey = newState.privateKey ? utils.publicKeyFromPrivate(newState.privateKey) : null;
    utils.lsSet("nonce", null);
  }
  if (newState.hasOwnProperty("accountId") && newState.accountId !== oldState.accountId) {
    events.notifyAccountListeners(newState.accountId);
  }
  if (newState.hasOwnProperty("lastWalletId") && newState.lastWalletId !== oldState.lastWalletId || newState.hasOwnProperty("accountId") && newState.accountId !== oldState.accountId || newState.hasOwnProperty("privateKey") && newState.privateKey !== oldState.privateKey) {
    _adapter.setState(getWalletAdapterState());
  }
}, "update");
const updateTxHistory = /* @__PURE__ */ __name((txStatus) => {
  const txId = txStatus.txId;
  exports._txHistory[txId] = {
    ...exports._txHistory[txId] || {},
    ...txStatus,
    updateTimestamp: Date.now()
  };
  utils.lsSet("txHistory", exports._txHistory);
  events.notifyTxListeners(exports._txHistory[txId]);
}, "updateTxHistory");
const getConfig = /* @__PURE__ */ __name(() => {
  return exports._config;
}, "getConfig");
const getTxHistory = /* @__PURE__ */ __name(() => {
  return exports._txHistory;
}, "getTxHistory");
const setConfig = /* @__PURE__ */ __name((newConf) => {
  exports._config = { ...NETWORKS[newConf.networkId], ...newConf };
  utils.lsSet("config", exports._config);
}, "setConfig");
const resetTxHistory = /* @__PURE__ */ __name(() => {
  exports._txHistory = {};
  utils.lsSet("txHistory", exports._txHistory);
}, "resetTxHistory");

exports.DEFAULT_NETWORK_ID = DEFAULT_NETWORK_ID;
exports.NETWORKS = NETWORKS;
exports.WIDGET_URL = WIDGET_URL;
exports._adapter = _adapter;
exports._unbroadcastedEvents = _unbroadcastedEvents;
exports.events = events;
exports.getConfig = getConfig;
exports.getTxHistory = getTxHistory;
exports.getWalletAdapterState = getWalletAdapterState;
exports.onAdapterStateUpdate = onAdapterStateUpdate;
exports.resetTxHistory = resetTxHistory;
exports.setConfig = setConfig;
exports.update = update;
exports.updateTxHistory = updateTxHistory;
//# sourceMappingURL=state.cjs.map
//# sourceMappingURL=state.cjs.map