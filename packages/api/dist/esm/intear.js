import { publicKeyFromPrivate, signHash, fromBase58, privateKeyFromRandom } from '@fastnear/utils';
import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha2';
import { signOut } from './near';

/* ⋈ 🏃🏻💨 FastNEAR API - ESM (fastintear version 0.2.4) */
/* https://www.npmjs.com/package/fastintear/v/0.2.4 */
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
const DEFAULT_WALLET_DOMAIN = "https://wallet.intear.tech";
const DEFAULT_LOGOUT_BRIDGE_SERVICE = "https://logout-bridge-service.intear.tech";
const STORAGE_KEY = "_intear_wallet_connected_account";
const POPUP_FEATURES = "width=400,height=700";
let hasCheckedLogout = false;
let checkingAccountPromise = null;
let sessionVerificationInProgress = false;
class IntearAdapterError extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "IntearAdapterError";
    if (cause) {
      this.stack += `
Caused by: ${cause instanceof Error ? cause.stack : String(cause)}`;
    }
  }
  static {
    __name(this, "IntearAdapterError");
  }
}
class LogoutWebSocket {
  static {
    __name(this, "LogoutWebSocket");
  }
  static instance = null;
  ws = null;
  network;
  accountId;
  appPrivateKey;
  userLogoutPublicKey;
  logoutBridgeServiceUrl;
  intentionallyClosed = false;
  reconnectAttempts = 0;
  maxReconnectAttempts = 3;
  logger;
  constructor(network, accountId, appPrivateKey, userLogoutPublicKey, logoutBridgeServiceUrl, logger) {
    this.network = network;
    this.accountId = accountId;
    this.appPrivateKey = appPrivateKey;
    this.userLogoutPublicKey = userLogoutPublicKey;
    this.logoutBridgeServiceUrl = logoutBridgeServiceUrl;
    this.logger = logger;
    this.connect();
  }
  async connect() {
    try {
      const wsUrl = this.logoutBridgeServiceUrl.replace("https://", "wss://").replace("http://", "ws://");
      this.ws = new WebSocket(`${wsUrl}/api/subscribe`);
      this.ws.onopen = async () => {
        if (!this.ws) {
          return;
        }
        const nonce = Date.now();
        const messageText = `subscribe|${nonce}`;
        const messageBytes = new TextEncoder().encode(messageText);
        const appPublicKeyString = publicKeyFromPrivate(this.appPrivateKey);
        const signatureBase58 = signHash(messageBytes, this.appPrivateKey, { returnBase58: true });
        const signatureString = `ed25519:${signatureBase58}`;
        const authMessage = {
          Auth: {
            network: this.network,
            account_id: this.accountId,
            app_public_key: appPublicKeyString,
            nonce,
            signature: signatureString
          }
        };
        this.ws.send(JSON.stringify(authMessage));
      };
      this.ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        if ("Success" in message) {
          this.logger.log("LogoutWebSocket:", message.Success.message);
          this.reconnectAttempts = 0;
        } else if ("Error" in message) {
          this.logger.error("LogoutWebSocket error:", message.Error.message);
          this.ws?.close();
        } else if ("LoggedOut" in message) {
          const { logout_info: logoutInfo } = message.LoggedOut;
          this.logger.log("LogoutWebSocket: Received logout notification:", logoutInfo);
          if (logoutInfo.nonce > Date.now() || logoutInfo.nonce < Date.now() - 1e3 * 60 * 5) {
            this.logger.error("LogoutWebSocket: Invalid logout nonce:", logoutInfo.nonce);
            return;
          }
          const appPublicKeyString = publicKeyFromPrivate(this.appPrivateKey);
          const verifyMessageText = `logout|${logoutInfo.nonce}|${this.accountId}|${appPublicKeyString}`;
          const verifyMessageBytes = new TextEncoder().encode(verifyMessageText);
          const sigParts = logoutInfo.signature.split(":");
          if (sigParts.length !== 2 || sigParts[0] !== "ed25519" && sigParts[0] !== "secp256k1") {
            this.logger.error("LogoutWebSocket: Invalid signature format:", logoutInfo.signature);
            return;
          }
          const sigData = sigParts[1];
          const signatureBytes = fromBase58(sigData);
          let effectiveVerifyKey;
          if (logoutInfo.caused_by === "User") {
            effectiveVerifyKey = this.userLogoutPublicKey;
          } else if (logoutInfo.caused_by === "App") {
            effectiveVerifyKey = appPublicKeyString;
          } else {
            this.logger.error("LogoutWebSocket: Unknown logout cause:", logoutInfo.caused_by);
            return;
          }
          let publicKeyBytes;
          const base58PublicKey = effectiveVerifyKey.substring("ed25519:".length);
          publicKeyBytes = fromBase58(base58PublicKey);
          const isValid = ed25519.verify(signatureBytes, verifyMessageBytes, publicKeyBytes);
          if (!isValid) {
            this.logger.error("LogoutWebSocket: Invalid logout signature");
            return;
          }
          this.logger.log(
            "LogoutWebSocket: Valid logout message received. Calling signOut and reloading."
          );
          signOut();
          this.intentionallyClosed = true;
          this.close();
          window.location.reload();
        }
      };
      this.ws.onclose = () => {
        this.logger.log("LogoutWebSocket: Connection closed.");
        if (this.intentionallyClosed) {
          if (LogoutWebSocket.instance === this) {
            LogoutWebSocket.instance = null;
          }
        } else if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          this.logger.log(`LogoutWebSocket: Attempting to reconnect in 500ms... (Attempt ${this.reconnectAttempts} of ${this.maxReconnectAttempts})`);
          setTimeout(() => this.connect(), 500);
        } else {
          this.logger.warn(`LogoutWebSocket: Maximum reconnection attempts (${this.maxReconnectAttempts}) reached. Giving up.`);
          if (LogoutWebSocket.instance === this) {
            LogoutWebSocket.instance = null;
          }
        }
      };
      this.ws.onerror = (error) => {
        this.logger.warn("LogoutWebSocket: Error:", error);
        if (!this.intentionallyClosed) {
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            this.logger.log(`LogoutWebSocket: Attempting to reconnect in 500ms... (Attempt ${this.reconnectAttempts} of ${this.maxReconnectAttempts})`);
            setTimeout(() => this.connect(), 500);
          } else {
            this.logger.warn(`LogoutWebSocket: Maximum reconnection attempts (${this.maxReconnectAttempts}) reached. Giving up.`);
            if (LogoutWebSocket.instance === this) {
              LogoutWebSocket.instance = null;
            }
          }
        } else {
          LogoutWebSocket.instance = null;
        }
      };
    } catch (error) {
      this.logger.warn("LogoutWebSocket: Error creating WebSocket connection:", error);
    }
  }
  static initialize(network, accountId, appPrivateKey, userLogoutPublicKey, logoutBridgeServiceUrl, logger) {
    try {
      if (LogoutWebSocket.instance) {
        return LogoutWebSocket.instance;
      }
      LogoutWebSocket.instance = new LogoutWebSocket(
        network,
        accountId,
        appPrivateKey,
        userLogoutPublicKey,
        logoutBridgeServiceUrl,
        logger
      );
      return LogoutWebSocket.instance;
    } catch (error) {
      logger.warn("LogoutWebSocket: Failed to initialize:", error);
      return null;
    }
  }
  static getInstance() {
    return LogoutWebSocket.instance;
  }
  close() {
    if (this.ws) {
      this.intentionallyClosed = true;
      this.ws.close();
    }
    LogoutWebSocket.instance = null;
  }
}
async function generateAuthSignature(privateKey, data, nonce) {
  const messageToSign = nonce.toString() + "|" + data;
  const messageBytes = new TextEncoder().encode(messageToSign);
  const hashBytes = sha256(messageBytes);
  const signatureBase58 = signHash(hashBytes, privateKey, { returnBase58: true });
  return `ed25519:${signatureBase58}`;
}
__name(generateAuthSignature, "generateAuthSignature");
function assertLoggedIn() {
  if (typeof window === "undefined") {
    throw new IntearAdapterError("Cannot access localStorage in this environment.");
  }
  const savedDataStr = window.localStorage.getItem(STORAGE_KEY);
  if (!savedDataStr) {
    throw new IntearAdapterError("Not signed in (no data found)");
  }
  try {
    const savedData = JSON.parse(savedDataStr);
    if (!savedData || !savedData.accounts || savedData.accounts.length === 0 || !savedData.key) {
      throw new Error("Invalid saved data structure");
    }
    return savedData;
  } catch (e) {
    console.error("Error parsing saved login data, clearing storage.", e);
    window.localStorage.removeItem(STORAGE_KEY);
    throw new IntearAdapterError("Failed to parse login data, please sign in again.", e);
  }
}
__name(assertLoggedIn, "assertLoggedIn");
function getSavedData() {
  try {
    return assertLoggedIn();
  } catch {
    return null;
  }
}
__name(getSavedData, "getSavedData");
function verifyLogoutSignature(logoutInfo, accountId, appPublicKeyString, userLogoutPublicKey) {
  try {
    const logoutMessageToVerify = `logout|${logoutInfo.nonce}|${accountId}|${appPublicKeyString}`;
    const sigParts = logoutInfo.signature.split(":");
    if (sigParts.length !== 2 || sigParts[0] !== "ed25519" && sigParts[0] !== "secp256k1") {
      console.error("WalletAdapter: Invalid signature format:", logoutInfo.signature);
      return false;
    }
    const sigData = sigParts[1];
    const signatureToVerify = fromBase58(sigData);
    let verifyKey;
    if (logoutInfo.caused_by === "User") {
      verifyKey = userLogoutPublicKey;
    } else if (logoutInfo.caused_by === "App") {
      verifyKey = appPublicKeyString;
    } else {
      console.error("WalletAdapter: Unknown logout cause:", logoutInfo.caused_by);
      return false;
    }
    const base58PublicKey = verifyKey.substring("ed25519:".length);
    const publicKeyBytes = fromBase58(base58PublicKey);
    return ed25519.verify(
      signatureToVerify,
      new TextEncoder().encode(logoutMessageToVerify),
      publicKeyBytes
    );
  } catch (error) {
    console.error("WalletAdapter: Error verifying logout signature:", error);
    return false;
  }
}
__name(verifyLogoutSignature, "verifyLogoutSignature");
async function verifySessionStatus(savedData, logoutBridgeService, onStateUpdate) {
  try {
    const account = savedData.accounts[0];
    const networkId = savedData.networkId;
    const appPrivateKey = savedData.key;
    const appPublicKeyString = publicKeyFromPrivate(appPrivateKey);
    LogoutWebSocket.initialize(
      networkId,
      account.accountId,
      appPrivateKey,
      savedData.logoutKey,
      logoutBridgeService,
      console
    );
    const nonce = Date.now();
    const checkMessage = `check|${nonce}`;
    const messageBytes = new TextEncoder().encode(checkMessage);
    const signatureBase58 = signHash(messageBytes, appPrivateKey, { returnBase58: true });
    const signatureString = `ed25519:${signatureBase58}`;
    const response = await fetch(
      `${logoutBridgeService}/api/check_logout/${networkId}/${account.accountId}/${appPublicKeyString}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ nonce, signature: signatureString })
      }
    );
    if (!response.ok) {
      console.warn("WalletAdapter: Failed to check logout status:", await response.text());
      return { isActive: true, accounts: savedData.accounts };
    }
    const status = await response.json();
    console.debug("WalletAdapter: Logout check response:", status);
    if (status === "Active") {
      return { isActive: true, accounts: savedData.accounts };
    } else {
      const logoutInfo = status.LoggedOut;
      console.debug("WalletAdapter: User was logged out:", logoutInfo);
      const isValid = verifyLogoutSignature(
        logoutInfo,
        account.accountId,
        appPublicKeyString,
        savedData.logoutKey
      );
      if (!isValid) {
        console.error("WalletAdapter: Invalid logout signature");
        return { isActive: true, accounts: savedData.accounts };
      }
      console.debug("WalletAdapter: Valid remote logout. Clearing local session.");
      window.localStorage.removeItem(STORAGE_KEY);
      LogoutWebSocket.getInstance()?.close();
      onStateUpdate?.({ accountId: null, networkId: null, publicKey: null });
      return { isActive: false, accounts: [] };
    }
  } catch (error) {
    console.error("WalletAdapter: Error verifying session status:", error);
    return { isActive: true, accounts: savedData.accounts };
  }
}
__name(verifySessionStatus, "verifySessionStatus");
class WalletAdapter {
  static {
    __name(this, "WalletAdapter");
  }
  #iframeOriginUrl;
  #logoutBridgeService;
  #onStateUpdate;
  constructor({
    walletUrl: iframeOriginUrl = DEFAULT_WALLET_DOMAIN,
    targetOrigin,
    onStateUpdate,
    lastState,
    callbackUrl,
    logoutBridgeService = DEFAULT_LOGOUT_BRIDGE_SERVICE
  }) {
    this.#iframeOriginUrl = iframeOriginUrl;
    this.#logoutBridgeService = logoutBridgeService;
    this.#onStateUpdate = onStateUpdate;
    console.debug("Intear Popup WalletAdapter initialized. URL:", this.#iframeOriginUrl);
    if (typeof window !== "undefined") {
      this.initializeSession().catch((err) => {
        console.error("Error during initial session initialization:", err);
      });
    }
  }
  async signIn({
    contractId,
    methodNames,
    networkId,
    callbacks
  }) {
    console.debug("WalletAdapter: signIn", { contractId, methodNames, networkId });
    const { onPending, onError, timeout = 6e4 } = callbacks || {};
    const privateKey = privateKeyFromRandom();
    return new Promise((resolve, reject) => {
      onPending?.({ step: "popup_opening", networkId, contractId });
      const hotConnectorOrigin = new Promise((resolve2) => {
        let origin = null;
        const interval = setInterval(() => {
          if (origin) {
            clearInterval(interval);
            resolve2(origin);
          }
        }, 100);
        const listener2 = /* @__PURE__ */ __name((event) => {
          if (event.data.origin) {
            origin = event.data.origin;
            window.removeEventListener("message", listener2);
          }
        }, "listener");
        window.addEventListener("message", listener2);
      });
      const iframe = document.createElement("iframe");
      iframe.src = `${this.#iframeOriginUrl}/hot-wallet-connector-iframe.html`;
      iframe.style.position = "fixed";
      iframe.style.inset = "0";
      iframe.style.width = "100vw";
      iframe.style.height = "100vh";
      iframe.style.border = "none";
      iframe.style.zIndex = "100000";
      document.body.appendChild(iframe);
      iframe.onload = () => {
        hotConnectorOrigin.then((origin) => {
          iframe.contentWindow?.postMessage(
            {
              type: "hotConnectorData",
              origin,
              // @ts-ignore
              location: window.selector.location
            },
            "*"
          );
        });
      };
      let result = null;
      const listener = /* @__PURE__ */ __name(async (event) => {
        if (event.data.status) {
          iframe.contentWindow?.postMessage(
            event.data,
            "*"
          );
          return;
        }
        console.debug("Message from connect popup", event.data);
        switch (event.data.type) {
          case "ready": {
            const origin = location.origin || "file://local-html-file";
            const message = JSON.stringify({ origin });
            const nonce = Date.now();
            const signatureString = await generateAuthSignature(privateKey, message, nonce);
            const publicKey = publicKeyFromPrivate(privateKey);
            iframe.contentWindow?.postMessage(
              {
                type: "signIn",
                data: {
                  contractId,
                  methodNames,
                  publicKey,
                  networkId,
                  nonce,
                  message,
                  signature: signatureString,
                  version: "V2"
                }
              },
              "*"
            );
            break;
          }
          case "connected": {
            onPending?.({ step: "processing_result", networkId, contractId });
            const accounts = event.data.accounts;
            if (!accounts || accounts.length === 0) {
              const error = {
                type: "wallet_error",
                message: "No accounts returned from wallet",
                retryable: true,
                suggestedAction: "retry",
                timestamp: Date.now()
              };
              onError?.(error);
              return reject(new IntearAdapterError("No accounts returned from wallet"));
            }
            const functionCallKeyAdded = event.data.functionCallKeyAdded;
            const logoutKey = event.data.logoutKey;
            const useBridge = event.data.useBridge;
            const dataToSave = {
              accounts,
              key: privateKey,
              contractId: functionCallKeyAdded && contractId ? contractId : "",
              methodNames: functionCallKeyAdded ? methodNames ?? [] : [],
              logoutKey,
              networkId,
              walletUrl: event.data.walletUrl,
              useBridge
            };
            console.log("dataToSave", dataToSave, "event.data", event.data);
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
            result = {
              accountId: accounts[0].accountId,
              accounts,
              privateKey: dataToSave.key,
              publicKey: publicKeyFromPrivate(dataToSave.key)
            };
            iframe.contentWindow?.postMessage(
              {
                type: "close"
              },
              "*"
            );
            const newState = {
              accountId: accounts[0].accountId,
              networkId,
              privateKey: dataToSave.key,
              publicKey: publicKeyFromPrivate(dataToSave.key)
            };
            this.#onStateUpdate?.(newState);
            LogoutWebSocket.getInstance()?.close();
            LogoutWebSocket.initialize(
              dataToSave.networkId,
              dataToSave.accounts[0].accountId,
              dataToSave.key,
              // App's LAK private key (this is the appPrivateKey for WS)
              dataToSave.logoutKey,
              // User's main logout public key from wallet
              this.#logoutBridgeService,
              console
            );
            break;
          }
          case "error": {
            console.error("Error from connect popup", event.data.message);
            iframe.contentWindow?.postMessage(
              {
                type: "close",
                message: event.data.message
              },
              this.#iframeOriginUrl
            );
            break;
          }
          case "close": {
            window.removeEventListener("message", listener);
            iframe.remove();
            if (event.data.message) {
              const errorMessage = event.data.message || "Unknown error from wallet popup";
              const error = {
                type: "wallet_error",
                message: errorMessage,
                retryable: true,
                suggestedAction: "contact_support",
                originalError: event.data,
                timestamp: Date.now()
              };
              onError?.(error);
              reject(new IntearAdapterError(errorMessage));
              break;
            } else if (result) {
              resolve(result);
            } else {
              console.error("No result and no error");
              reject(new IntearAdapterError("No result and no error"));
            }
          }
        }
      }, "listener");
      window.addEventListener("message", listener);
      onPending?.({ step: "waiting_for_user", networkId, contractId });
    });
  }
  async signOut() {
    console.debug("WalletAdapter: signOut");
    const savedData = getSavedData();
    LogoutWebSocket.getInstance()?.close();
    if (savedData) {
      try {
        const accountId = savedData.accounts[0].accountId;
        const appPrivateKey = savedData.key;
        const appPublicKeyString = publicKeyFromPrivate(appPrivateKey);
        const networkId = savedData.networkId;
        const nonce = Date.now();
        const messageText = `logout|${nonce}|${accountId}|${appPublicKeyString}`;
        const messageBytes = new TextEncoder().encode(messageText);
        const hashBytes = sha256(messageBytes);
        const signatureBase58 = signHash(hashBytes, appPrivateKey, { returnBase58: true });
        const signatureString = `ed25519:${signatureBase58}`;
        const response = await fetch(`${this.#logoutBridgeService}/api/logout_app/${networkId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account_id: accountId,
            app_public_key: appPublicKeyString,
            nonce,
            signature: signatureString
          })
        });
        if (!response.ok) {
          console.error("WalletAdapter: Failed to notify bridge service of logout:", await response.text());
        } else {
          console.debug("WalletAdapter: Successfully notified bridge service of logout");
        }
      } catch (e) {
        console.error("WalletAdapter: Error during bridge service logout notification:", e);
      }
    }
    window.localStorage.removeItem(STORAGE_KEY);
    this.#onStateUpdate?.({ accountId: null, networkId: null, publicKey: null });
  }
  // Initialize the session by checking if the user is logged in and setting up WebSocket connection
  async initializeSession() {
    if (sessionVerificationInProgress) {
      return;
    }
    sessionVerificationInProgress = true;
    try {
      const savedData = getSavedData();
      if (!savedData) {
        LogoutWebSocket.getInstance()?.close();
        return;
      }
      await verifySessionStatus(savedData, this.#logoutBridgeService, this.#onStateUpdate);
    } catch (e) {
      console.error("WalletAdapter: Unexpected error during session initialization:", e);
      LogoutWebSocket.getInstance()?.close();
    } finally {
      sessionVerificationInProgress = false;
    }
  }
  getState() {
    const savedData = getSavedData();
    if (savedData) {
      return {
        accountId: savedData.accounts[0].accountId,
        networkId: savedData.networkId,
        publicKey: publicKeyFromPrivate(savedData.key)
      };
    }
    return { accountId: null, networkId: null, publicKey: null };
  }
  setState(state) {
    this.#onStateUpdate?.(state);
  }
  async getAccounts() {
    console.debug("WalletAdapter: getAccounts");
    const savedData = getSavedData();
    if (!savedData) {
      return [];
    }
    if (!hasCheckedLogout) {
      if (checkingAccountPromise) {
        return await checkingAccountPromise;
      }
      checkingAccountPromise = new Promise(async (resolve) => {
        try {
          const result = await verifySessionStatus(savedData, this.#logoutBridgeService, this.#onStateUpdate);
          resolve(result.accounts);
        } catch (error) {
          console.error("WalletAdapter: Error in getAccounts:", error);
          resolve(savedData.accounts);
        }
      }).finally(() => {
        checkingAccountPromise = null;
        hasCheckedLogout = true;
      });
      return await checkingAccountPromise;
    }
    console.debug("WalletAdapter: Accounts:", savedData.accounts);
    return savedData.accounts;
  }
  async sendTransactions({ transactions }) {
    console.debug("WalletAdapter: sendTransactions", { transactions });
    const savedData = assertLoggedIn();
    const privateKey = savedData.key;
    const accountId = savedData.accounts[0].accountId;
    if (savedData.useBridge) {
      return new Promise((resolve, reject) => {
        const wsUrl = this.#logoutBridgeService.replace("https://", "wss://").replace("http://", "ws://");
        const ws = new WebSocket(`${wsUrl}/api/session/create`);
        ws.onopen = async () => {
          console.debug("WebSocket connected for transactions");
          const transactionsString = JSON.stringify(transactions);
          const authNonce = Date.now();
          const signatureString = await generateAuthSignature(
            savedData.key,
            transactionsString,
            authNonce
          );
          ws.send(
            JSON.stringify({
              type: "signAndSendTransactions",
              data: {
                transactions: transactionsString,
                accountId: savedData.accounts[0].accountId,
                publicKey: publicKeyFromPrivate(savedData.key),
                nonce: authNonce,
                signature: signatureString
              }
            })
          );
        };
        let currentSessionId = null;
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.session_id) {
              currentSessionId = data.session_id;
              console.debug(
                "Received session ID for send-transactions:",
                currentSessionId
              );
            } else {
              console.debug("Received send-transactions response:", data);
              ws.close();
              if (data.type === "error") {
                const errorMessage = data.message || "Unknown error from wallet popup";
                reject(new IntearAdapterError(errorMessage));
              } else {
                resolve({ outcomes: data.outcomes });
              }
            }
          } catch (e) {
            console.error("Error parsing WebSocket message:", e);
            reject(new IntearAdapterError("Error parsing WebSocket message", e));
          }
        };
        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          reject(new IntearAdapterError("WebSocket error", error));
        };
        ws.onclose = () => {
          console.debug("WebSocket closed for send-transactions");
        };
        (async () => {
          const sessionId = await new Promise((resolveSessionId) => {
            setInterval(() => {
              if (currentSessionId) {
                resolveSessionId(currentSessionId);
              }
            }, 100);
          });
          const walletAppUrl = `intear://send-transactions?session_id=${sessionId}`;
          console.debug("Opening wallet with URL:", walletAppUrl);
          window.selector.openNativeApp(walletAppUrl);
        })();
      });
    }
    return new Promise(async (resolve, reject) => {
      const popup = window.open(`${savedData.walletUrl ?? this.#iframeOriginUrl}/send-transactions`, "_blank", POPUP_FEATURES);
      if (!popup) {
        return reject(new IntearAdapterError("Popup was blocked"));
      }
      let done = false;
      const listener = /* @__PURE__ */ __name(async (event) => {
        if (!event.data || !event.data.type) return;
        console.debug("Message from send-transactions popup", event.data);
        switch (event.data.type) {
          case "ready": {
            const transactionsString = JSON.stringify(transactions);
            const nonce = Date.now();
            const signatureString = await generateAuthSignature(privateKey, transactionsString, nonce);
            const publicKey = publicKeyFromPrivate(privateKey);
            popup.postMessage(
              {
                type: "signAndSendTransactions",
                data: {
                  transactions: transactionsString,
                  accountId,
                  publicKey,
                  nonce,
                  signature: signatureString
                }
              },
              savedData.walletUrl ?? this.#iframeOriginUrl
            );
            break;
          }
          case "sent": {
            done = true;
            popup.close();
            window.removeEventListener("message", listener);
            resolve({ outcomes: event.data.outcomes });
            break;
          }
          case "error": {
            done = true;
            popup.close();
            window.removeEventListener("message", listener);
            reject(new IntearAdapterError(event.data.message || "Unknown error from send-transactions popup"));
            break;
          }
        }
      }, "listener");
      window.addEventListener("message", listener);
      const checkPopupClosed = setInterval(() => {
        if (popup.closed) {
          window.removeEventListener("message", listener);
          clearInterval(checkPopupClosed);
          if (!done) {
            reject(new IntearAdapterError("Transaction canceled - popup closed by user"));
          }
        }
      }, 100);
    });
  }
  async signMessage({ message, nonce, recipient, callbackUrl, state }) {
    console.debug("WalletAdapter: signMessage", { message, nonce, recipient });
    const savedData = assertLoggedIn();
    const privateKey = savedData.key;
    const accountId = savedData.accounts[0].accountId;
    if (savedData.useBridge) {
      return new Promise((resolve, reject) => {
        const wsUrl = this.#logoutBridgeService.replace("https://", "wss://").replace("http://", "ws://");
        const ws = new WebSocket(`${wsUrl}/api/session/create`);
        ws.onopen = async () => {
          console.debug("WebSocket connected for sign-message");
          const signMessageString = JSON.stringify({
            message,
            recipient,
            nonce: Array.from(nonce),
            callbackUrl,
            state
          });
          const authNonce = Date.now();
          const signatureString = await generateAuthSignature(
            privateKey,
            signMessageString,
            authNonce
          );
          ws.send(
            JSON.stringify({
              type: "signMessage",
              data: {
                message: signMessageString,
                accountId: savedData.accounts[0].accountId,
                publicKey: publicKeyFromPrivate(privateKey),
                nonce: authNonce,
                signature: signatureString
              }
            })
          );
        };
        let currentSessionId = null;
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.session_id) {
              currentSessionId = data.session_id;
              console.debug(
                "Received session ID for sign-message:",
                currentSessionId
              );
            } else {
              console.debug("Received sign-message response:", data);
              ws.close();
              if (data.type === "error") {
                reject(new Error(data.message));
              } else {
                console.log(JSON.stringify(data));
                const signatureData = data.signature;
                try {
                  resolve({
                    accountId: signatureData.accountId,
                    publicKey: signatureData.publicKey,
                    signature: signatureData.signature
                  });
                } catch (e) {
                  reject(new IntearAdapterError("Failed to process signature from wallet", e));
                }
              }
            }
          } catch (e) {
            console.error("Error parsing WebSocket message:", e);
            reject(new IntearAdapterError("Error parsing WebSocket message", e));
          }
        };
        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          reject(new IntearAdapterError("WebSocket error", error));
        };
        ws.onclose = () => {
          console.debug("WebSocket closed for sign-message");
        };
        (async () => {
          const sessionId = await new Promise((resolveSessionId) => {
            setInterval(() => {
              if (currentSessionId) {
                resolveSessionId(currentSessionId);
              }
            }, 100);
          });
          const walletAppUrl = `intear://sign-message?session_id=${sessionId}`;
          console.debug("Opening wallet with URL:", walletAppUrl);
          window.selector.openNativeApp(walletAppUrl);
        })();
      });
    }
    return new Promise(async (resolve, reject) => {
      const popup = window.open(`${savedData.walletUrl ?? this.#iframeOriginUrl}/sign-message`, "_blank", POPUP_FEATURES);
      if (!popup) {
        return reject(new IntearAdapterError("Popup was blocked"));
      }
      let done = false;
      const listener = /* @__PURE__ */ __name(async (event) => {
        if (!event.data || !event.data.type) return;
        console.debug("Message from sign-message popup", event.data);
        switch (event.data.type) {
          case "ready": {
            const signMessageString = JSON.stringify({
              message,
              recipient,
              nonce: Array.from(nonce),
              callbackUrl,
              state
            });
            const authNonce = Date.now();
            const signatureString = await generateAuthSignature(privateKey, signMessageString, authNonce);
            const publicKey = publicKeyFromPrivate(privateKey);
            popup.postMessage(
              {
                type: "signMessage",
                data: {
                  message: signMessageString,
                  accountId,
                  publicKey,
                  nonce: authNonce,
                  signature: signatureString
                }
              },
              savedData.walletUrl ?? this.#iframeOriginUrl
            );
            break;
          }
          case "signed": {
            done = true;
            popup.close();
            window.removeEventListener("message", listener);
            const signatureData = event.data.signature;
            try {
              resolve({
                accountId: signatureData.accountId,
                publicKey: signatureData.publicKey,
                signature: signatureData.signature
              });
            } catch (e) {
              reject(new IntearAdapterError("Failed to process signature from wallet", e));
            }
            break;
          }
          case "error": {
            done = true;
            popup.close();
            window.removeEventListener("message", listener);
            reject(new IntearAdapterError(event.data.message || "Unknown error from sign-message popup"));
            break;
          }
        }
      }, "listener");
      window.addEventListener("message", listener);
      const checkPopupClosed = setInterval(() => {
        if (popup.closed) {
          window.removeEventListener("message", listener);
          clearInterval(checkPopupClosed);
          if (!done) {
            reject(new IntearAdapterError("Message signing canceled - popup closed by user"));
          }
        }
      }, 100);
    });
  }
  destroy() {
    console.debug("Intear Popup WalletAdapter destroyed.");
  }
}
var intear_default = WalletAdapter;

export { WalletAdapter, intear_default as default };
//# sourceMappingURL=intear.js.map
//# sourceMappingURL=intear.js.map