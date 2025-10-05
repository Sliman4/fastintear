import * as reExportAllUtils from '@fastnear/utils';
import { tryParseJson, fromBase64, lsSet, lsGet, privateKeyFromRandom, toBase64, parseJsonFromBytes, canSignWithLAK, serializeTransaction, toBase58, signHash, serializeSignedTransaction, bytesToBase64 } from '@fastnear/utils';
import Big from 'big.js';
import { LocalStorageStateManager, TxHistoryManager, NETWORKS, DEFAULT_NETWORK_ID } from './state.js';
import { WalletAdapter } from './intear.js';
import { sha256 } from '@noble/hashes/sha2';

/* ⋈ 🏃🏻💨 FastNEAR API - ESM (fastintear version 0.3.0) */
/* https://www.npmjs.com/package/fastintear/v/0.3.0 */
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
let globalStateManager = new LocalStorageStateManager();
let globalTxHistoryManager = new TxHistoryManager();
let globalAdapter;
const initializeGlobalAdapter = /* @__PURE__ */ __name(() => {
  if (!globalAdapter) {
    globalAdapter = new WalletAdapter({
      onStateUpdate: /* @__PURE__ */ __name(async (adapterState) => {
        const { accountId, lastWalletId, privateKey, publicKey } = adapterState;
        const currentState = await globalStateManager.getState();
        if (accountId !== currentState?.accountId) {
          const newState = {
            accountId: accountId || null,
            publicKey: publicKey || null,
            privateKey: privateKey || null,
            networkId: currentState?.networkId || DEFAULT_NETWORK_ID,
            lastWalletId: lastWalletId || null,
            accessKeyContractId: currentState?.accessKeyContractId || null
          };
          await globalStateManager.setState(newState);
        }
      }, "onStateUpdate"),
      walletUrl: "https://wallet.intear.tech"
    });
  }
  return globalAdapter;
}, "initializeGlobalAdapter");
Big.DP = 27;
const MaxBlockDelayMs = 1e3 * 60 * 60 * 6;
function withBlockId(params, blockId) {
  if (blockId === "final" || blockId === "optimistic") {
    return { ...params, finality: blockId };
  }
  return blockId ? { ...params, block_id: blockId } : { ...params, finality: "optimistic" };
}
__name(withBlockId, "withBlockId");
let globalConfig = {
  ...NETWORKS[DEFAULT_NETWORK_ID],
  networkId: DEFAULT_NETWORK_ID
};
async function sendRpc(method, params) {
  if (!globalConfig?.nodeUrl) {
    throw new Error("fastnear: getConfig() returned invalid config: missing nodeUrl.");
  }
  const response = await fetch(globalConfig.nodeUrl, {
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
}
__name(sendRpc, "sendRpc");
function afterTxSent(txId) {
  const txHistory = globalTxHistoryManager.getHistory();
  sendRpc("tx", {
    tx_hash: txHistory[txId]?.txHash,
    sender_account_id: txHistory[txId]?.tx?.signerId,
    wait_until: "EXECUTED_OPTIMISTIC"
  }).then((result) => {
    const successValue = result?.result?.status?.SuccessValue;
    globalTxHistoryManager.updateTx({
      txId,
      status: "Executed",
      result,
      successValue: successValue ? tryParseJson(fromBase64(successValue)) : void 0,
      finalState: true
    });
  }).catch((error) => {
    globalTxHistoryManager.updateTx({
      txId,
      status: "ErrorAfterIncluded",
      error: tryParseJson(error.message) ?? error.message,
      finalState: true
    });
  });
}
__name(afterTxSent, "afterTxSent");
async function sendTxToRpc(signedTxBase64, waitUntil, txId) {
  waitUntil = waitUntil || "INCLUDED";
  try {
    const sendTxRes = await sendRpc("send_tx", {
      signed_tx_base64: signedTxBase64,
      wait_until: waitUntil
    });
    globalTxHistoryManager.updateTx({ txId, status: "Included", finalState: false });
    afterTxSent(txId);
    return sendTxRes;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    globalTxHistoryManager.updateTx({
      txId,
      status: "Error",
      error: tryParseJson(errorMessage) ?? errorMessage,
      finalState: false
    });
    throw new Error(errorMessage);
  }
}
__name(sendTxToRpc, "sendTxToRpc");
function generateTxId() {
  const randomPart = crypto.getRandomValues(new Uint32Array(2)).join("");
  return `tx-${Date.now()}-${parseInt(randomPart, 10).toString(36)}`;
}
__name(generateTxId, "generateTxId");
const config = /* @__PURE__ */ __name((newConfig) => {
  if (newConfig) {
    if (newConfig.networkId && globalConfig.networkId !== newConfig.networkId) {
      globalConfig = { ...NETWORKS[newConfig.networkId], networkId: newConfig.networkId };
      globalStateManager = new LocalStorageStateManager(newConfig.networkId);
      globalTxHistoryManager = new TxHistoryManager();
      lsSet("block", null);
    }
    globalConfig = { ...globalConfig, ...newConfig };
  }
  return globalConfig;
}, "config");
const requestSignIn = /* @__PURE__ */ __name(async (params = {}, callbacks = {}) => {
  const { contractId, methodNames } = params;
  const { onSuccess, onError, timeout = 6e4 } = callbacks;
  const networkId = globalConfig.networkId;
  const previousAccountId = lsGet("lastSignedInAccount");
  const currentState = await globalStateManager.getState();
  const isReconnection = !!previousAccountId && previousAccountId !== currentState?.accountId;
  const privateKey = privateKeyFromRandom();
  const newState = {
    ...currentState,
    privateKey,
    accessKeyContractId: contractId || null,
    networkId,
    accountId: currentState?.accountId || null,
    publicKey: currentState?.publicKey || null,
    lastWalletId: currentState?.lastWalletId || null
  };
  await globalStateManager.setState(newState);
  try {
    const adapter = initializeGlobalAdapter();
    const result = await adapter.signIn({
      networkId,
      contractId,
      methodNames,
      callbacks: {
        onError: onError ? (error) => {
          onError(error);
        } : void 0,
        timeout
      },
      messageToSign: params.messageToSign
    });
    if (result.error) {
      const error = {
        type: "wallet_error",
        message: result.error,
        retryable: true,
        suggestedAction: "contact_support",
        originalError: result.error,
        timestamp: Date.now()
      };
      onError?.(error);
      throw new Error(`Wallet error: ${result.error}`);
    }
    if (result.accountId) {
      lsSet("lastSignedInAccount", result.accountId);
      const finalState = {
        accountId: result.accountId,
        privateKey: result.privateKey || privateKey,
        publicKey: result.publicKey || null,
        networkId,
        lastWalletId: null,
        accessKeyContractId: contractId || null
      };
      await globalStateManager.setState(finalState);
      const successResult = {
        accountId: result.accountId,
        publicKey: result.publicKey,
        networkId,
        contractId,
        methodNames,
        accounts: result.accounts || [{ accountId: result.accountId, publicKey: result.publicKey }],
        isReconnection,
        signedMessage: result.signedMessage
      };
      onSuccess?.(successResult);
      return successResult;
    } else {
      console.warn("@fastnear: signIn resolved without accountId or error.");
      await globalStateManager.clearState();
      const error = {
        type: "unknown",
        message: "Sign-in completed but no account information was returned",
        retryable: true,
        suggestedAction: "retry",
        originalError: null,
        timestamp: Date.now()
      };
      onError?.(error);
      throw new Error("Sign-in completed but no account information was returned");
    }
  } catch (err) {
    const error = {
      type: "unknown",
      message: err instanceof Error ? err.message : "Unknown error occurred",
      retryable: true,
      suggestedAction: "contact_support",
      originalError: err,
      timestamp: Date.now()
    };
    onError?.(error);
    throw err;
  }
}, "requestSignIn");
const view = /* @__PURE__ */ __name(async ({
  contractId,
  methodName,
  args,
  argsBase64,
  blockId
}) => {
  const encodedArgs = argsBase64 || (args ? toBase64(JSON.stringify(args)) : "");
  const queryResult = await sendRpc(
    "query",
    withBlockId(
      {
        request_type: "call_function",
        account_id: contractId,
        method_name: methodName,
        args_base64: encodedArgs
      },
      blockId
    )
  );
  return parseJsonFromBytes(queryResult.result.result);
}, "view");
const queryAccount = /* @__PURE__ */ __name(async ({
  accountId,
  blockId
}) => {
  return sendRpc(
    "query",
    withBlockId({ request_type: "view_account", account_id: accountId }, blockId)
  );
}, "queryAccount");
const queryBlock = /* @__PURE__ */ __name(async ({ blockId }) => {
  return sendRpc("block", withBlockId({}, blockId));
}, "queryBlock");
const queryAccessKey = /* @__PURE__ */ __name(async ({
  accountId,
  publicKey,
  blockId
}) => {
  return sendRpc(
    "query",
    withBlockId(
      { request_type: "view_access_key", account_id: accountId, public_key: publicKey },
      blockId
    )
  );
}, "queryAccessKey");
const queryTx = /* @__PURE__ */ __name(async ({ txHash, accountId }) => {
  return sendRpc("tx", [txHash, accountId]);
}, "queryTx");
const localTxHistory = /* @__PURE__ */ __name(() => {
  return globalTxHistoryManager.getHistory();
}, "localTxHistory");
const signOut = /* @__PURE__ */ __name(async () => {
  const adapter = initializeGlobalAdapter();
  await adapter.signOut();
  await globalStateManager.clearState();
}, "signOut");
const signMessage = /* @__PURE__ */ __name(async ({
  message,
  recipient,
  nonce,
  callbackUrl,
  state
}) => {
  const currentState = await globalStateManager.getState();
  const signerId = currentState?.accountId;
  if (!signerId) throw new Error("Must sign in");
  const messageNonce = nonce || crypto.getRandomValues(new Uint8Array(32));
  try {
    const adapter = initializeGlobalAdapter();
    const result = await adapter.signMessage({
      message,
      recipient,
      nonce: messageNonce,
      callbackUrl,
      state
    });
    return {
      accountId: result.accountId,
      publicKey: result.publicKey,
      signature: result.signature
    };
  } catch (err) {
    console.error("fastnear: error signing message using adapter:", err);
    throw err;
  }
}, "signMessage");
const sendTx = /* @__PURE__ */ __name(async ({
  receiverId,
  actions: actions2,
  waitUntil
}) => {
  const currentState = await globalStateManager.getState();
  const signerId = currentState?.accountId;
  if (!signerId) throw new Error("Must sign in");
  const publicKeyValue = currentState?.publicKey ?? "";
  const privKey = currentState?.privateKey;
  const txId = generateTxId();
  if (!privKey || receiverId !== currentState?.accessKeyContractId || !canSignWithLAK(actions2) || hasNonZeroDeposit(actions2)) {
    const jsonTx = { signerId, receiverId, actions: actions2 };
    globalTxHistoryManager.updateTx({ status: "Pending", txId, tx: jsonTx, finalState: false });
    try {
      const adapter = initializeGlobalAdapter();
      const result = await adapter.sendTransactions({
        transactions: [jsonTx]
      });
      if (result.outcomes?.length) {
        result.outcomes.forEach((r) => {
          const transactionEntry = r.get("transaction");
          globalTxHistoryManager.updateTx({
            txId,
            status: "Executed",
            result: r,
            txHash: transactionEntry?.hash,
            finalState: true
          });
        });
      } else if (result.rejected) {
        globalTxHistoryManager.updateTx({ txId, status: "RejectedByUser", finalState: true });
      } else if (result.error) {
        globalTxHistoryManager.updateTx({
          txId,
          status: "Error",
          error: tryParseJson(result.error),
          finalState: true
        });
      }
      return result;
    } catch (err) {
      console.error("fastnear: error sending tx using adapter:", err);
      globalTxHistoryManager.updateTx({
        txId,
        status: "Error",
        error: tryParseJson(err.message),
        finalState: true
      });
      return Promise.reject(err);
    }
  }
  let nonce = lsGet("nonce");
  if (nonce == null) {
    const accessKey = await queryAccessKey({ accountId: signerId, publicKey: publicKeyValue });
    if (accessKey.result.error) {
      throw new Error(`Access key error: ${accessKey.result.error} when attempting to get nonce for ${signerId} for public key ${publicKeyValue}`);
    }
    nonce = accessKey.result.nonce;
    lsSet("nonce", nonce);
  }
  let lastKnownBlock = lsGet("block");
  if (!lastKnownBlock || parseFloat(lastKnownBlock.header.timestamp_nanosec) / 1e6 + MaxBlockDelayMs < Date.now()) {
    const latestBlock = await queryBlock({ blockId: "final" });
    lastKnownBlock = {
      header: {
        hash: latestBlock.result.header.hash,
        timestamp_nanosec: latestBlock.result.header.timestamp_nanosec
      }
    };
    lsSet("block", lastKnownBlock);
  }
  nonce += 1;
  lsSet("nonce", nonce);
  const blockHash = lastKnownBlock.header.hash;
  const plainTransactionObj = {
    signerId,
    publicKey: publicKeyValue,
    nonce,
    receiverId,
    blockHash,
    actions: actions2
  };
  const txBytes = serializeTransaction(plainTransactionObj);
  const txHashBytes = sha256(txBytes);
  const txHash58 = toBase58(txHashBytes);
  const signatureBase58 = signHash(txHashBytes, privKey, { returnBase58: true });
  const signedTransactionBytes = serializeSignedTransaction(plainTransactionObj, signatureBase58);
  const signedTxBase64 = bytesToBase64(signedTransactionBytes);
  globalTxHistoryManager.updateTx({
    status: "Pending",
    txId,
    tx: plainTransactionObj,
    signature: signatureBase58,
    signedTxBase64,
    txHash: txHash58,
    finalState: false
  });
  try {
    return await sendTxToRpc(signedTxBase64, waitUntil, txId);
  } catch (error) {
    console.error("Error Sending Transaction:", error, plainTransactionObj, signedTxBase64);
  }
}, "sendTx");
function hasNonZeroDeposit(actions2) {
  for (const action of actions2) {
    if (action.type === "FunctionCall" || action.type === "Transfer") {
      if (action.params.deposit && action.params.deposit !== "0") {
        return true;
      }
    }
  }
  return false;
}
__name(hasNonZeroDeposit, "hasNonZeroDeposit");
const exp = {
  utils: {},
  borsh: reExportAllUtils.exp.borsh,
  borshSchema: reExportAllUtils.exp.borshSchema.getBorshSchema()
};
for (const key in reExportAllUtils) {
  exp.utils[key] = reExportAllUtils[key];
}
const utils = exp.utils;
const actions = {
  functionCall: /* @__PURE__ */ __name(({
    methodName,
    gas,
    deposit,
    args,
    argsBase64
  }) => {
    let finalArgs = args || {};
    if (!args && argsBase64) {
      try {
        const decoded = fromBase64(argsBase64);
        if (typeof decoded !== "object" || decoded === null || !(decoded instanceof Uint8Array)) {
          throw new Error(
            "Failed to decode base64 contract code, or the result was not a valid Uint8Array."
          );
        }
        finalArgs = JSON.parse(new TextDecoder().decode(decoded));
      } catch (e) {
        console.error("Failed to decode or parse argsBase64:", e);
        throw new Error("Invalid argsBase64 provided for functionCall");
      }
    }
    return {
      type: "FunctionCall",
      params: {
        methodName,
        args: finalArgs,
        gas: gas || "30000000000000",
        deposit: deposit || "0"
      }
    };
  }, "functionCall"),
  transfer: /* @__PURE__ */ __name((yoctoAmount) => ({
    type: "Transfer",
    params: {
      deposit: yoctoAmount
    }
  }), "transfer"),
  stake: /* @__PURE__ */ __name(({ amount, publicKey }) => ({
    type: "Stake",
    params: {
      stake: amount,
      publicKey
    }
  }), "stake"),
  addFullAccessKey: /* @__PURE__ */ __name(({ publicKey }) => ({
    type: "AddKey",
    params: {
      publicKey,
      accessKey: { permission: "FullAccess" }
    }
  }), "addFullAccessKey"),
  addLimitedAccessKey: /* @__PURE__ */ __name(({
    publicKey,
    allowance,
    accountId,
    methodNames
  }) => ({
    type: "AddKey",
    params: {
      publicKey,
      accessKey: {
        permission: {
          receiverId: accountId,
          allowance,
          methodNames
        }
      }
    }
  }), "addLimitedAccessKey"),
  deleteKey: /* @__PURE__ */ __name(({ publicKey }) => ({
    type: "DeleteKey",
    params: {
      publicKey
    }
  }), "deleteKey"),
  deleteAccount: /* @__PURE__ */ __name(({ beneficiaryId }) => ({
    type: "DeleteAccount",
    params: {
      beneficiaryId
    }
  }), "deleteAccount"),
  createAccount: /* @__PURE__ */ __name(() => ({
    type: "CreateAccount"
  }), "createAccount"),
  deployContract: /* @__PURE__ */ __name(({ codeBase64 }) => {
    const codeBytes = fromBase64(codeBase64);
    if (typeof codeBytes !== "object" || codeBytes === null || !(codeBytes instanceof Uint8Array)) {
      throw new Error(
        "Failed to decode base64 contract code, or the result was not a valid Uint8Array."
      );
    }
    return {
      type: "DeployContract",
      params: {
        code: codeBytes
      }
    };
  }, "deployContract")
};

export { MaxBlockDelayMs, actions, afterTxSent, config, exp, generateTxId, localTxHistory, queryAccessKey, queryAccount, queryBlock, queryTx, requestSignIn, sendRpc, sendTx, sendTxToRpc, signMessage, signOut, utils, view, withBlockId };
//# sourceMappingURL=near.js.map
//# sourceMappingURL=near.js.map