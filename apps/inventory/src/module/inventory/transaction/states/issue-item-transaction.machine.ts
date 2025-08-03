import { setup, assign, fromPromise } from 'xstate';

import {
  CreateTransactionInput,
  FinalizeTransactionInput,
  GetDeviceListInput,
  IssueItemTransactionContext,
  OpenLockInput,
  PrepareBinInput,
  ProcessTransactionInput,
  TransactionEvent,
} from '../context';

export const issueItemTransactionStateMachine = setup({
  types: {} as {
    context: IssueItemTransactionContext;
    events: TransactionEvent;
  },
  // will override in processor
  actors: {
    createTransaction: fromPromise(async ({ input }: { input: CreateTransactionInput }) => ({ transactionId: 123 })),
    getDeviceList: fromPromise(async ({ input }: { input: GetDeviceListInput }) => []),
    prepareBin: fromPromise(async ({ input }: { input: PrepareBinInput }) => ({ success: true })),
    openLock: fromPromise(async ({ input }: { input: OpenLockInput }) => ({ success: true })),
    waitLockClose: fromPromise(async ({ input }: { input: OpenLockInput }) => ({ closed: true })),
    processTransaction: fromPromise(async ({ input }: { input: ProcessTransactionInput }) => ({ logData: {}, isNextRequestItem: true })),
    processReturnItems: fromPromise(async ({ input }: { input: ProcessTransactionInput }) => ({ success: true })),
    finalizeTransaction: fromPromise(async ({ input }: { input: FinalizeTransactionInput }) => ({ success: true })),
  },

  guards: {
    hasMoreItems: ({ context }) => context.currentIndex < context.data.length,
    hasNoMoreItems: ({ context }) => context.currentIndex >= context.data.length,
    canRetry: ({ context }) => context.retryCount < 3,
    binIsValid: ({ context }) => !context.data[context.currentIndex]?.bin?.is_failed,
    binIsInvalid: ({ context }) => context.data[context.currentIndex]?.bin?.is_failed,
    canProceedNext: ({ context }) => context.isNextRequestItem && context.isCloseWarningPopup,
  },

  actions: {
    setContext: assign(({ event }) => {
      const startEvent = event as Extract<TransactionEvent, { type: 'START' }>;
      return {
        action: startEvent.action,
        user: startEvent.user,
        data: startEvent.data,
        requestQty: startEvent.requestQty,
        tabletDeviceId: startEvent.tabletDeviceId,
        currentIndex: 0,
        retryCount: 0,
      };
    }),

    incrementIndex: assign(({ context }) => ({
      currentIndex: context.currentIndex + 1,
      retryCount: 0,
    })),

    incrementRetry: assign(({ context }) => ({
      retryCount: context.retryCount + 1,
    })),

    setTransactionId: assign(({ event }) => {
      const doneEvent = event as Extract<TransactionEvent, { type: 'xstate.done.actor.createTransaction' }>;
      return {
        transactionId: doneEvent.output.transactionId,
      };
    }),

    setDeviceList: assign(({ event }) => {
      const doneEvent = event as Extract<TransactionEvent, { type: 'xstate.done.actor.getDeviceList' }>;
      return {
        deviceList: doneEvent.output,
      };
    }),

    updateProcessingStatus: assign(({ event }) => {
      const statusEvent = event as Extract<TransactionEvent, { type: 'PROCESS_ITEM_STATUS' }>;
      return {
        isProcessingItem: statusEvent.message.isProcessingItem,
        isNextRequestItem: statusEvent.message.isNextRequestItem,
      };
    }),

    updateWarningStatus: assign(({ event }) => {
      const errorEvent = event as Extract<TransactionEvent, { type: 'PROCESS_ITEM_ERROR' }>;
      return {
        isCloseWarningPopup: errorEvent.message.isCloseWarningPopup,
      };
    }),

    setError: assign(({ event }) => ({
      error: (event as any).error,
    })),
  },
}).createMachine({
  id: 'transaction',
  initial: 'idle',

  context: {
    action: '',
    user: null,
    data: [],
    requestQty: 0,
    tabletDeviceId: '',
    currentIndex: 0,
    deviceList: [],
    isProcessingItem: false,
    isNextRequestItem: false,
    isCloseWarningPopup: true,
    retryCount: 0,
  },

  states: {
    idle: {
      on: {
        START: {
          target: 'initializing',
          actions: 'setContext',
        },
      },
    },

    initializing: {
      initial: 'creatingTransaction',
      states: {
        creatingTransaction: {
          invoke: {
            src: 'createTransaction',
            input: ({ context }) => context,
            onDone: {
              target: 'loadingDevices',
              actions: 'setTransactionId',
            },
            onError: '#transaction.error',
          },
        },
        loadingDevices: {
          invoke: {
            input: ({ context }) => ({
              binId: context.data,
            }),
            src: 'getDeviceList',
            onDone: {
              target: '#transaction.processing',
              actions: 'setDeviceList',
            },
            onError: '#transaction.error',
          },
        },
      },
    },

    processing: {
      initial: 'checkingNext',
      states: {
        checkingNext: {
          always: [{ target: '#transaction.completed', guard: 'hasNoMoreItems' }, { target: 'preparingBin' }],
        },

        preparingBin: {
          invoke: {
            src: 'prepareBin',
            input: ({ context }) => context.data[context.currentIndex],
            onDone: [{ target: 'skipping', guard: 'binIsValid' }, { target: 'openingLock' }],
            onError: 'skipping',
          },
        },

        openingLock: {
          invoke: {
            src: 'openLock',
            input: ({ context }) => context.data[context.currentIndex],
            onDone: 'waitingUser',
            onError: 'retrying',
          },
          on: {
            LOCK_OPEN_FAIL: 'retrying',
            BIN_OPEN_FAIL: 'skipping',
          },
        },

        retrying: {
          entry: 'incrementRetry',
          always: [{ target: 'openingLock', guard: 'canRetry' }, { target: 'skipping' }],
        },

        waitingUser: {
          invoke: {
            src: 'waitLockClose',
            input: ({ context }) => context.data[context.currentIndex],
            onDone: 'processingTransaction',
            onError: 'skipping',
          },
          on: {
            LOCK_OPEN_SUCCESS: { actions: 'updateProcessingStatus' },
            PROCESS_ITEM_STATUS: { actions: 'updateProcessingStatus' },
          },
        },

        processingTransaction: {
          invoke: {
            src: 'processTransaction',
            input: ({ context }) => context,
            onDone: 'updatingTransaction',
            onError: 'skipping',
          },
        },

        updatingTransaction: {
          on: {
            PROCESS_ITEM_ERROR: { actions: 'updateWarningStatus' },
          },
          after: {
            [1000]: [{ target: 'processingReturnItems', guard: 'canProceedNext' }, { target: 'completing' }],
          },
        },

        processingReturnItems: {
          invoke: {
            src: 'processReturnItems',
            input: ({ context }) => context,
            onDone: 'completing',
            onError: 'completing',
          },
        },

        completing: {
          entry: 'incrementIndex',
          always: 'checkingNext',
        },

        skipping: {
          entry: 'incrementIndex',
          always: 'checkingNext',
        },
      },

      on: {
        PROCESS_ITEM_STATUS: { actions: 'updateProcessingStatus' },
        PROCESS_ITEM_ERROR: { actions: 'updateWarningStatus' },
      },
    },

    completed: {
      invoke: {
        src: 'finalizeTransaction',
        input: ({ context }) => ({ transactionId: context.transactionId }),
        onDone: 'success',
        onError: 'error',
      },
    },

    success: {
      type: 'final',
    },

    error: {
      entry: 'setError',
      on: {
        START: 'initializing',
      },
    },
  },
});
