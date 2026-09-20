/* audit-signs.js — mechanical checks over the whole sign vocabulary
 *
 *   node audit-signs.js
 *
 * What this is for. Nobody has verified these signs against a Deaf signer, and
 * this script does not pretend to: it cannot tell you whether WATER is right.
 * What it can do is find the defects that have a *shape* in the data, and those
 * turn out to catch a lot — the two bugs that prompted it, STOP mirroring a
 * hand that should have been a stationary base and STUDENT being byte-identical
 * to nothing in particular, are both instances of a class rather than one-offs.
 *
 * Three checks:
 *
 *   A. Two different words that animate identically. Sometimes correct — ASL
 *      indexes HE, SHE and IT with the same point — so the legitimate ones are
 *      declared in SYNONYMS below and everything else is reported. A collision
 *      that is not a synonym means at least one of the two words is wrong.
 *   B. Agent nouns that do not end in the PERSON marker. STUDENT is LEARN +
 *      PERSON; drop the marker and it is not the word any more.
 *   C. Two-handed signs built by mirroring whose hands never come near each
 *      other. Fine for a symmetric sign, fatal for one whose meaning is the
 *      contact.
 *   D. Signs whose movement is too small to read.
 *   E. Words the grammar knows that the vocabulary has no sign for and has not
 *      declared as a known gap.
 *
 * Exits non-zero when check A finds something undeclared, so it can gate a
 * commit. B and C are reported but not enforced: both need a judgement call
 * per word, and a list that has to be argued with is worth more than a gate
 * that gets switched off.
 */

'use strict';
global.window = global;
require('./signs.js');
const V = window.SL.VOCAB;

/* Words that share one form on purpose. Each group is a claim about ASL, not
 * about this code, and each wants checking by someone who signs. */
const SYNONYMS = [
  ['HE', 'SHE', 'IT'],            // indexing a locus; ASL marks no gender here
  ['THEY', 'THEM'],               // the same point, English case only
  ['CAN', 'ABLE'], ['ONLY', 'ALONE'], ['START', 'BEGIN'],
  ['SCARED', 'AFRAID'], ['HARD', 'DIFFICULT'], ['RIGHT', 'CORRECT'],
  ['SMALL', 'LITTLE'], ['BEAUTIFUL', 'PRETTY'], ['SING', 'MUSIC'],
  ['CITY', 'TOWN'], ['TALK', 'SPEAK'], ['LOOK', 'WATCH'], ['TAKE', 'GET'],
  ['NEED', 'MUST', 'SHOULD'], ['ALL', 'EVERYTHING'], ['WRITE', 'PEN'],
  ['AMERICA', 'USA', 'UNITED-STATES'], ['ENGLAND', 'ENGLISH', 'BRITAIN'],
  ['FRANCE', 'FRENCH'], ['GERMANY', 'GERMAN'],
];

/* Nouns that are a verb plus the agent marker. */
const AGENT = { STUDENT: 'LEARN', TEACHER: 'TEACH' };

/* Signs whose meaning is the two hands touching. Mirroring cannot express any
 * of these, because mirrored hands move apart in sympathy and never meet. */
const CONTACT = ['NAME', 'HELP', 'STOP', 'SCHOOL', 'WORK', 'MEET', 'WITH', 'SHOES', 'EGG'];

const key = (e) => e.frames.map((f) =>
  [f.p, f.x, f.y, f.r, f.p2, f.x2, f.y2, f.r2].join(',')).join('|');

// Aliases share one object by design, so group by identity before comparing.
const byObj = new Map();
for (const w of Object.keys(V)) {
  if (!V[w].frames) continue;
  if (!byObj.has(V[w])) byObj.set(V[w], []);
  byObj.get(V[w]).push(w);
}

const declared = new Set();
for (const g of SYNONYMS) declared.add(g.slice().sort().join('+'));

let failed = 0;
const forms = new Map();
for (const [e, names] of byObj) {
  const k = key(e);
  if (!forms.has(k)) forms.set(k, []);
  forms.get(k).push(names[0]);
}

console.log('A. different words, identical animation');
const bad = [];
for (const group of forms.values()) {
  if (group.length < 2) continue;
  if (declared.has(group.slice().sort().join('+'))) continue;
  bad.push(group);
}
if (!bad.length) console.log('   none undeclared');
for (const g of bad) console.log('   ' + g.join('  ==  '));
failed += bad.length;

console.log('\nB. agent nouns without the PERSON marker');
const marker = V.PERSON ? key(V.PERSON).split('|').slice(-2).join('|') : null;
let bMiss = 0;
for (const noun of Object.keys(AGENT)) {
  const e = V[noun];
  if (!e) { console.log('   ' + noun + ' missing entirely'); bMiss++; continue; }
  const tail = key(e).split('|').slice(-2).join('|');
  if (tail !== marker) { console.log('   ' + noun + ' does not end in PERSON'); bMiss++; }
}
if (!bMiss) console.log('   none');

console.log('\nC. contact signs built by mirroring');
let cMiss = 0;
for (const w of CONTACT) {
  const e = V[w];
  if (!e || !e.frames.some((f) => f.p2 !== undefined)) continue;
  const stationary = e.frames.every((f) => f.x2 === e.frames[0].x2 && f.y2 === e.frames[0].y2);
  const gap = Math.min(...e.frames.map((f) => Math.hypot(f.x - f.x2, f.y - f.y2)));
  if (!stationary && gap > 45) {
    console.log('   ' + w.padEnd(8) + 'mirrored, hands never closer than ' + Math.round(gap));
    cMiss++;
  }
}
if (!cMiss) console.log('   none');

/* D. movement too small to see. HOW travelled four stage units in total — the
 * handshapes were right and the roll that is the sign was invisible. Anything
 * under 15 is a sign the viewer cannot read as moving. */
console.log('\nD. signs that do not move, change shape, or turn');
let dMiss = 0;
for (const [e, names] of byObj) {
  let travel = 0;
  for (let i = 1; i < e.frames.length; i++) {
    travel += Math.hypot(e.frames[i].x - e.frames[i - 1].x, e.frames[i].y - e.frames[i - 1].y);
  }
  /* Three things count as movement, and only counting the first gives false
   * alarms. A sign can change handshape in place, or twist — `twist` turns the
   * wrist 74 degrees while translating 4 units — and both read perfectly well.
   * And `hold` deliberately drops 11 units onto its pose as a settle. What is
   * actually broken is a sign that does none of the three. */
  const shapes = new Set(e.frames.map((f) => f.p));
  const spin = Math.max(...e.frames.map((f) => f.r)) - Math.min(...e.frames.map((f) => f.r));
  if (travel < 8 && shapes.size < 2 && spin < 10) {
    console.log('   ' + names[0].padEnd(12) + Math.round(travel) + ' units, ' +
                shapes.size + ' handshape, ' + Math.round(spin) + ' degrees of turn');
    dMiss++;
  }
}
if (!dMiss) console.log('   none');

/* E. words the grammar knows and the vocabulary does not. Invisible to every
 * check above, because a missing entry has no frames to inspect — which is how
 * WHICH sat in the WH list for the whole project's life, getting moved to the
 * end of questions and fingerspelled. Only runs when the lexicon is present. */
console.log('\nE. lexicon words with no sign');
let eMiss = 0;
try {
  require('./lexicon.js');
  const L = window.SLLEX;
  const N = window.SL.NUMBER_WORDS;
  const withheld = new Set(window.SL.WITHHELD || []);
  const pending = new Set(L.NO_SIGN_YET || []);
  const lists = ['WH', 'TIME', 'DAYS', 'MONTHS', 'NUMBERS', 'QUANTIFIERS', 'VERBS',
    'NOUNS', 'ADJECTIVES', 'COLORS', 'CONJUNCTIONS', 'DISCOURSE', 'DETERMINERS'];
  const undeclared = [];
  for (const name of lists) {
    for (const w of L[name] || []) {
      if (V[w] || (N && N[w]) || L.SIGN_FOR[w]) continue;
      if (pending.has(w) || withheld.has(w)) continue;   // known and declared
      undeclared.push(name.toLowerCase() + ':' + w);
    }
  }
  if (undeclared.length) {
    console.log('   ' + undeclared.join(' '));
    eMiss = undeclared.length;
  } else console.log('   none undeclared');
} catch (err) {
  console.log('   (lexicon.js not loaded — skipped)');
}

console.log('\n' + byObj.size + ' distinct forms across ' + Object.keys(V).length + ' words');
console.log(bad.length + ' undeclared collisions · ' + bMiss + ' agent nouns · ' +
            cMiss + ' contact signs · ' + dMiss + ' unreadable movements · ' +
            eMiss + ' undeclared gaps');
process.exit(failed ? 1 : 0);
