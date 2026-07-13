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

function secureInt(maxExclusive) {
  const range = 0x100000000;
  const limit = Math.floor(range / maxExclusive) * maxExclusive;
  let value = secureUint32();
  while (value >= limit) value = secureUint32();
  return value % maxExclusive;
}

// Returns true with the given percent probability (0-100).
export function chance(percent) {
  return secureInt(100) < percent;
}

// Time Stone die: even rolls rewind that many turns; odd rolls are blanks.
export function timeStoneRoll() {
  return secureInt(6) + 1;
}

