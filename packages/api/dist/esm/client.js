import * as near from './near.js';
import { DEFAULT_NETWORK_ID, NETWORKS, ExternalStateManagerWrapper, MemoryStateManager, LocalStorageStateManager, TxHistoryManager, WIDGET_URL } from './state.js';
import { WalletAdapter } from './intear.js';
import { publicKeyFromPrivate } from '@fastnear/utils';

/* ⋈ 🏃🏻💨 FastNEAR API - ESM (fastintear version 0.3.0) */
/* https://www.npmjs.com/package/fastintear/v/0.3.0 */
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
function createNearClient(config = {}) {
  const networkId = config.networkId || DEFAULT_NETWORK_ID;
  const networkConfig = {
    ...NETWORKS[networkId],
    networkId
  };
  let stateManager;
  if (config.stateManager) {
    if ("subscribe" in config.stateManager) {
      stateManager = config.stateManager;
    } else {
      stateManager = new ExternalStateManagerWrapper(config.stateManager);
    }
  } else if (config.isolateState) {
    stateManager = new MemoryStateManager(networkId);
  } else {
    stateManager = new LocalStorageStateManager(networkId);
  }
  const txHistoryManager = new TxHistoryManager();
  let currentState = null;
  stateManager.getState().then((state) => {
    currentState = state;
    if (state && config.callbacks?.onStateChange) {
      config.callbacks.onStateChange(state);
    }
  });
  const unsubscribeState = stateManager.subscribe((state) => {
    const previousState = currentState;
    currentState = state;
    if (config.callbacks?.onStateChange) {
      config.callbacks.onStateChange(state);
    }
    if (!previousState?.accountId && state.accountId) {
      config.callbacks?.onConnect?.({
        accountId: state.accountId,
        publicKey: state.publicKey || ""
      });
    } else if (previousState?.accountId && !state.accountId) {
      config.callbacks?.onDisconnect?.();
    }
  });
  const clientAdapter = new WalletAdapter({
    onStateUpdate: /* @__PURE__ */ __name(async (adapterState) => {
      const { accountId, lastWalletId, privateKey } = adapterState;
      if (accountId !== currentState?.accountId) {
        const newState = {
          accountId: accountId || null,
          publicKey: privateKey ? publicKeyFromPrivate(privateKey) : null,
          privateKey: privateKey || null,
          networkId,
          lastWalletId: lastWalletId || null,
          accessKeyContractId: currentState?.accessKeyContractId || null
        };
        await stateManager.setState(newState);
      }
    }, "onStateUpdate"),
    walletUrl: WIDGET_URL
  });
  return {
    // State accessors
    accountId: /* @__PURE__ */ __name(() => currentState?.accountId || null, "accountId"),
    publicKey: /* @__PURE__ */ __name(() => currentState?.publicKey || null, "publicKey"),
    authStatus: /* @__PURE__ */ __name(() => currentState?.accountId ? "SignedIn" : "SignedOut", "authStatus"),
    // State management
    getState: /* @__PURE__ */ __name(() => stateManager.getState(), "getState"),
    setState: /* @__PURE__ */ __name((state) => stateManager.setState(state), "setState"),
    clearState: /* @__PURE__ */ __name(() => stateManager.clearState(), "clearState"),
    // State restoration for external management
    restoreFromExternalState: /* @__PURE__ */ __name(async (state) => {
      const walletState = {
        accountId: state.accountId,
        publicKey: state.publicKey,
        privateKey: state.privateKey || null,
        networkId: state.networkId,
        lastWalletId: null,
        accessKeyContractId: null
      };
      await stateManager.setState(walletState);
    }, "restoreFromExternalState"),
    // Check if externally managed
    isExternallyManaged: /* @__PURE__ */ __name(() => {
      return stateManager instanceof ExternalStateManagerWrapper;
    }, "isExternallyManaged"),
    // Config management
    config: /* @__PURE__ */ __name((newConfig) => {
      if (newConfig) {
        Object.assign(networkConfig, newConfig);
        if (newConfig.networkId && networkConfig.networkId !== newConfig.networkId) {
          stateManager.clearState();
          txHistoryManager.clearHistory();
        }
      }
      return networkConfig;
    }, "config"),
    // Selection info
    selected: /* @__PURE__ */ __name(() => {
      const network = networkConfig.networkId;
      const nodeUrl = networkConfig.nodeUrl;
      const walletUrl = networkConfig.walletUrl;
      const helperUrl = networkConfig.helperUrl;
      const explorerUrl = networkConfig.explorerUrl;
      const account = currentState?.accountId;
      const contract = currentState?.accessKeyContractId;
      const publicKey = currentState?.publicKey;
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
    // Authentication methods
    requestSignIn: /* @__PURE__ */ __name(async (params = {}, callbacks = {}) => {
      const result = await near.requestSignIn(params, callbacks);
      if (result.accountId) {
        const newState = {
          accountId: result.accountId,
          publicKey: result.publicKey,
          privateKey: null,
          // Will be set by adapter
          networkId,
          lastWalletId: null,
          accessKeyContractId: params.contractId || null
        };
        await stateManager.setState(newState);
      }
      return result;
    }, "requestSignIn"),
    signOut: /* @__PURE__ */ __name(async () => {
      await clientAdapter.signOut();
      await stateManager.clearState();
    }, "signOut"),
    // RPC methods
    sendRpc: near.sendRpc,
    // Query methods
    view: near.view,
    queryAccount: near.queryAccount,
    queryBlock: near.queryBlock,
    queryAccessKey: near.queryAccessKey,
    queryTx: near.queryTx,
    // Transaction methods
    sendTx: near.sendTx,
    signMessage: near.signMessage,
    // Transaction history
    localTxHistory: /* @__PURE__ */ __name(() => txHistoryManager.getHistory(), "localTxHistory"),
    // State subscription
    subscribe: /* @__PURE__ */ __name((callback) => {
      return stateManager.subscribe(callback);
    }, "subscribe"),
    // Transaction subscription
    onTx: /* @__PURE__ */ __name((callback) => {
      return txHistoryManager.subscribe(callback);
    }, "onTx"),
    // Action helpers
    actions: near.actions,
    // Utils and exports
    utils: near.utils,
    exp: near.exp,
    // Cleanup
    destroy: /* @__PURE__ */ __name(() => {
      unsubscribeState();
    }, "destroy")
  };
}
__name(createNearClient, "createNearClient");

export { createNearClient };
//# sourceMappingURL=client.js.map
//# sourceMappingURL=client.js.map