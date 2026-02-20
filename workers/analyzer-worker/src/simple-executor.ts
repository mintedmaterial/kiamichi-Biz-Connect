/**
 * Simple Executor - Fallback for when worker_loaders is unavailable
 * 
 * SECURITY NOTE: This runs code in the main worker context without V8 isolation.
 * Only use for trusted internal code (LLM-generated against our tool APIs).
 * 
 * Swap to DynamicWorkerExecutor when worker_loaders beta access is granted.
 */

export interface ExecuteResult {
  result: unknown;
  error?: string;
  logs?: string[];
}

export interface Executor {
  execute(
    code: string,
    fns: Record<string, (...args: unknown[]) => Promise<unknown>>
  ): Promise<ExecuteResult>;
}

/**
 * Simple executor that runs code directly without sandboxing
 * Used as fallback when DynamicWorkerExecutor is unavailable
 */
export class SimpleExecutor implements Executor {
  private timeout: number;

  constructor(options: { timeout?: number } = {}) {
    this.timeout = options.timeout || 30000;
  }

  async execute(
    code: string,
    fns: Record<string, (...args: unknown[]) => Promise<unknown>>
  ): Promise<ExecuteResult> {
    const logs: string[] = [];
    
    // Create a mock console that captures logs
    const mockConsole = {
      log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
      warn: (...args: unknown[]) => logs.push(`[WARN] ${args.map(String).join(' ')}`),
      error: (...args: unknown[]) => logs.push(`[ERROR] ${args.map(String).join(' ')}`)
    };

    try {
      // Validate code doesn't contain dangerous patterns
      const dangerousPatterns = [
        /\beval\s*\(/,
        /\bFunction\s*\(/,
        /\bimport\s*\(/,
        /\brequire\s*\(/,
        /\bprocess\b/,
        /\bglobalThis\b/,
        /\bwindow\b/
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(code)) {
          return {
            result: undefined,
            error: `Code validation failed: dangerous pattern detected`,
            logs
          };
        }
      }

      // Wrap the code in an async function
      // The code should be an async arrow function body
      const wrappedCode = `
        return (async (codemode, console) => {
          ${code}
        })(codemode, mockConsole);
      `;

      // Create and execute the function with timeout
      const fn = new Function('codemode', 'mockConsole', wrappedCode);
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Execution timeout')), this.timeout);
      });

      const result = await Promise.race([
        fn(fns, mockConsole),
        timeoutPromise
      ]);

      return { result, logs };

    } catch (error) {
      return {
        result: undefined,
        error: error instanceof Error ? error.message : String(error),
        logs
      };
    }
  }
}
