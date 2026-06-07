// ids.ts — stable unique IDs (ULID). Globally unique, time-sortable, and mintable OFFLINE
// (no server round-trip), so quotes/scopes/lines can be created on site with no signal.

export type Id = string;

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32
const TIME_LEN = 10;
const RAND_LEN = 16;

const randomBytes = (len: number): number[] => {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr); // Web Crypto (global in browsers and Node ≥ 19)
  return Array.from(arr);
};

let lastTime = -1;
let lastRand: number[] = [];

/** Generate a 26-char ULID. Monotonic within the same millisecond. */
export const ulid = (now: number = Date.now()): Id => {
  let t = now;
  const time: string[] = new Array(TIME_LEN);
  for (let i = TIME_LEN - 1; i >= 0; i--) {
    time[i] = ENCODING[t % 32];
    t = Math.floor(t / 32);
  }

  let rand: number[];
  if (now === lastTime) {
    rand = lastRand.slice();
    for (let i = RAND_LEN - 1; i >= 0; i--) {
      if (rand[i] < 31) { rand[i]++; break; }
      rand[i] = 0;
    }
  } else {
    rand = randomBytes(RAND_LEN).map((b) => b % 32);
  }
  lastTime = now;
  lastRand = rand;

  return time.join('') + rand.map((r) => ENCODING[r]).join('');
};

export const nowIso = (): string => new Date().toISOString();
