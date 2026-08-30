export function getMessageCreatedAt(metadata: unknown): Date | undefined {
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    !("createdAt" in metadata)
  ) {
    return undefined;
  }

  const { createdAt } = metadata as { createdAt?: unknown };
  if (typeof createdAt !== "string" && typeof createdAt !== "number") {
    return undefined;
  }

  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
