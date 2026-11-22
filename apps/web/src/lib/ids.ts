import { customAlphabet } from "nanoid";

const alpha = customAlphabet("abcdefghijkmnpqrstuvwxyz23456789", 10);
export const newId = (prefix: string) => `${prefix}_${alpha()}`;
export const newSlug = () => customAlphabet("abcdefghijkmnpqrstuvwxyz23456789", 8)();
