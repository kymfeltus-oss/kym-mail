import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const keyLength = 32;

export function createClientNumber() {
  return `KYM-${String(randomInt(0, 1_000_000)).padStart(6, "0")}`;
}

export function normalizeClientNumber(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function isClientNumber(value: string) {
  return /^KYM-[0-9]{6}$/.test(normalizeClientNumber(value));
}

export async function hashClientPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, keyLength);
  return `scrypt$${salt}$${Buffer.from(derived as Uint8Array).toString("hex")}`;
}

export async function verifyClientPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const derived = await scryptAsync(password, salt, keyLength);
  const left = Buffer.from(derived as Uint8Array);
  const right = Buffer.from(hash, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createClientSessionToken() {
  return randomBytes(32).toString("hex");
}
