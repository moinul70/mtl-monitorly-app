/**
 * Turns any string into a stable numeric seed, so the same key
 * (project id, endpoint path, etc.) always drifts the same "direction"
 * instead of jumping around randomly between requests.
 */
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0; // force 32-bit int
    }
    return Math.abs(hash);
}

/**
 * A smooth, time-based wobble (not pure random) so consecutive polls
 * of the same key drift naturally instead of jittering wildly.
 */
function wobble(seed, amplitude, periodMs = 4000) {
    const t = Date.now() / periodMs;
    return Math.sin(seed + t) * amplitude;
}

module.exports = { hashString, wobble };