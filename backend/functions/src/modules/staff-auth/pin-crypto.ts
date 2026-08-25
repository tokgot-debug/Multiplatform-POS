import { scrypt } from "node:crypto";
import { promisify } from "node:util";

export const PIN_KEY_LENGTH = 32;

const scryptAsync = promisify(scrypt);

export async function derivePinHash(pin: string, salt: Buffer): Promise<Buffer> {
  return (await scryptAsync(pin, salt, PIN_KEY_LENGTH)) as Buffer;
}
