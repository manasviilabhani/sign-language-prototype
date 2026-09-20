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
 * Lexicon
 *
 * The word lists live in lexicon.js, which must load first — see the script
 * order in index.html and SCRIPTS in build-standalone.py. They are pulled in
 * by name here so the rules below read exactly as they did when the lists were
 * inline, and so a missing lexicon fails loudly at load rather than as a
 * mysterious empty-list no-op inside a rule.
 * ---------------------------------------------------------------- */

const L = window.SLLEX;
const PRONOUN = L.PRONOUN;
const POSSESSIVE = L.POSSESSIVE;
const REFLEXIVE = L.REFLEXIVE;
const SIGN_FOR = L.SIGN_FOR;
const WH = L.WH;
const TIME = L.TIME;
const NUMBERS = L.NUMBERS;
const VERBS = L.VERBS;
const IRREGULAR_PAST = L.IRREGULAR_PAST;
const DITRANSITIVE = L.DITRANSITIVE;
const NOUNS = L.NOUNS;
const PLACES = L.PLACES;
const ADJECTIVES = L.ADJECTIVES;
const ARTICLES = L.ARTICLES;
const COPULA = L.COPULA;
const DUMMY_AUX = L.DUMMY_AUX;
const FUTURE_CUE = L.FUTURE_CUE;
const NEGATIVE = L.NEGATIVE;
const PAST_CUE = L.PAST_CUE;
const YN_STARTERS = L.YN_STARTERS;
const PHRASES = L.PHRASES;

const isVerb = (w) => VERBS.includes(w);
const isNoun = (w) => NOUNS.includes(w);
const isAdj = (w) => ADJECTIVES.includes(w);

/* ---------------------------------------------------------------- *
 * Rule engine
 * ---------------------------------------------------------------- */

function normalize(text) {
  return text.toUpperCase().replace(/[^A-Z0-9'\-\s?]/g, ' ').replace(/\s+/g, ' ').trim();
}

/* A word that is itself a sign is not inflected English. BRING, THIS, SHOES
 * and ALWAYS all end in something the stemmer strips, and stripping it left
 * BR, THI, SHOE and ALWAY — none of which are signs, so all four fell through
 * to being fingerspelled while the real sign sat unused in the vocabulary.
 * Sixteen signs were unreachable this way. Checking the vocabulary first costs
 * a lookup and settles it: a known sign is never inflection. */
function isSign(w) {
  const V = window.SL && window.SL.VOCAB;
  return !!(V && V[w]) || isNumberSign(w);
}

/* A number is not in VOCAB — it is signed straight off a digit handshape, and
 * signs.js keeps that table. Asking it rather than hard-coding a range here
 * means that when 10..20 are added there (they need their own forms; ASL does
 * not build them by counting digits) everything downstream starts telling the
 * truth about them with no change to this file. */
function isNumberSign(w) {
  const N = window.SL && window.SL.NUMBER_WORDS;
  return !!(N && N[w]);
}

/* Mirrors lookup() in app.js, including its compound fallback, so the
 * fingerspell flag agrees with what the animator will actually do. If that
 * function's resolution order changes, this has to follow it. */
function willFingerspell(sign) {
  if (!sign) return true;
  if (isSign(sign)) return false;
  if (sign.indexOf('-') >= 0) {
    const parts = sign.split('-');
    if (isSign(parts[parts.length - 1]) || isSign(parts[0])) return false;
  }
  return true;
}

// Strip English inflection the way ASL does — tense and number come from
// separate signs, not from the verb.
function stem(w) {
  if (isSign(w) || NUMBERS.includes(w)) return w;
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

  // Multi-word signs collapse before anything else reorders them. See PHRASES
  // in lexicon.js for why each one needs a sign of its own.
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
  // The -ED test is a guess, and it guessed wrong on TIRED, NEED, SCARED,
  // EXCITED and BORED — each a sign in its own right, each turned into a
  // spurious FINISH plus a mangled stem. A word that is a sign is not a tense.
  const isPast = words.some((w) => PAST_CUE.includes(w) || IRREGULAR_PAST[w] ||
    (w.length > 3 && w.endsWith('ED') && !isSign(w)));
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
  const push = (t) => {
    // Set here rather than downstream so the flag is decided while the word's
    // own resolution is in hand, not re-derived from the reordered stream.
    t.fingerspell = willFingerspell(t.sign || t.gloss);
    g.push(t);
    return t;
  };
  for (let i = 0; i < kept.length; i++) {
    const w = kept[i];
    if (NEGATIVE.includes(w)) {
      // "no" answering a question stays as the sign NO; everything else is NOT
      const n = kept.length === 1 && w === 'NO' ? 'NO' : 'NOT';
      push({ gloss: n, sign: n });
      continue;
    }

    /* Pronouns and possessives are settled here, in the input's own order,
     * rather than in a pass at the end — because HER is both an object pronoun
     * and a possessive, and the only thing that separates them is what follows
     * it. By the end of this function that evidence is gone: topicalising
     * "I like her book" fronts BOOK and strands HER with nothing after it, at
     * which point the possessive is indistinguishable from "I like her". */
    const next = kept[i + 1];
    const prev = kept[i - 1];
    const prevBase = IRREGULAR_PAST[prev] || prev;
    /* Possessive only if a noun phrase actually follows — a bare "not a verb"
     * test read "I saw her yesterday" as POSS-she, because YESTERDAY is a time
     * sign rather than a verb. And even a following noun is not enough after a
     * verb that takes two objects: in "I gave her water", HER is who the water
     * went to, not whose water it is. */
    const herPossessive = w === 'HER' && next !== undefined &&
      (isNoun(next) || isAdj(next)) && !DITRANSITIVE.includes(prevBase);

    if (REFLEXIVE[w]) {
      push({ gloss: w, display: REFLEXIVE[w], sign: SIGN_FOR[w] || w, english: w });
    } else if (POSSESSIVE[w] || herPossessive) {
      push({ gloss: w, display: herPossessive ? 'POSS-she' : POSSESSIVE[w],
             sign: SIGN_FOR[w] || w, english: w, poss: true });
    } else if (PRONOUN[w]) {
      push({ gloss: w, display: PRONOUN[w], sign: SIGN_FOR[w] || w, english: w });
    } else {
      const sg = isSign(w) ? w : (IRREGULAR_PAST[w] || stem(w));
      push({ gloss: sg, sign: sg, english: w });
    }
  }
  if (hasNeg) note('negation', 'NOT + head shake over the rest of the clause');

  /* -- inflection is not signed -- */
  const restemmed = g.filter((t) => t.english && t.english !== t.gloss);
  if (restemmed.length) {
    note('no verb inflection', restemmed.map((t) => t.english + ' → ' + t.gloss).join(', '));
  }

  /* -- tense is lexical, and only marked once -- */
  if (isPast && !hasTime) {
    g.unshift({ gloss: 'FINISH', sign: 'FINISH', fingerspell: willFingerspell('FINISH') });
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
    t.moved = true;
    note('time first', t.gloss + ' fronted (TIME - TOPIC - COMMENT)');
  }

  /* -- WH-words move to the end of the question -- */
  let whIdx = g.findIndex((t) => WH.includes(t.gloss));
  if (whIdx >= 0 && whIdx !== g.length - 1) {
    const [t] = g.splice(whIdx, 1);
    g.push(t);
    t.moved = true;
    note('WH goes last', t.gloss + ' moved to the end of the question');
  }

  /* -- adjectives follow the noun they modify --
   *
   * English stacks the adjective in front, ASL usually puts it after: "I have a
   * big car" is HAVE CAR BIG, not HAVE BIG CAR. Usually, not always — ASL
   * permits the prenominal order too, and which one a signer reaches for
   * depends on emphasis and on the adjective. This fires unconditionally
   * because one consistent order is more readable than a coin toss, but it is a
   * tendency being applied as a rule, and that is the sort of thing a Deaf
   * signer would want to look at.
   *
   * Anything an earlier rule has already relocated is left alone: a fronted
   * time sign or a WH word shunted to the end is where it is for a stronger
   * reason than adjective order. */
  for (let i = 0; i < g.length - 1; i++) {
    const a = g[i];
    const n = g[i + 1];
    if (!isAdj(a.gloss) || !isNoun(n.gloss)) continue;
    if (a.moved || n.moved || WH.includes(a.gloss)) continue;
    g[i] = n;
    g[i + 1] = a;
    a.postNominal = true;
    a.moved = true;
    n.moved = true;
    note('adjective after noun', n.gloss + ' ' + a.gloss + ' — ASL puts the adjective second');
  }

  /* -- topicalisation: front a known object, giving OSV -- */
  const isQuestion = hasWh || isQuestionMark || isYesNo(words);
  if (!isQuestion && !hasNeg && g.length >= 3) {
    const subj = g[0];
    const verb = g[1];
    /* What moves is the noun phrase, not the noun. Three earlier versions of
     * this fronted the bare noun and stranded whatever belonged to it at the
     * end of the clause, modifying nothing: "I like big car" left BIG behind,
     * "he likes his new job" left POSS-he, "I need five books" left FIVE. So
     * the span grows left over a possessive or a number and right over an
     * adjective this run has just put behind its noun. */
    let last = g.length - 1;
    let first = g[last].postNominal ? last - 1 : last;
    while (first > 0 && (g[first - 1].poss || NUMBERS.includes(g[first - 1].gloss))) first--;
    const obj = g[g[last].postNominal ? last - 1 : last];
    if (PRONOUN[subj.gloss] && isVerb(verb.gloss) && isNoun(obj.gloss) &&
        obj !== verb && first > 1) {
      const moved = g.splice(first, last - first + 1);
      for (const t of moved) t.topic = true;
      g.unshift.apply(g, moved);
      note('topic-comment', moved.map((t) => t.display || t.gloss).join(' ') +
        ' topicalised → object-subject-verb');
    }
  }

  /* -- pronouns are index points -- *
   * Resolved in the build loop above; this only reports it. Reinstating the
   * assignment here would undo the possessive reading of HER, since PRONOUN
   * also holds HER and would overwrite POSS-she with IX-she. */
  if (g.some((t) => t.display && t.display.indexOf('IX-') === 0)) {
    note('pronouns are points', 'glossed IX (index) — pointing, not a lexical word');
  }
  if (g.some((t) => t.poss)) {
    note('possession is a point too', 'glossed POSS — a flat palm toward the same locus');
  }
  if (g.some((t) => t.display && t.display.indexOf('SELF-') === 0)) {
    note('reflexive', 'glossed SELF — the point made with a thumb-up hand');
  }

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

function isYesNo(words) {
  return words.length > 1 && YN_STARTERS.includes(words[0]);
}

window.SLASL = { toGloss, TIME, WH, NOUNS, PLACES, VERBS, ADJECTIVES,
                 PRONOUN, POSSESSIVE, REFLEXIVE, NUMBERS };

})();
