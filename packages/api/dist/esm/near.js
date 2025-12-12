import * as reExportAllUtils from '@fastnear/utils';
import { tryParseJson, fromBase64, lsSet, lsGet, privateKeyFromRandom, toBase64, parseJsonFromBytes, canSignWithLAK, serializeTransaction, toBase58, signHash, serializeSignedTransaction, bytesToBase64 } from '@fastnear/utils';
import Big from 'big.js';
import * as stateExports from './state.js';
import { _state, update, updateTxHistory, getTxHistory, getConfig, _adapter, setConfig, NETWORKS, resetTxHistory } from './state.js';
import { sha256 } from '@noble/hashes/sha2';

/* ⋈ 🏃🏻💨 FastNEAR API - ESM (fastintear version 0.2.4) */
/* https://www.npmjs.com/package/fastintear/v/0.2.4 */
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
Big.DP = 27;
const MaxBlockDelayMs = 1e3 * 60 * 60 * 6;
function withBlockId(params, blockId) {
  if (blockId === "final" || blockId === "optimistic") {
    return { ...params, finality: blockId };
  }
  return blockId ? { ...params, block_id: blockId } : { ...params, finality: "optimistic" };
}
__name(withBlockId, "withBlockId");
async function sendRpc(method, params) {
  const config2 = getConfig();
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
  const txHistory = getTxHistory();
  sendRpc("tx", {
    tx_hash: txHistory[txId]?.txHash,
    sender_account_id: txHistory[txId]?.tx?.signerId,
    wait_until: "EXECUTED_OPTIMISTIC"
  }).then((result) => {
    const successValue = result?.result?.status?.SuccessValue;
    updateTxHistory({
      txId,
      status: "Executed",
      result,
      successValue: successValue ? tryParseJson(fromBase64(successValue)) : void 0,
      finalState: true
    });
  }).catch((error) => {
    updateTxHistory({
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
    updateTxHistory({ txId, status: "Included", finalState: false });
    afterTxSent(txId);
    return sendTxRes;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    updateTxHistory({
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
let lastAccountCheckTime = 0;
const ACCOUNT_CHECK_INTERVAL = 6e4;
const accountId = /* @__PURE__ */ __name(() => {
  const currentTime = Date.now();
  if (_state.accountId && currentTime - lastAccountCheckTime > ACCOUNT_CHECK_INTERVAL) {
    lastAccountCheckTime = currentTime;
    _adapter.getAccounts().then((accounts) => {
      if (accounts.length === 0 && _state.accountId) {
        update({ accountId: null, privateKey: null, lastWalletId: null });
      }
    }).catch((e) => {
      console.error("Error checking account status:", e);
    });
  }
  return _state.accountId;
}, "accountId");
const publicKey = /* @__PURE__ */ __name(() => _state.publicKey, "publicKey");
const config = /* @__PURE__ */ __name((newConfig) => {
  const current = getConfig();
  if (newConfig) {
    if (newConfig.networkId && current.networkId !== newConfig.networkId) {
      setConfig({ ...NETWORKS[newConfig.networkId], networkId: newConfig.networkId });
      update({ accountId: null, privateKey: null, lastWalletId: null });
      lsSet("block", null);
      resetTxHistory();
    }
    setConfig({ ...getConfig(), ...newConfig });
  }
  return getConfig();
}, "config");
const authStatus = /* @__PURE__ */ __name(() => {
  if (!_state.accountId) {
    return "SignedOut";
  }
  return "SignedIn";
}, "authStatus");
const getPublicKeyForContract = /* @__PURE__ */ __name((opts) => {
  return publicKey();
}, "getPublicKeyForContract");
const selected = /* @__PURE__ */ __name(() => {
  const config2 = getConfig();
  const network = config2.networkId;
  const nodeUrl = config2.nodeUrl;
  const walletUrl = config2.walletUrl;
  const helperUrl = config2.helperUrl;
  const explorerUrl = config2.explorerUrl;
  const account = accountId();
  const contract = _state.accessKeyContractId;
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
  const networkId = getConfig().networkId;
  const previousAccountId = lsGet("lastSignedInAccount");
  const isReconnection = !!previousAccountId && previousAccountId !== _state.accountId;
  const privateKey = privateKeyFromRandom();
  update({ accessKeyContractId: contractId, privateKey });
  try {
    const result = await _adapter.signIn({
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
      lsSet("lastSignedInAccount", result.accountId);
      update({
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
      update({ accountId: null, privateKey: null, publicKey: null, accessKeyContractId: null });
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
  return getTxHistory();
}, "localTxHistory");
const signOut = /* @__PURE__ */ __name(async () => {
  await _adapter.signOut();
  update({ accountId: null, privateKey: null, accessKeyContractId: null, lastWalletId: null });
}, "signOut");
const signMessage = /* @__PURE__ */ __name(async ({
  message,
  recipient,
  nonce,
  callbackUrl,
  state: state2
}) => {
  const signerId = _state.accountId;
  if (!signerId) throw new Error("Must sign in");
  const messageNonce = nonce || crypto.getRandomValues(new Uint8Array(32));
  try {
    const result = await _adapter.signMessage({
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
  const signerId = _state.accountId;
  if (!signerId) throw new Error("Must sign in");
  const publicKey2 = _state.publicKey ?? "";
  const privKey = _state.privateKey;
  const txId = generateTxId();
  if (!privKey || receiverId !== _state.accessKeyContractId || !canSignWithLAK(actions2) || hasNonZeroDeposit(actions2)) {
    const jsonTx = { signerId, receiverId, actions: actions2 };
    updateTxHistory({ status: "Pending", txId, tx: jsonTx, finalState: false });
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
      const result = await _adapter.sendTransactions({
        transactions: [jsonTx]
      });
      if (result.outcomes?.length) {
        result.outcomes.forEach((r) => {
          const transactionEntry = r.get("transaction");
          updateTxHistory({
            txId,
            status: "Executed",
            result: r,
            txHash: transactionEntry?.hash,
            finalState: true
          });
        });
      } else if (result.rejected) {
        updateTxHistory({ txId, status: "RejectedByUser", finalState: true });
      } else if (result.error) {
        updateTxHistory({
          txId,
          status: "Error",
          error: tryParseJson(result.error),
          finalState: true
        });
      }
      return result;
    } catch (err) {
      console.error("fastnear: error sending tx using adapter:", err);
      updateTxHistory({
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
    const accessKey = await queryAccessKey({ accountId: signerId, publicKey: publicKey2 });
    if (accessKey.result.error) {
      throw new Error(`Access key error: ${accessKey.result.error} when attempting to get nonce for ${signerId} for public key ${publicKey2}`);
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
    publicKey: publicKey2,
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
  updateTxHistory({
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
  borsh: reExportAllUtils.exp.borsh,
  borshSchema: reExportAllUtils.exp.borshSchema.getBorshSchema()
};
for (const key in reExportAllUtils) {
  exp.utils[key] = reExportAllUtils[key];
}
const utils = exp.utils;
const state = {};
for (const key in stateExports) {
  state[key] = stateExports[key];
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
      if (pubKey === _state.publicKey) {
        update({ accountId: accId });
      } else {
        if (authStatus() === "SignedIn") {
          console.warn("Public key mismatch from wallet redirect", pubKey, _state.publicKey);
        }
        url.searchParams.delete("public_key");
      }
    }
    if (txHashes || txIds) {
      const hashArr = txHashes ? txHashes.split(",") : [];
      const idArr = txIds ? txIds.split(",") : [];
      if (idArr.length > hashArr.length) {
        idArr.forEach((id) => {
          updateTxHistory({ txId: id, status: "RejectedByUser", finalState: true });
        });
      } else if (idArr.length === hashArr.length) {
        idArr.forEach((id, i) => {
          updateTxHistory({
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

export { MaxBlockDelayMs, accountId, actions, afterTxSent, authStatus, config, event, exp, generateTxId, getPublicKeyForContract, localTxHistory, publicKey, queryAccessKey, queryAccount, queryBlock, queryTx, requestSignIn, selected, sendRpc, sendTx, sendTxToRpc, signMessage, signOut, state, utils, view, withBlockId };
//# sourceMappingURL=near.js.map
//# sourceMappingURL=near.js.map