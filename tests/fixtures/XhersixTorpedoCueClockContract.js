// Original AstrofluxClient clock contract cases; fixture supplied by the port test.
import assert from 'node:assert/strict';
export function runClockContract(fixture) {
function inactive(model, now) {
    assert.deepEqual(model.read(now), {active:false, ownerId:0, pulse:false,
        phaseMs:NaN, remainingMs:NaN, cycle:0});
    assert(Number.isNaN(model.pulseAgeMs));
}
function phase(model, now, elapsed, pulseAgeMs = elapsed % 2500) {
    const expectedPhase = elapsed % 2500;
    const snapshot = model.read(now);
    assert.equal(snapshot.active, true);
    assert.equal(snapshot.phaseMs, expectedPhase);
    assert.equal(snapshot.remainingMs, 2500 - expectedPhase);
    assert.equal(snapshot.pulse, pulseAgeMs < 350);
    assert.equal(model.pulseAgeMs, pulseAgeMs);
    assert.equal(snapshot.cycle, Math.floor(elapsed / 2500));
    for (const field of ['active', 'ownerId', 'pulse', 'phaseMs', 'remainingMs', 'cycle']) {
        assert.equal(model[field], snapshot[field], `${field} getter matches snapshot`);
    }
    return snapshot;
}

// No observation means no cue. First matching arrival anchors exactly t=0,
// including a zero-valued local timer or owner ID (no falsy-value sentinels).
{
    const model = fixture(); inactive(model, 0); inactive(model, 5000);
    model.observe(42, 6000);
    assert.deepEqual(model.read(6000), {active:true, ownerId:42, pulse:true,
        phaseMs:0, remainingMs:2500, cycle:0});
    for (const elapsed of [1, 349, 350, 351, 2499, 2500]) {
        phase(model, 6000 + elapsed, elapsed);
    }
    model.observe(42, 8500);
    phase(model, 8849, 2849); phase(model, 8850, 2850);
    model.reset(); inactive(model, 99999);
    model.observe(0, 0);
    assert.equal(phase(model, 0, 0).ownerId, 0);
}

// Server/arrival cadence fluctuations are irrelevant to this fixed visual
// beat: observations30ms early/late and volley siblings never re-anchor it.
{
    const model = fixture(); model.observe(9, 1000);
    const observations = [1001, 1002, 3470, 3471, 3530, 5970, 6030, 8470, 8530];
    for (const now of observations) {
        model.observe(9, now);
        phase(model, now, now - 1000);
    }
    phase(model, 8849, 7849); phase(model, 8850, 7850);
    model.observe(9, 10970);
    assert.equal(phase(model, 11000, 10000).cycle, 4);
    assert.equal(model.pulse, true);
    model.observe(9, 11030);
    assert.equal(model.phaseMs, 30, 'late receipt does not restart the pulse');
}

// Sample only the present phase after missed frames. There is no event queue,
// catch-up loop or accumulated pulse count that could burst old animations.
{
    const model = fixture(); model.observe(1, 0);
    phase(model, 100, 100);
    // Fresh packets arrive while rendering skips frames; none restart phase.
    model.observe(1, 2470); model.observe(1, 4970);
    phase(model, 7100, 7100); // Both earlier full pulses were skipped.
    assert.equal(model.pulse, false); assert.equal(model.cycle, 2);
    model.observe(1, 7470);
    const current = phase(model, 7500, 7500);
    assert.equal(current.pulse, true); assert.equal(current.cycle, 3);
    for (let index = 0; index < 100; index++) assert.deepEqual(model.read(7500), current);
    phase(model, 7850, 7850);
    assert.equal(model.pulse, false);
}

// Owner lock is stable. Foreign packets cannot refresh liveness or shift the
// phase; expiration permits a new owner and creates a new zero anchor.
{
    const model = fixture(); model.observe(10, 100);
    model.observe(20, 2500);
    assert.equal(phase(model, 2500, 2400).ownerId, 10);
    model.observe(20, 3100);
    assert.equal(phase(model, 3100, 3000).ownerId, 10);
    inactive(model, 3101);
    model.observe(20, 3200);
    assert.equal(phase(model, 3200, 0).ownerId, 20);
    model.reset(); inactive(model, 3201);
    model.observe(30, 3202);
    assert.equal(phase(model, 3202, 0).ownerId, 30);
}

// Liveness is measured from the last matching observation, not the anchor.
// One2500ms interval plus500ms tolerance remains active at3000ms and expires
// only beyond it. Phase correction never changes this wall-clock timeout.
{
    const model = fixture(); model.observe(1, 1000);
    phase(model, 4000, 3000);
    model.observe(1, 4000);
    assert.equal(phase(model, 4000, 2500, 500).cycle, 1);
    phase(model, 7000, 5500);
    inactive(model, 7001);
    model.observe(1, 8000); phase(model, 8000, 0);
    model.observe(1, 11001);
    assert.equal(phase(model, 11001, 0).cycle, 0, 'expired same owner receives a fresh anchor');
    model.observe(2, 14002);
    assert.equal(phase(model, 14002, 0).ownerId, 2, 'foreign owner may anchor after silence expiry');
}

// uint getTimer rollover is short forward movement, never a phase restart.
{
    const model = fixture(), start = 0xfffffff0;
    model.observe(7, start);
    phase(model, 0xffffffff, 15);
    phase(model, 4, 20);
    model.observe(7, 20);
    phase(model, 20, 36);
    phase(model, 2484, 2500);
    model.observe(7, 2484);
    phase(model, 2833, 2849); phase(model, 2834, 2850);
    model.observe(7, 4984); model.observe(7, 7484);
    model.observe(7, 9900);
    phase(model, 9900, 10000);
    phase(model, 12484, 12584);
    phase(model, 12900, 13000);
    inactive(model, 12901);
}

// Repeated matching observations keep a long-running cue alive across a full
// uint period. Its accumulated cycle is Number, not a wrapped elapsed uint.
{
    const model = fixture(); model.observe(3, 0);
    // Execute the actual production observer every2.5s: no artificial state edits.
    const step = 2500;
    let elapsed = 0;
    while (elapsed + step <= 4294980000) {
        elapsed += step;
        model.observe(3, elapsed >>> 0);
    }
    const expected = phase(model, elapsed >>> 0, elapsed);
    assert(elapsed > 0xffffffff);
    assert(expected.cycle > 1700000);
    assert.equal(expected.ownerId, 3);
}

// Snapshot mutation cannot affect the model; frame sampling needs no Object
// allocation and has no timer, chat, network, or projectile dependencies.
{
    const model = fixture(); model.observe(1, 50);
    const snapshot = model.read(100);
    snapshot.active = false; snapshot.ownerId = 999; snapshot.phaseMs = 999;
    assert.equal(model.active, true); assert.equal(model.ownerId, 1); assert.equal(model.phaseMs, 50);
}
// Symmetric threshold: +/-49 ms is jitter; +/-50 ms realigns the cadence.
for (const offset of [-49, 49, -50, 50]) {
    const model = fixture(); model.observe(1, 0);
    const now = 2500 + offset;
    model.observe(1, now);
    const corrected = Math.abs(offset) >= 50;
    const logical = corrected ? 2500 : now;
    const age = corrected && offset < 0 ? 0 : now % 2500;
    phase(model, now, logical, age);
    phase(model, now + 100, logical + 100, age + 100 >= 2500 ? (age + 100) % 2500 : age + 100);
}

// Small errors accumulate against the current anchor until the threshold is
// crossed; the correction does not restart an already running yellow pulse.
{
    const model = fixture(); model.observe(1, 0);
    model.observe(1, 2530); phase(model, 2530, 2530);
    model.observe(1, 5060); phase(model, 5060, 5000, 60);
    phase(model, 5100, 5040, 100);
    model.observe(1, 7590); phase(model, 7590, 7530);
    model.observe(1, 10120); phase(model, 10120, 10000, 60);
    phase(model, 10410, 10290, 350); assert.equal(model.pulse, false);
}
{
    const model = fixture(); model.observe(1, 0);
    model.observe(1, 2470); phase(model, 2470, 2470);
    model.observe(1, 4940); phase(model, 4940, 5000);
    phase(model, 4990, 5050);
    model.observe(1, 7410); phase(model, 7410, 7470);
    model.observe(1, 9880); phase(model, 9880, 10000);
    assert.equal(model.cycle, 4);
}

// A late correction while a pulse is running keeps its wall origin. Even a
// later same-cycle correction after its end must not replay that pulse.
{
    const model = fixture(); model.observe(1, 0); model.sample(2500);
    phase(model, 2700, 2700);
    model.observe(1, 2700); phase(model, 2700, 2500, 200);
    model.observe(1, 2800); phase(model, 2800, 2500, 300);
    phase(model, 2850, 2550, 350); assert.equal(model.pulse, false);
    model.observe(1, 2900); phase(model, 2900, 2500, 400);
    assert.equal(model.cycle, 1); assert.equal(model.pulse, false);
    model.observe(1, 5350); phase(model, 5350, 5000);
    assert.equal(model.cycle, 2); assert.equal(model.pulse, true);
    for (let n = 0; n < 10; n++) phase(model, 5350, 5000);
}

// Missing display frames never queue old pulses; fresh volleys maintain the
// wall timeout while the model corrects early/late cadence and cycle numbers.
{
    const model = fixture(); model.observe(1, 0);
    for (const now of [2450, 4950, 7510]) model.observe(1, now);
    phase(model, 8000, 7990, 550); assert.equal(model.pulse, false);
    model.observe(1, 10010); phase(model, 10010, 10000);
    assert.equal(model.cycle, 4); assert.equal(model.pulseAgeMs, 0);
}

// Positive and negative phase offsets do not shorten/extend silence expiry,
// including when the local uint clock wraps during the corrected cycle.
for (const offset of [-50, 50]) {
    const model = fixture(), start = 0xffffff00;
    model.observe(1, start);
    const observed = 2500 + offset;
    model.observe(1, (start + observed) >>> 0);
    assert.equal(model.phaseMs, 0);
    model.sample((start + observed + 3000) >>> 0); assert.equal(model.active, true);
    inactive(model, (start + observed + 3001) >>> 0);
    model.observe(2, (start + observed + 3002) >>> 0);
    assert.equal(model.phaseMs, 0); assert.equal(model.pulseAgeMs, 0); assert.equal(model.cycle, 0);
}

}
