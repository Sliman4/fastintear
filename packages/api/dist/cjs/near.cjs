'use strict';

var reExportAllUtils = require('@fastnear/utils');
var Big = require('big.js');
var stateExports = require('./state.js');
var sha2 = require('@noble/hashes/sha2');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

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

var reExportAllUtils__namespace = /*#__PURE__*/_interopNamespace(reExportAllUtils);
var Big__default = /*#__PURE__*/_interopDefault(Big);
var stateExports__namespace = /*#__PURE__*/_interopNamespace(stateExports);

/* ⋈ 🏃🏻💨 FastNEAR API - CJS (fastintear version 0.2.4) */
/* https://www.npmjs.com/package/fastintear/v/0.2.4 */
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
Big__default.default.DP = 27;
const MaxBlockDelayMs = 1e3 * 60 * 60 * 6;
function withBlockId(params, blockId) {
  if (blockId === "final" || blockId === "optimistic") {
    return { ...params, finality: blockId };
  }
  return blockId ? { ...params, block_id: blockId } : { ...params, finality: "optimistic" };
}
__name(withBlockId, "withBlockId");
async function sendRpc(method, params) {
  const config2 = stateExports.getConfig();
  if (!config2?.nodeUrl) {
    throw new Error("fastnear: getConfig() returned invalid config: missing nodeUrl.");
  }
  const response = await fetch(config2.nodeUrl, {
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
  const txHistory = stateExports.getTxHistory();
  sendRpc("tx", {
    tx_hash: txHistory[txId]?.txHash,
    sender_account_id: txHistory[txId]?.tx?.signerId,
    wait_until: "EXECUTED_OPTIMISTIC"
  }).then((result) => {
    const successValue = result?.result?.status?.SuccessValue;
    stateExports.updateTxHistory({
      txId,
      status: "Executed",
      result,
      successValue: successValue ? reExportAllUtils.tryParseJson(reExportAllUtils.fromBase64(successValue)) : void 0,
      finalState: true
    });
  }).catch((error) => {
    stateExports.updateTxHistory({
      txId,
      status: "ErrorAfterIncluded",
      error: reExportAllUtils.tryParseJson(error.message) ?? error.message,
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
    stateExports.updateTxHistory({ txId, status: "Included", finalState: false });
    afterTxSent(txId);
    return sendTxRes;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    stateExports.updateTxHistory({
      txId,
      status: "Error",
      error: reExportAllUtils.tryParseJson(errorMessage) ?? errorMessage,
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
let lastAccountCheckTime = 0;
const ACCOUNT_CHECK_INTERVAL = 6e4;
const accountId = /* @__PURE__ */ __name(() => {
  const currentTime = Date.now();
  if (stateExports._state.accountId && currentTime - lastAccountCheckTime > ACCOUNT_CHECK_INTERVAL) {
    lastAccountCheckTime = currentTime;
    stateExports._adapter.getAccounts().then((accounts) => {
      if (accounts.length === 0 && stateExports._state.accountId) {
        stateExports.update({ accountId: null, privateKey: null, lastWalletId: null });
      }
    }).catch((e) => {
      console.error("Error checking account status:", e);
    });
  }
  return stateExports._state.accountId;
}, "accountId");
const publicKey = /* @__PURE__ */ __name(() => stateExports._state.publicKey, "publicKey");
const config = /* @__PURE__ */ __name((newConfig) => {
  const current = stateExports.getConfig();
  if (newConfig) {
    if (newConfig.networkId && current.networkId !== newConfig.networkId) {
      stateExports.setConfig({ ...stateExports.NETWORKS[newConfig.networkId], networkId: newConfig.networkId });
      stateExports.update({ accountId: null, privateKey: null, lastWalletId: null });
      reExportAllUtils.lsSet("block", null);
      stateExports.resetTxHistory();
    }
    stateExports.setConfig({ ...stateExports.getConfig(), ...newConfig });
  }
  return stateExports.getConfig();
}, "config");
const authStatus = /* @__PURE__ */ __name(() => {
  if (!stateExports._state.accountId) {
    return "SignedOut";
  }
  return "SignedIn";
}, "authStatus");
const getPublicKeyForContract = /* @__PURE__ */ __name((opts) => {
  return publicKey();
}, "getPublicKeyForContract");
const selected = /* @__PURE__ */ __name(() => {
  const config2 = stateExports.getConfig();
  const network = config2.networkId;
  const nodeUrl = config2.nodeUrl;
  const walletUrl = config2.walletUrl;
  const helperUrl = config2.helperUrl;
  const explorerUrl = config2.explorerUrl;
  const account = accountId();
  const contract = stateExports._state.accessKeyContractId;
  const publicKey2 = getPublicKeyForContract();
  return {
    network,
    nodeUrl,
    walletUrl,
    helperUrl,
    explorerUrl,
    account,
    contract,
    publicKey: publicKey2
  };
}, "selected");
const requestSignIn = /* @__PURE__ */ __name(async (params = {}, callbacks = {}) => {
  const { contractId, methodNames } = params;
  const { onSuccess, onError, timeout = 6e4 } = callbacks;
  const networkId = stateExports.getConfig().networkId;
  const previousAccountId = reExportAllUtils.lsGet("lastSignedInAccount");
  const isReconnection = !!previousAccountId && previousAccountId !== stateExports._state.accountId;
  const privateKey = reExportAllUtils.privateKeyFromRandom();
  stateExports.update({ accessKeyContractId: contractId, privateKey });
  try {
    const result = await stateExports._adapter.signIn({
      networkId,
      contractId,
      methodNames,
      callbacks: {
        onError: onError ? (error) => {
          onError(error);
        } : void 0,
        timeout
      }
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
      reExportAllUtils.lsSet("lastSignedInAccount", result.accountId);
      stateExports.update({
        accountId: result.accountId,
        privateKey: result.privateKey,
        publicKey: result.publicKey,
        accessKeyContractId: contractId
      });
      const successResult = {
        accountId: result.accountId,
        publicKey: result.publicKey,
        networkId,
        contractId,
        methodNames,
        accounts: result.accounts || [{ accountId: result.accountId, publicKey: result.publicKey }],
        isReconnection
      };
      onSuccess?.(successResult);
      return successResult;
    } else {
      console.warn("@fastnear: signIn resolved without accountId or error.");
      stateExports.update({ accountId: null, privateKey: null, publicKey: null, accessKeyContractId: null });
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
  const encodedArgs = argsBase64 || (args ? reExportAllUtils.toBase64(JSON.stringify(args)) : "");
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
  return reExportAllUtils.parseJsonFromBytes(queryResult.result.result);
}, "view");
const queryAccount = /* @__PURE__ */ __name(async ({
  accountId: accountId2,
  blockId
}) => {
  return sendRpc(
    "query",
    withBlockId({ request_type: "view_account", account_id: accountId2 }, blockId)
  );
}, "queryAccount");
const queryBlock = /* @__PURE__ */ __name(async ({ blockId }) => {
  return sendRpc("block", withBlockId({}, blockId));
}, "queryBlock");
const queryAccessKey = /* @__PURE__ */ __name(async ({
  accountId: accountId2,
  publicKey: publicKey2,
  blockId
}) => {
  return sendRpc(
    "query",
    withBlockId(
      { request_type: "view_access_key", account_id: accountId2, public_key: publicKey2 },
      blockId
    )
  );
}, "queryAccessKey");
const queryTx = /* @__PURE__ */ __name(async ({ txHash, accountId: accountId2 }) => {
  return sendRpc("tx", [txHash, accountId2]);
}, "queryTx");
const localTxHistory = /* @__PURE__ */ __name(() => {
  return stateExports.getTxHistory();
}, "localTxHistory");
const signOut = /* @__PURE__ */ __name(async () => {
  await stateExports._adapter.signOut();
  stateExports.update({ accountId: null, privateKey: null, accessKeyContractId: null, lastWalletId: null });
}, "signOut");
const signMessage = /* @__PURE__ */ __name(async ({
  message,
  recipient,
  nonce,
  callbackUrl,
  state: state2
}) => {
  const signerId = stateExports._state.accountId;
  if (!signerId) throw new Error("Must sign in");
  const messageNonce = nonce || crypto.getRandomValues(new Uint8Array(32));
  try {
    const result = await stateExports._adapter.signMessage({
      message,
      recipient,
      // @ts-ignore - We know the adapter expects Buffer but we're using Uint8Array
      nonce: messageNonce,
      callbackUrl,
      state: state2
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
  const signerId = stateExports._state.accountId;
  if (!signerId) throw new Error("Must sign in");
  const publicKey2 = stateExports._state.publicKey ?? "";
  const privKey = stateExports._state.privateKey;
  const txId = generateTxId();
  if (!privKey || receiverId !== stateExports._state.accessKeyContractId || !reExportAllUtils.canSignWithLAK(actions2) || hasNonZeroDeposit(actions2)) {
    const jsonTx = { signerId, receiverId, actions: actions2 };
    stateExports.updateTxHistory({ status: "Pending", txId, tx: jsonTx, finalState: false });
    const url = new URL(typeof window !== "undefined" ? window.location.href : "");
    url.searchParams.set("txIds", txId);
    const existingParams = new URLSearchParams(window.location.search);
    existingParams.forEach((value, key) => {
      if (!url.searchParams.has(key)) {
        url.searchParams.set(key, value);
      }
    });
    url.searchParams.delete("errorCode");
    url.searchParams.delete("errorMessage");
    try {
      const result = await stateExports._adapter.sendTransactions({
        transactions: [jsonTx]
      });
      if (result.outcomes?.length) {
        result.outcomes.forEach((r) => {
          const transactionEntry = r.get("transaction");
          stateExports.updateTxHistory({
            txId,
            status: "Executed",
            result: r,
            txHash: transactionEntry?.hash,
            finalState: true
          });
        });
      } else if (result.rejected) {
        stateExports.updateTxHistory({ txId, status: "RejectedByUser", finalState: true });
      } else if (result.error) {
        stateExports.updateTxHistory({
          txId,
          status: "Error",
          error: reExportAllUtils.tryParseJson(result.error),
          finalState: true
        });
      }
      return result;
    } catch (err) {
      console.error("fastnear: error sending tx using adapter:", err);
      stateExports.updateTxHistory({
        txId,
        status: "Error",
        error: reExportAllUtils.tryParseJson(err.message),
        finalState: true
      });
      return Promise.reject(err);
    }
  }
  let nonce = reExportAllUtils.lsGet("nonce");
  if (nonce == null) {
    const accessKey = await queryAccessKey({ accountId: signerId, publicKey: publicKey2 });
    if (accessKey.result.error) {
      throw new Error(`Access key error: ${accessKey.result.error} when attempting to get nonce for ${signerId} for public key ${publicKey2}`);
    }
    nonce = accessKey.result.nonce;
    reExportAllUtils.lsSet("nonce", nonce);
  }
  let lastKnownBlock = reExportAllUtils.lsGet("block");
  if (!lastKnownBlock || parseFloat(lastKnownBlock.header.timestamp_nanosec) / 1e6 + MaxBlockDelayMs < Date.now()) {
    const latestBlock = await queryBlock({ blockId: "final" });
    lastKnownBlock = {
      header: {
        hash: latestBlock.result.header.hash,
        timestamp_nanosec: latestBlock.result.header.timestamp_nanosec
      }
    };
    reExportAllUtils.lsSet("block", lastKnownBlock);
  }
  nonce += 1;
  reExportAllUtils.lsSet("nonce", nonce);
  const blockHash = lastKnownBlock.header.hash;
  const plainTransactionObj = {
    signerId,
    publicKey: publicKey2,
    nonce,
    receiverId,
    blockHash,
    actions: actions2
  };
  const txBytes = reExportAllUtils.serializeTransaction(plainTransactionObj);
  const txHashBytes = sha2.sha256(txBytes);
  const txHash58 = reExportAllUtils.toBase58(txHashBytes);
  const signatureBase58 = reExportAllUtils.signHash(txHashBytes, privKey, { returnBase58: true });
  const signedTransactionBytes = reExportAllUtils.serializeSignedTransaction(plainTransactionObj, signatureBase58);
  const signedTxBase64 = reExportAllUtils.bytesToBase64(signedTransactionBytes);
  stateExports.updateTxHistory({
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
  // we will map this in a moment, giving keys, for IDE hints
  borsh: reExportAllUtils__namespace.exp.borsh,
  borshSchema: reExportAllUtils__namespace.exp.borshSchema.getBorshSchema()
};
for (const key in reExportAllUtils__namespace) {
  exp.utils[key] = reExportAllUtils__namespace[key];
}
const utils = exp.utils;
const state = {};
for (const key in stateExports__namespace) {
  state[key] = stateExports__namespace[key];
}
const event = state["events"];
delete state["events"];
try {
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    const accId = url.searchParams.get("account_id");
    const pubKey = url.searchParams.get("public_key");
    const errCode = url.searchParams.get("errorCode");
    const errMsg = url.searchParams.get("errorMessage");
    const decodedErrMsg = errMsg ? decodeURIComponent(errMsg) : null;
    const txHashes = url.searchParams.get("transactionHashes");
    const txIds = url.searchParams.get("txIds");
    if (errCode || errMsg) {
      console.warn(new Error(`Wallet raises:
code: ${errCode}
message: ${decodedErrMsg}`));
    }
    if (accId && pubKey) {
      if (pubKey === stateExports._state.publicKey) {
        stateExports.update({ accountId: accId });
      } else {
        if (authStatus() === "SignedIn") {
          console.warn("Public key mismatch from wallet redirect", pubKey, stateExports._state.publicKey);
        }
        url.searchParams.delete("public_key");
      }
    }
    if (txHashes || txIds) {
      const hashArr = txHashes ? txHashes.split(",") : [];
      const idArr = txIds ? txIds.split(",") : [];
      if (idArr.length > hashArr.length) {
        idArr.forEach((id) => {
          stateExports.updateTxHistory({ txId: id, status: "RejectedByUser", finalState: true });
        });
      } else if (idArr.length === hashArr.length) {
        idArr.forEach((id, i) => {
          stateExports.updateTxHistory({
            txId: id,
            status: "PendingGotTxHash",
            txHash: hashArr[i],
            finalState: false
          });
          afterTxSent(id);
        });
      } else {
        console.error(new Error("Transaction hash mismatch from wallet redirect"), idArr, hashArr);
      }
    }
    url.searchParams.delete("txIds");
    if (authStatus() === "SignedOut") {
      url.searchParams.delete("errorCode");
      url.searchParams.delete("errorMessage");
    }
  }
} catch (e) {
  console.error("Error handling wallet redirect:", e);
}
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
        const decoded = reExportAllUtils.fromBase64(argsBase64);
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
        // Default gas
        deposit: deposit || "0"
        // Default deposit
      }
    };
  }, "functionCall"),
  transfer: /* @__PURE__ */ __name((yoctoAmount) => ({
    type: "Transfer",
    params: {
      deposit: yoctoAmount
    }
  }), "transfer"),
  stake: /* @__PURE__ */ __name(({ amount, publicKey: publicKey2 }) => ({
    type: "Stake",
    params: {
      stake: amount,
      publicKey: publicKey2
    }
  }), "stake"),
  addFullAccessKey: /* @__PURE__ */ __name(({ publicKey: publicKey2 }) => ({
    type: "AddKey",
    params: {
      publicKey: publicKey2,
      accessKey: { permission: "FullAccess" }
    }
  }), "addFullAccessKey"),
  addLimitedAccessKey: /* @__PURE__ */ __name(({
    publicKey: publicKey2,
    allowance,
    accountId: accountId2,
    methodNames
  }) => ({
    type: "AddKey",
    params: {
      publicKey: publicKey2,
      accessKey: {
        permission: {
          receiverId: accountId2,
          allowance,
          methodNames
        }
      }
    }
  }), "addLimitedAccessKey"),
  deleteKey: /* @__PURE__ */ __name(({ publicKey: publicKey2 }) => ({
    type: "DeleteKey",
    params: {
      publicKey: publicKey2
    }
  }), "deleteKey"),
  deleteAccount: /* @__PURE__ */ __name(({ beneficiaryId }) => ({
    type: "DeleteAccount",
    params: {
      beneficiaryId
    }
  }), "deleteAccount"),
  useGlobalContract: /* @__PURE__ */ __name(({ contractIdentifier }) => ({
    type: "UseGlobalContract",
    params: {
      contractIdentifier
    }
  }), "useGlobalContract"),
  deployGlobalContract: /* @__PURE__ */ __name(({ code, deployMode }) => ({
    type: "DeployGlobalContract",
    params: {
      code,
      deployMode
    }
  }), "deployGlobalContract"),
  createAccount: /* @__PURE__ */ __name(() => ({
    type: "CreateAccount"
  }), "createAccount"),
  deployContract: /* @__PURE__ */ __name(({ codeBase64 }) => {
    const codeBytes = reExportAllUtils.fromBase64(codeBase64);
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

exports.MaxBlockDelayMs = MaxBlockDelayMs;
exports.accountId = accountId;
exports.actions = actions;
exports.afterTxSent = afterTxSent;
exports.authStatus = authStatus;
exports.config = config;
exports.event = event;
exports.exp = exp;
exports.generateTxId = generateTxId;
exports.getPublicKeyForContract = getPublicKeyForContract;
exports.localTxHistory = localTxHistory;
exports.publicKey = publicKey;
exports.queryAccessKey = queryAccessKey;
exports.queryAccount = queryAccount;
exports.queryBlock = queryBlock;
exports.queryTx = queryTx;
exports.requestSignIn = requestSignIn;
exports.selected = selected;
exports.sendRpc = sendRpc;
exports.sendTx = sendTx;
exports.sendTxToRpc = sendTxToRpc;
exports.signMessage = signMessage;
exports.signOut = signOut;
exports.state = state;
exports.utils = utils;
exports.view = view;
exports.withBlockId = withBlockId;
//# sourceMappingURL=near.cjs.map
//# sourceMappingURL=near.cjs.map