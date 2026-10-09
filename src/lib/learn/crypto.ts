// AES-GCM for the course videos' pieces. Works the same in the owner's browser (locking), on the server (opening, then locking
// again for one viewing) and in the player (opening): only Web Crypto, no Node-only calls.
//
// A locked piece = 12 random bytes (the IV) + the ciphertext with its 16-byte tag. The "extra data" ties a piece to
// WHERE it belongs (its lesson and number, and for a viewing, its session), so a piece moved elsewhere refuses to open.

const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder();
/** (TypeScript can't tell these arrays are not backed by a SharedArrayBuffer) */
const bs = (u: Uint8Array) => u as unknown as BufferSource;

export const randomKey = () => globalThis.crypto.getRandomValues(new Uint8Array(32));

export function toB64(u: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const u = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

export const importKey = (raw: Uint8Array) => subtle().importKey("raw", bs(raw), "AES-GCM", false, ["encrypt", "decrypt"]);

/** What a piece is bound to. scope "c" = stored in the bucket; "s" = handed to one viewing session. */
export const aad = (scope: "c" | "s", ...parts: (string | number)[]) => enc.encode([scope, ...parts].join("|"));

export async function seal(key: CryptoKey, plain: Uint8Array, extra: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv, additionalData: bs(extra) }, key, bs(plain)));
  const out = new Uint8Array(new ArrayBuffer(12 + ct.length));
  out.set(iv, 0);
  out.set(ct, 12);
  return out;
}

export async function open(key: CryptoKey, sealed: Uint8Array, extra: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  if (sealed.length < 12 + 16) throw new Error("piece too short");
  const iv = sealed.subarray(0, 12);
  const pt = await subtle().decrypt({ name: "AES-GCM", iv: bs(iv), additionalData: bs(extra) }, key, bs(sealed.subarray(12)));
  return new Uint8Array(pt);
}
