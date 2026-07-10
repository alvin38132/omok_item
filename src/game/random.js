// Cryptographically-secure randomness helpers.
//
// All game randomness is generated here, in the UI/event layer, and passed
// into the reducer as plain data. This keeps the reducer pure and safe to run
// under React StrictMode (which may invoke reducers twice).

function secureUint32() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0];
}

// Fair coin flip. Returns true ~50% of the time.
export function fiftyFiftyRoll() {
  return secureUint32() < 0x80000000;
}

// Returns true with the given percent probability (0-100).
export function chance(percent) {
  return secureUint32() % 100 < percent;
}

// Uniform integer in [0, maxExclusive).
export function randomInt(maxExclusive) {
  return secureUint32() % maxExclusive;
}

// In-place Fisher-Yates shuffle using secure randomness.
export function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
