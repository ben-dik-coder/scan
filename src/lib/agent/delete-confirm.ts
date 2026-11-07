import { randomBytes, timingSafeEqual } from "node:crypto";

export type PendingDelete = {
  token: string;
  resourceType: string;
  resourceId: string;
  resourceName?: string;
  userId: string;
  expiresAt: number;
};

const CONFIRM_TTL_MS = 10 * 60 * 1000;
const pendingDeletes = new Map<string, PendingDelete>();

function pendingKey(
  userId: string,
  resourceType: string,
  resourceId: string
): string {
  return `${userId}:${resourceType}:${resourceId}`;
}

function tokensMatch(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

export function createDeleteConfirmToken(
  userId: string,
  resourceType: string,
  resourceId: string,
  resourceName?: string
): string {
  const token = randomBytes(24).toString("base64url");
  pendingDeletes.set(pendingKey(userId, resourceType, resourceId), {
    token,
    resourceType,
    resourceId,
    resourceName,
    userId,
    expiresAt: Date.now() + CONFIRM_TTL_MS,
  });
  return token;
}

export function peekDeleteConfirm(
  userId: string,
  resourceType: string,
  resourceId: string
): PendingDelete | null {
  const key = pendingKey(userId, resourceType, resourceId);
  const pending = pendingDeletes.get(key);
  if (!pending) return null;
  if (pending.expiresAt <= Date.now()) {
    pendingDeletes.delete(key);
    return null;
  }
  return { ...pending };
}

export function clearDeleteConfirm(
  userId: string,
  resourceType: string,
  resourceId: string
): void {
  pendingDeletes.delete(pendingKey(userId, resourceType, resourceId));
}

export function verifyDeleteConfirm(
  userId: string,
  resourceType: string,
  resourceId: string,
  token: string
): boolean {
  if (!token) return false;

  const pending = peekDeleteConfirm(userId, resourceType, resourceId);
  if (!pending || !tokensMatch(pending.token, token)) return false;

  clearDeleteConfirm(userId, resourceType, resourceId);
  return true;
}
