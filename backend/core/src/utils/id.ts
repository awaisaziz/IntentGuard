import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);

export function generateSpecId(): string {
  return `intent-${nanoid()}`;
}

export function generateTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}
