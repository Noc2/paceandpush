export type OperationMetadata = {
  affectedRows?: number;
  errorCount?: number;
  itemCount?: number;
};

export async function measureOperation<T>(
  operation: string,
  task: () => Promise<T>,
  metadata?: (result: T) => OperationMetadata,
): Promise<T> {
  const startedAt = Date.now();

  try {
    const result = await task();
    writeOperationLog("info", {
      ...metadata?.(result),
      durationMs: Date.now() - startedAt,
      event: "operation",
      operation,
      status: "ok",
    });
    return result;
  } catch (error) {
    writeOperationLog("error", {
      durationMs: Date.now() - startedAt,
      event: "operation",
      operation,
      status: "error",
    });
    throw error;
  }
}

type OperationLog = OperationMetadata & {
  durationMs: number;
  event: "operation";
  operation: string;
  status: "error" | "ok";
};

function writeOperationLog(level: "error" | "info", entry: OperationLog): void {
  console[level](JSON.stringify(entry));
}
