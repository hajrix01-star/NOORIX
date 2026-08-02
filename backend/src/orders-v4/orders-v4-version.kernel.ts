import { createHash } from 'node:crypto';

export function ordersV4StableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function ordersV4DefinitionsEqual(current: unknown, candidate: unknown): boolean {
  return JSON.stringify(current) === JSON.stringify(candidate);
}

export function decideOrdersV4VersionPublication(input: {
  currentDefinition: unknown | null;
  candidateDefinition: unknown;
  semanticHash: string;
  hashAlreadyExists: boolean;
  predecessorVersionId: string | null;
  nextVersion: number;
}): { reuseCurrent: boolean; contentHash: string } {
  if (input.currentDefinition != null && ordersV4DefinitionsEqual(input.currentDefinition, input.candidateDefinition)) {
    return { reuseCurrent: true, contentHash: input.semanticHash };
  }
  if (!input.hashAlreadyExists) return { reuseCurrent: false, contentHash: input.semanticHash };
  return {
    reuseCurrent: false,
    contentHash: ordersV4StableHash({
      semanticHash: input.semanticHash,
      predecessorVersionId: input.predecessorVersionId,
      version: input.nextVersion,
    }),
  };
}
