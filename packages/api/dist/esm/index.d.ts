import * as fastintear from 'fastintear';
import * as borsh from 'borsh';

interface NetworkConfig {
    networkId: string;
    nodeUrl?: string;
    walletUrl?: string;
    helperUrl?: string;
    explorerUrl?: string;
    [key: string]: any;
}
interface WalletState {
    accountId: string | null;
    publicKey: string | null;
    privateKey: string | null;
    networkId: string;
    lastWalletId?: string | null;
    accessKeyContractId?: string | null;
}
interface StateChangeCallbacks {
    onStateChange?: (newState: WalletState) => void;
    onConnect?: (accountData: {
        accountId: string;
        publicKey: string;
    }) => void;
    onDisconnect?: () => void;
}
interface ExternalStateManager {
    getState(): Promise<WalletState | null>;
    setState(state: WalletState): Promise<void>;
    clearState(): Promise<void>;
}
interface StateManager {
    getState(): Promise<WalletState | null>;
    setState(state: WalletState): Promise<void>;
    clearState(): Promise<void>;
    subscribe(callback: (state: WalletState) => void): () => void;
}
type TxStatusType = 'Pending' | 'Included' | 'Executed' | 'Error' | 'ErrorAfterIncluded' | 'RejectedByUser' | 'PendingGotTxHash';
interface TxStatus {
    txId: string;
    updateTimestamp?: number;
    status?: TxStatusType;
    tx?: any;
    txHash?: string;
    result?: any;
    error?: string | object;
    successValue?: any;
    finalState?: boolean;
    signature?: string;
    signedTxBase64?: string;
}
type TxHistory = Record<string, TxStatus>;

type SignInErrorType = 'user_cancelled' | 'wallet_error' | 'network_error' | 'unknown';
type SuggestedAction = 'retry' | 'contact_support';
type SignInError = {
    type: SignInErrorType;
    message: string;
    retryable: boolean;
    suggestedAction: SuggestedAction;
    originalError?: any;
    timestamp: number;
};
type MessageToSign = {
    message: string;
    nonce: Buffer;
    recipient: string;
    callbackUrl?: string;
    state?: string;
};

interface CreateAccountAction {
    type: "CreateAccount";
}
interface DeployContractAction {
    type: "DeployContract";
    params: {
        code: Uint8Array;
    };
}
interface FunctionCallAction {
    type: "FunctionCall";
    params: {
        methodName: string;
        args: object;
        gas: string;
        deposit: string;
    };
}
interface TransferAction {
    type: "Transfer";
    params: {
        deposit: string;
    };
}
interface StakeAction {
    type: "Stake";
    params: {
        stake: string;
        publicKey: string;
    };
}
type AddKeyPermission = "FullAccess" | {
    receiverId: string;
    allowance?: string;
    methodNames?: Array<string>;
};
interface AddKeyAction {
    type: "AddKey";
    params: {
        publicKey: string;
        accessKey: {
            nonce?: number;
            permission: AddKeyPermission;
        };
    };
}
interface DeleteKeyAction {
    type: "DeleteKey";
    params: {
        publicKey: string;
    };
}
interface DeleteAccountAction {
    type: "DeleteAccount";
    params: {
        beneficiaryId: string;
    };
}
interface SignedDelegateAction {
    type: "SignedDelegate";
    params: {
        delegateAction: Action;
        signature: string;
    };
}
type Action = CreateAccountAction | DeployContractAction | FunctionCallAction | TransferAction | StakeAction | AddKeyAction | DeleteKeyAction | DeleteAccountAction | SignedDelegateAction;
type ActionType = Action["type"];
interface Transaction {
    signerId: string;
    receiverId: string;
    actions: Array<Action>;
}

declare const MaxBlockDelayMs: number;
interface AccessKeyWithError {
    result: {
        nonce: number;
        permission?: any;
        error?: string;
    };
}
interface WalletTxResult {
    url?: string;
    outcomes?: Array<Map<string, any>>;
    rejected?: boolean;
    error?: string;
}
interface BlockView {
    result: {
        header: {
            hash: string;
            timestamp_nanosec: string;
        };
    };
}
interface LastKnownBlock {
    header: {
        hash: string;
        timestamp_nanosec: string;
    };
}
declare function withBlockId(params: Record<string, any>, blockId?: string): {
    finality: string;
} | {
    block_id: string;
};
declare function sendRpc(method: string, params: Record<string, any> | any[]): Promise<any>;
declare function afterTxSent(txId: string): void;
declare function sendTxToRpc(signedTxBase64: string, waitUntil: string | undefined, txId: string): Promise<any>;
interface AccessKeyView {
    nonce: number;
    permission: any;
}
declare function generateTxId(): string;
declare const config: (newConfig?: Partial<NetworkConfig>) => NetworkConfig;
interface SignInParams {
    contractId?: string;
    methodNames?: string[];
    messageToSign?: MessageToSign;
}
interface SignInCallbacks {
    onSuccess?: (result: {
        accountId: string;
        publicKey: string;
        networkId: string;
        contractId?: string;
        methodNames?: string[];
        accounts: Account[];
        isReconnection: boolean;
    }) => void;
    onError?: (error: SignInError) => void;
    timeout?: number;
}
declare const requestSignIn: (params?: SignInParams, callbacks?: SignInCallbacks) => Promise<{
    accountId: string;
    publicKey: string;
    networkId: string;
    contractId: string | undefined;
    methodNames: string[] | undefined;
    accounts: Account[];
    isReconnection: boolean;
    signedMessage: SignatureResult | undefined;
}>;
declare const view: ({ contractId, methodName, args, argsBase64, blockId, }: {
    contractId: string;
    methodName: string;
    args?: any;
    argsBase64?: string;
    blockId?: string;
}) => Promise<any>;
declare const queryAccount: ({ accountId, blockId, }: {
    accountId: string;
    blockId?: string;
}) => Promise<any>;
declare const queryBlock: ({ blockId }: {
    blockId?: string;
}) => Promise<BlockView>;
declare const queryAccessKey: ({ accountId, publicKey, blockId, }: {
    accountId: string;
    publicKey: string;
    blockId?: string;
}) => Promise<AccessKeyWithError>;
declare const queryTx: ({ txHash, accountId }: {
    txHash: string;
    accountId: string;
}) => Promise<any>;
declare const localTxHistory: () => TxHistory;
declare const signOut: () => Promise<void>;
interface SignatureResult {
    accountId: string;
    publicKey: string;
    signature: string;
}
interface Account {
    accountId: string;
    publicKey?: string;
    active?: boolean;
}
declare const signMessage: ({ message, recipient, nonce, callbackUrl, state, }: {
    message: string;
    recipient: string;
    nonce?: Uint8Array;
    callbackUrl?: string;
    state?: string;
}) => Promise<SignatureResult>;
declare const sendTx: ({ receiverId, actions, waitUntil, }: {
    receiverId: string;
    actions: Action[];
    waitUntil?: string;
}) => Promise<any>;
declare const exp: {
    utils: {};
    borsh: {
        serialize: typeof borsh.serialize;
        deserialize: typeof borsh.deserialize;
    };
    borshSchema: {
        Ed25519Signature: borsh.Schema;
        Secp256k1Signature: borsh.Schema;
        Signature: borsh.Schema;
        Ed25519Data: borsh.Schema;
        Secp256k1Data: borsh.Schema;
        PublicKey: borsh.Schema;
        FunctionCallPermission: borsh.Schema;
        FullAccessPermission: borsh.Schema;
        AccessKeyPermission: borsh.Schema;
        AccessKey: borsh.Schema;
        CreateAccount: borsh.Schema;
        DeployContract: borsh.Schema;
        FunctionCall: borsh.Schema;
        Transfer: borsh.Schema;
        Stake: borsh.Schema;
        AddKey: borsh.Schema;
        DeleteKey: borsh.Schema;
        DeleteAccount: borsh.Schema;
        ClassicAction: borsh.Schema;
        DelegateAction: borsh.Schema;
        SignedDelegate: borsh.Schema;
        Action: borsh.Schema;
        Transaction: borsh.Schema;
        SignedTransaction: borsh.Schema;
    };
};
declare const utils: {};
declare const actions: {
    functionCall: ({ methodName, gas, deposit, args, argsBase64, }: {
        methodName: string;
        gas?: string;
        deposit?: string;
        args?: Record<string, any>;
        argsBase64?: string;
    }) => FunctionCallAction;
    transfer: (yoctoAmount: string) => TransferAction;
    stake: ({ amount, publicKey }: {
        amount: string;
        publicKey: string;
    }) => StakeAction;
    addFullAccessKey: ({ publicKey }: {
        publicKey: string;
    }) => AddKeyAction;
    addLimitedAccessKey: ({ publicKey, allowance, accountId, methodNames, }: {
        publicKey: string;
        allowance: string;
        accountId: string;
        methodNames: string[];
    }) => AddKeyAction;
    deleteKey: ({ publicKey }: {
        publicKey: string;
    }) => DeleteKeyAction;
    deleteAccount: ({ beneficiaryId }: {
        beneficiaryId: string;
    }) => DeleteAccountAction;
    createAccount: () => CreateAccountAction;
    deployContract: ({ codeBase64 }: {
        codeBase64: string;
    }) => DeployContractAction;
};

interface ClientConfig {
    networkId?: string;
    stateManager?: StateManager | ExternalStateManager;
    callbacks?: StateChangeCallbacks;
    isolateState?: boolean;
}
/**
 * Creates a NEAR client instance with modern state management
 */
declare function createNearClient(config?: ClientConfig): {
    accountId: () => string | null;
    publicKey: () => string | null;
    authStatus: () => "SignedIn" | "SignedOut";
    getState: () => Promise<WalletState | null>;
    setState: (state: WalletState) => Promise<void>;
    clearState: () => Promise<void>;
    restoreFromExternalState: (state: {
        accountId: string;
        publicKey: string;
        privateKey?: string;
        networkId: string;
    }) => Promise<void>;
    isExternallyManaged: () => boolean;
    config: (newConfig?: Partial<NetworkConfig>) => NetworkConfig;
    selected: () => {
        network: string;
        nodeUrl: string | undefined;
        walletUrl: string | undefined;
        helperUrl: string | undefined;
        explorerUrl: string | undefined;
        account: string | null | undefined;
        contract: string | null | undefined;
        publicKey: string | null | undefined;
    };
    requestSignIn: (params?: Parameters<typeof requestSignIn>[0], callbacks?: Parameters<typeof requestSignIn>[1]) => Promise<ReturnType<typeof requestSignIn>>;
    signOut: () => Promise<void>;
    sendRpc: typeof sendRpc;
    view: ({ contractId, methodName, args, argsBase64, blockId, }: {
        contractId: string;
        methodName: string;
        args?: any;
        argsBase64?: string;
        blockId?: string;
    }) => Promise<any>;
    queryAccount: ({ accountId, blockId, }: {
        accountId: string;
        blockId?: string;
    }) => Promise<any>;
    queryBlock: ({ blockId }: {
        blockId?: string;
    }) => Promise<BlockView>;
    queryAccessKey: ({ accountId, publicKey, blockId, }: {
        accountId: string;
        publicKey: string;
        blockId?: string;
    }) => Promise<AccessKeyWithError>;
    queryTx: ({ txHash, accountId }: {
        txHash: string;
        accountId: string;
    }) => Promise<any>;
    sendTx: ({ receiverId, actions, waitUntil, }: {
        receiverId: string;
        actions: Action[];
        waitUntil?: string;
    }) => Promise<any>;
    signMessage: ({ message, recipient, nonce, callbackUrl, state, }: {
        message: string;
        recipient: string;
        nonce?: Uint8Array;
        callbackUrl?: string;
        state?: string;
    }) => Promise<SignatureResult>;
    localTxHistory: () => TxHistory;
    subscribe: (callback: (state: WalletState) => void) => (() => void);
    onTx: (callback: (tx: TxStatus) => void) => (() => void);
    actions: {
        functionCall: ({ methodName, gas, deposit, args, argsBase64, }: {
            methodName: string;
            gas?: string;
            deposit?: string;
            args?: Record<string, any>;
            argsBase64?: string;
        }) => FunctionCallAction;
        transfer: (yoctoAmount: string) => TransferAction;
        stake: ({ amount, publicKey }: {
            amount: string;
            publicKey: string;
        }) => StakeAction;
        addFullAccessKey: ({ publicKey }: {
            publicKey: string;
        }) => AddKeyAction;
        addLimitedAccessKey: ({ publicKey, allowance, accountId, methodNames, }: {
            publicKey: string;
            allowance: string;
            accountId: string;
            methodNames: string[];
        }) => AddKeyAction;
        deleteKey: ({ publicKey }: {
            publicKey: string;
        }) => DeleteKeyAction;
        deleteAccount: ({ beneficiaryId }: {
            beneficiaryId: string;
        }) => DeleteAccountAction;
        createAccount: () => CreateAccountAction;
        deployContract: ({ codeBase64 }: {
            codeBase64: string;
        }) => DeployContractAction;
    };
    utils: {};
    exp: {
        utils: {};
        borsh: {
            serialize: typeof borsh.serialize;
            deserialize: typeof borsh.deserialize;
        };
        borshSchema: {
            Ed25519Signature: borsh.Schema;
            Secp256k1Signature: borsh.Schema;
            Signature: borsh.Schema;
            Ed25519Data: borsh.Schema;
            Secp256k1Data: borsh.Schema;
            PublicKey: borsh.Schema;
            FunctionCallPermission: borsh.Schema;
            FullAccessPermission: borsh.Schema;
            AccessKeyPermission: borsh.Schema;
            AccessKey: borsh.Schema;
            CreateAccount: borsh.Schema;
            DeployContract: borsh.Schema;
            FunctionCall: borsh.Schema;
            Transfer: borsh.Schema;
            Stake: borsh.Schema;
            AddKey: borsh.Schema;
            DeleteKey: borsh.Schema;
            DeleteAccount: borsh.Schema;
            ClassicAction: borsh.Schema;
            DelegateAction: borsh.Schema;
            SignedDelegate: borsh.Schema;
            Action: borsh.Schema;
            Transaction: borsh.Schema;
            SignedTransaction: borsh.Schema;
        };
    };
    destroy: () => void;
};

declare global {
    interface Window {
        near: typeof fastintear;
    }
}

export { type AccessKeyView, type AccessKeyWithError, type Account, type Action, type ActionType, type AddKeyAction, type AddKeyPermission, type BlockView, type ClientConfig, type CreateAccountAction, type DeleteAccountAction, type DeleteKeyAction, type DeployContractAction, type ExternalStateManager, type FunctionCallAction, type LastKnownBlock, MaxBlockDelayMs, type NetworkConfig, type SignInCallbacks, type SignInParams, type SignatureResult, type SignedDelegateAction, type StakeAction, type StateChangeCallbacks, type StateManager, type Transaction, type TransferAction, type TxStatus, type TxStatusType, type WalletState, type WalletTxResult, actions, afterTxSent, config, createNearClient, exp, generateTxId, localTxHistory, queryAccessKey, queryAccount, queryBlock, queryTx, requestSignIn, sendRpc, sendTx, sendTxToRpc, signMessage, signOut, utils, view, withBlockId };
