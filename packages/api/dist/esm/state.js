import { lsGet, publicKeyFromPrivate, lsSet } from '@fastnear/utils';

/* ⋈ 🏃🏻💨 FastNEAR API - ESM (fastintear version 0.3.0) */
/* https://www.npmjs.com/package/fastintear/v/0.3.0 */
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
class LocalStorageStateManager {
  constructor(networkId = DEFAULT_NETWORK_ID) {
    this.networkId = networkId;
    this.loadInitialState();
  }
  static {
    __name(this, "LocalStorageStateManager");
  }
  subscribers = /* @__PURE__ */ new Set();
  currentState = null;
  loadInitialState() {
    try {
      const savedState = lsGet("walletState");
      if (savedState && savedState.networkId === this.networkId) {
        if (savedState.privateKey && !savedState.publicKey) {
          savedState.publicKey = publicKeyFromPrivate(savedState.privateKey);
        }
        this.currentState = savedState;
      }
    } catch (e) {
      console.error("Error loading initial state:", e);
      this.currentState = null;
    }
  }
  async getState() {
    return this.currentState;
  }
  async setState(state) {
    if (state.privateKey && !state.publicKey) {
      state.publicKey = publicKeyFromPrivate(state.privateKey);
    }
    this.currentState = state;
    lsSet("walletState", state);
    if (state.privateKey !== this.currentState?.privateKey) {
      lsSet("nonce", null);
    }
    this.notifySubscribers(state);
  }
  async clearState() {
    const clearedState = {
      accountId: null,
      publicKey: null,
      privateKey: null,
      networkId: this.networkId,
      lastWalletId: null,
      accessKeyContractId: null
    };
    this.currentState = clearedState;
    lsSet("walletState", null);
    lsSet("nonce", null);
    lsSet("block", null);
    this.notifySubscribers(clearedState);
  }
  subscribe(callback) {
    this.subscribers.add(callback);
    if (this.currentState) {
      callback(this.currentState);
    }
    return () => {
      this.subscribers.delete(callback);
    };
  }
  notifySubscribers(state) {
    this.subscribers.forEach((callback) => {
      try {
        callback(state);
      } catch (e) {
        console.error("Error in state subscriber:", e);
      }
    });
  }
}
class MemoryStateManager {
  constructor(networkId = DEFAULT_NETWORK_ID) {
    this.networkId = networkId;
    this.currentState = {
      accountId: null,
      publicKey: null,
      privateKey: null,
      networkId: this.networkId,
      lastWalletId: null,
      accessKeyContractId: null
    };
  }
  static {
    __name(this, "MemoryStateManager");
  }
  subscribers = /* @__PURE__ */ new Set();
  currentState = null;
  async getState() {
    return this.currentState;
  }
  async setState(state) {
    if (state.privateKey && !state.publicKey) {
      state.publicKey = publicKeyFromPrivate(state.privateKey);
    }
    this.currentState = state;
    this.notifySubscribers(state);
  }
  async clearState() {
    const clearedState = {
      accountId: null,
      publicKey: null,
      privateKey: null,
      networkId: this.networkId,
      lastWalletId: null,
      accessKeyContractId: null
    };
    this.currentState = clearedState;
    this.notifySubscribers(clearedState);
  }
  subscribe(callback) {
    this.subscribers.add(callback);
    if (this.currentState) {
      callback(this.currentState);
    }
    return () => {
      this.subscribers.delete(callback);
    };
  }
  notifySubscribers(state) {
    this.subscribers.forEach((callback) => {
      try {
        callback(state);
      } catch (e) {
        console.error("Error in state subscriber:", e);
      }
    });
  }
}
class ExternalStateManagerWrapper {
  constructor(externalManager) {
    this.externalManager = externalManager;
    this.loadInitialState();
  }
  static {
    __name(this, "ExternalStateManagerWrapper");
  }
  subscribers = /* @__PURE__ */ new Set();
  currentState = null;
  async loadInitialState() {
    try {
      this.currentState = await this.externalManager.getState();
    } catch (e) {
      console.error("Error loading external state:", e);
      this.currentState = null;
    }
  }
  async getState() {
    try {
      this.currentState = await this.externalManager.getState();
      return this.currentState;
    } catch (e) {
      console.error("Error getting external state:", e);
      return this.currentState;
    }
  }
  async setState(state) {
    try {
      if (state.privateKey && !state.publicKey) {
        state.publicKey = publicKeyFromPrivate(state.privateKey);
      }
      await this.externalManager.setState(state);
      this.currentState = state;
      this.notifySubscribers(state);
    } catch (e) {
      console.error("Error setting external state:", e);
      throw e;
    }
  }
  async clearState() {
    try {
      await this.externalManager.clearState();
      this.currentState = null;
      this.subscribers.forEach((callback) => {
        try {
          callback({
            accountId: null,
            publicKey: null,
            privateKey: null,
            networkId: this.currentState?.networkId || DEFAULT_NETWORK_ID,
            lastWalletId: null,
            accessKeyContractId: null
          });
        } catch (e) {
          console.error("Error in state subscriber:", e);
        }
      });
    } catch (e) {
      console.error("Error clearing external state:", e);
      throw e;
    }
  }
  subscribe(callback) {
    this.subscribers.add(callback);
    if (this.currentState) {
      callback(this.currentState);
    }
    return () => {
      this.subscribers.delete(callback);
    };
  }
  notifySubscribers(state) {
    this.subscribers.forEach((callback) => {
      try {
        callback(state);
      } catch (e) {
        console.error("Error in state subscriber:", e);
      }
    });
  }
}
class TxHistoryManager {
  static {
    __name(this, "TxHistoryManager");
  }
  txHistory = {};
  subscribers = /* @__PURE__ */ new Set();
  constructor() {
    this.loadHistory();
  }
  loadHistory() {
    try {
      this.txHistory = lsGet("txHistory") || {};
    } catch (e) {
      console.error("Error loading transaction history:", e);
      this.txHistory = {};
    }
  }
  updateTx(txStatus) {
    const txId = txStatus.txId;
    this.txHistory[txId] = {
      ...this.txHistory[txId] || {},
      ...txStatus,
      updateTimestamp: Date.now()
    };
    lsSet("txHistory", this.txHistory);
    this.notifySubscribers(this.txHistory[txId]);
  }
  getHistory() {
    return this.txHistory;
  }
  clearHistory() {
    this.txHistory = {};
    lsSet("txHistory", {});
  }
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }
  notifySubscribers(tx) {
    this.subscribers.forEach((callback) => {
      try {
        callback(tx);
      } catch (e) {
        console.error("Error in tx subscriber:", e);
      }
    });
  }
}

export { DEFAULT_NETWORK_ID, ExternalStateManagerWrapper, LocalStorageStateManager, MemoryStateManager, NETWORKS, TxHistoryManager, WIDGET_URL };
//# sourceMappingURL=state.js.map
//# sourceMappingURL=state.js.map