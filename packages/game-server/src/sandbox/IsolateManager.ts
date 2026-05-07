import ivm from 'isolated-vm';
import { SANDBOX_MEMORY_MB, SANDBOX_CPU_MS } from '../arena/constants.js';
import { BOT_PREAMBLE, HANDLER_NAMES, injectHostApi } from './api.js';
import type { Action, TankRuntime } from '../arena/types.js';
import { logger } from '../util/logger.js';

type HandlerMap = Partial<Record<string, ivm.Reference>>;

export class IsolateManager {
  private isolate: ivm.Isolate | null = null;
  private context: ivm.Context | null = null;
  private handlers: HandlerMap = {};
  readonly pendingActions: Action[] = [];
  private botId: string;

  constructor(botId: string) {
    this.botId = botId;
  }

  load(code: string, getTank: () => TankRuntime): void {
    this.dispose();

    this.isolate = new ivm.Isolate({ memoryLimit: SANDBOX_MEMORY_MB });
    this.context = this.isolate.createContextSync();
    const jail = this.context.global;

    // Inject host-side API (actions, state reads, print)
    injectHostApi(jail, getTank, this.pendingActions);

    // Run preamble (isolate-side handler registration setup)
    const preamble = this.isolate.compileScriptSync(BOT_PREAMBLE);
    preamble.runSync(this.context);

    // Run bot code (registers handlers into _handlers)
    const script = this.isolate.compileScriptSync(code);
    script.runSync(this.context, { timeout: 500 });

    // Extract handler References from _handlers object
    const handlersRef = jail.getSync('_handlers', { reference: true }) as ivm.Reference;
    for (const name of HANDLER_NAMES) {
      const ref = handlersRef.getSync(name, { reference: true });
      if (ref instanceof ivm.Reference && ref.typeof === 'function') {
        this.handlers[name] = ref;
      }
    }
  }

  callHandlerSync(name: string, args: unknown[]): void {
    const handler = this.handlers[name];
    if (!handler || handler.isDisposed) return;

    const ivmArgs = args.map((a) => new ivm.ExternalCopy(a).copyInto({ release: true }));

    try {
      handler.applySync(undefined, ivmArgs, { timeout: SANDBOX_CPU_MS });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('timed out')) {
        logger.warn({ botId: this.botId, handler: name }, 'Sandbox timeout — tick skipped');
      } else {
        logger.warn({ botId: this.botId, handler: name, err: msg }, 'Sandbox error');
      }
    }
  }

  drainActions(): Action[] {
    return this.pendingActions.splice(0);
  }

  dispose(): void {
    try {
      this.isolate?.dispose();
    } catch {
      // already disposed
    }
    this.isolate = null;
    this.context = null;
    this.handlers = {};
    this.pendingActions.length = 0;
  }

  get isLoaded(): boolean {
    return this.isolate !== null && !this.isolate.isDisposed;
  }
}
