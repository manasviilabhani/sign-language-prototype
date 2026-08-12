/* asl.js — English -> ASL gloss
 *
 * ASL is not English with different words: it has its own syntax. This stage
 * rewrites an English sentence into an ordered gloss before anything is
 * animated, and records which rule fired so the UI can show its work.
 *
 * Rules implemented (sources in README):
 *   TIME - TOPIC - COMMENT ordering, time signs fronted
 *   WH-words move to the end of the question
 *   topicalisation of a known object (OSV, "passive voice")
 *   no copula, no articles, no dummy do/does/did, no infinitival "to"
 *   negation as NOT + a head shake spanning the predicate
 *   past marked with FINISH rather than verb inflection
 *   pronouns glossed as index points (IX-me / IX-you)
 *
 * What it deliberately does NOT do: classifiers, verb agreement through space,
 * role shift, aspectual inflection. Those need a spatial model this doesn't have.
 */

(function () {
'use strict';

/* ---------------------------------------------------------------- *
 * Lexicon — a rough part-of-speech table over the sign vocabulary
 * ---------------------------------------------------------------- */

const TIME = ['NOW', 'TODAY', 'TOMORROW', 'YESTERDAY', 'TONIGHT', 'MORNING', 'NIGHT', 'LATER'];
const WH = ['WHAT', 'WHERE', 'WHO', 'WHY', 'WHEN', 'HOW', 'WHICH', 'WHOSE'];
const PRONOUN = { I: 'IX-me', ME: 'IX-me', YOU: 'IX-you', WE: 'IX-we' };
const POSSESSIVE = ['MY', 'MINE', 'YOUR', 'OUR'];
const NOUNS = ['WATER', 'FOOD', 'NAME', 'HOME', 'SCHOOL', 'FRIEND', 'FAMILY', 'PEOPLE',
  'LANGUAGE', 'SIGN-LANGUAGE', 'SIGN', 'WORK', 'COFFEE'];

// ASL verbs do not inflect, so English irregular pasts map back to the base
// sign and the tense is carried separately.
const IRREGULAR_PAST = {
  WENT: 'GO', ATE: 'EAT', DRANK: 'DRINK', SAW: 'SEE', CAME: 'COME', KNEW: 'KNOW',
  UNDERSTOOD: 'UNDERSTAND', SLEPT: 'SLEEP', MADE: 'MAKE', GAVE: 'GIVE', TOOK: 'TAKE',
  TOLD: 'TELL', SAID: 'SAY', FELT: 'FEEL', LEFT: 'LEAVE', MET: 'MEET', TAUGHT: 'TEACH',
  LEARNT: 'LEARN', HELPED: 'HELP', WANTED: 'WANT', LOVED: 'LOVE',
};
const FUTURE_CUE = ['WILL', "'LL", 'SHALL', 'GONNA'];
const VERBS = ['EAT', 'DRINK', 'GO', 'COME', 'HELP', 'LOVE', 'WANT', 'KNOW', 'UNDERSTAND',
  'LEARN', 'SEE', 'SLEEP', 'STOP', 'THANK', 'SIGN', 'WORK', 'PLEASE'];
const ADJECTIVES = ['GOOD', 'BAD', 'HAPPY', 'SAD', 'ANGRY', 'TIRED', 'HUNGRY', 'DEAF', 'OK', 'MORE'];

// Dropped because ASL has no equivalent — not because the sign is missing.
const ARTICLES = ['A', 'AN', 'THE'];
const COPULA = ['IS', 'AM', 'ARE', 'WAS', 'WERE', 'BE', 'BEEN', 'BEING'];
const DUMMY_AUX = ['DO', 'DOES', 'DID'];
const NEGATIVE = ['NOT', "DON'T", 'DONT', "DOESN'T", 'DOESNT', "DIDN'T", 'DIDNT',
  "CAN'T", 'CANT', 'CANNOT', 'NEVER', 'NO', 'NOTHING', 'NONE'];
const PAST_CUE = ['WAS', 'WERE', 'DID', 'HAD', "DIDN'T", 'DIDNT'];

const isVerb = (w) => VERBS.includes(w);
const isNoun = (w) => NOUNS.includes(w);

/* ---------------------------------------------------------------- *
 * Rule engine
 * ---------------------------------------------------------------- */

function normalize(text) {
  return text.toUpperCase().replace(/[^A-Z0-9'\-\s?]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Strip English inflection the way ASL does — tense and number come from
// separate signs, not from the verb.
function stem(w) {
  if (w.length > 4 && w.endsWith('ING')) return w.slice(0, -3);
  if (w.length > 3 && w.endsWith('ED')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('S') && !w.endsWith('SS')) return w.slice(0, -1);
  return w;
}

function toGloss(text) {
  const trace = [];
  const note = (rule, detail) => trace.push({ rule, detail });

  const raw = normalize(text);
  const isQuestionMark = /\?\s*$/.test(raw);
  let words = raw.replace(/\?/g, '').split(' ').filter(Boolean);

  // Multi-word signs collapse before anything else reorders them.
  const PHRASES = [['SIGN', 'LANGUAGE'], ['THANK', 'YOU'], ['GOOD', 'BYE']];
  for (const ph of PHRASES) {
    for (let i = 0; i <= words.length - ph.length; i++) {
      if (ph.every((w, j) => words[i + j] === w)) {
        words.splice(i, ph.length, ph.join('-'));
      }
    }
  }

  const hasWh = words.some((w) => WH.includes(w));
  const hasNeg = words.some((w) => NEGATIVE.includes(w));
  const hasTime = words.some((w) => TIME.includes(w));
  const isPast = words.some((w) => PAST_CUE.includes(w) || IRREGULAR_PAST[w] ||
    (w.length > 3 && w.endsWith('ED')));
  const isFuture = words.some((w) => FUTURE_CUE.includes(w));

  /* -- drop what ASL does not express lexically -- */
  const kept = [];
  const dropped = { article: [], copula: [], aux: [], prep: [] };
  for (const w of words) {
    if (ARTICLES.includes(w)) { dropped.article.push(w); continue; }
    if (COPULA.includes(w)) { dropped.copula.push(w); continue; }
    if (DUMMY_AUX.includes(w)) { dropped.aux.push(w); continue; }
    if (w === 'TO' || w === 'OF') { dropped.prep.push(w); continue; }
    // A time sign already sets the tense, so a separate future marker is
    // redundant — this is why ASL says TOMORROW ME GO, not TOMORROW ME WILL GO.
    if (FUTURE_CUE.includes(w)) {
      if (hasTime) { dropped.aux.push(w); continue; }
      kept.push('FUTURE');
      continue;
    }
    kept.push(w);
  }
  if (dropped.article.length) note('no articles', 'dropped ' + dropped.article.join(', '));
  if (dropped.copula.length) note('no copula', 'ASL has no "to be": dropped ' + dropped.copula.join(', '));
  if (dropped.aux.length) note('no dummy auxiliary', 'dropped ' + dropped.aux.join(', '));
  if (dropped.prep.length) note('no infinitive marker', 'dropped ' + dropped.prep.join(', '));

  /* -- negation: one NOT before the predicate, head shake to the end -- */
  let g = [];
  for (const w of kept) {
    if (NEGATIVE.includes(w)) {
      // "no" answering a question stays as the sign NO; everything else is NOT
      g.push({ gloss: kept.length === 1 && w === 'NO' ? 'NO' : 'NOT', sign: kept.length === 1 && w === 'NO' ? 'NO' : 'NOT' });
      continue;
    }
    const s = IRREGULAR_PAST[w] || stem(w);
    g.push({ gloss: s, sign: s, english: w });
  }
  if (hasNeg) note('negation', 'NOT + head shake over the rest of the clause');

  /* -- inflection is not signed -- */
  const restemmed = g.filter((t) => t.english && t.english !== t.gloss);
  if (restemmed.length) {
    note('no verb inflection', restemmed.map((t) => t.english + ' → ' + t.gloss).join(', '));
  }

  /* -- tense is lexical, and only marked once -- */
  if (isPast && !hasTime) {
    g.unshift({ gloss: 'FINISH', sign: 'FINISH' });
    note('tense is lexical', 'past marked with the sign FINISH, not on the verb');
  } else if (isPast && hasTime) {
    note('tense marked once', 'the time sign already sets the tense — no FINISH needed');
  }
  if (isFuture && hasTime) {
    note('tense marked once', 'the time sign already sets the tense — "will" dropped');
  }

  /* -- TIME - TOPIC - COMMENT: time signs move to the front -- */
  const timeIdx = g.findIndex((t) => TIME.includes(t.gloss));
  if (timeIdx > 0) {
    const [t] = g.splice(timeIdx, 1);
    g.unshift(t);
    note('time first', t.gloss + ' fronted (TIME - TOPIC - COMMENT)');
  }

  /* -- WH-words move to the end of the question -- */
  let whIdx = g.findIndex((t) => WH.includes(t.gloss));
  if (whIdx >= 0 && whIdx !== g.length - 1) {
    const [t] = g.splice(whIdx, 1);
    g.push(t);
    note('WH goes last', t.gloss + ' moved to the end of the question');
  }

  /* -- topicalisation: front a known object, giving OSV -- */
  const isQuestion = hasWh || isQuestionMark || isYesNo(words);
  if (!isQuestion && !hasNeg && g.length >= 3) {
    const subj = g[0];
    const verb = g[1];
    const obj = g[g.length - 1];
    if (PRONOUN[subj.gloss] && isVerb(verb.gloss) && isNoun(obj.gloss) && obj !== verb) {
      g.splice(g.indexOf(obj), 1);
      g.unshift(obj);
      obj.topic = true;
      note('topic-comment', obj.gloss + ' topicalised → object-subject-verb');
    }
  }

  /* -- pronouns are index points -- */
  for (const t of g) {
    if (PRONOUN[t.gloss]) {
      t.display = PRONOUN[t.gloss];
      t.sign = t.gloss;
    }
  }
  if (g.some((t) => t.display)) note('pronouns are points', 'glossed IX (index) — pointing, not a lexical word');

  /* -- assign non-manual marker scope -- */
  const type = hasWh ? 'wh' : (isQuestion ? 'yn' : 'statement');
  let negFrom = hasNeg ? g.findIndex((t) => t.gloss === 'NOT' || t.gloss === 'NO') : -1;

  g.forEach((t, i) => {
    let m = null;
    if (t.topic) m = 'topic';
    if (type === 'yn') m = 'yn';
    // With the WH sign at the end, the furrow only has to cover the end of the
    // question — not the whole sentence.
    if (type === 'wh' && WH.includes(t.gloss)) m = 'wh';
    if (negFrom >= 0 && i >= negFrom) m = 'neg';
    t.marker = m;
  });

  if (type === 'yn') note('yes/no question', 'brow raise held across the whole sentence');
  if (type === 'wh') note('WH question', 'brow furrow on the WH sign at the end');
  if (g.some((t) => t.topic)) note('topic marker', 'brow raise on the fronted topic');

  return { english: raw, glosses: g, trace, type };
}

const YN_STARTERS = ['DO', 'DOES', 'DID', 'ARE', 'IS', 'AM', 'CAN', 'COULD', 'WILL',
  'WOULD', 'SHOULD', 'HAVE', 'HAS', 'MAY'];

function isYesNo(words) {
  return words.length > 1 && YN_STARTERS.includes(words[0]);
}

window.SLASL = { toGloss, TIME, WH, NOUNS, VERBS, ADJECTIVES, PRONOUN };

})();
