/* lexicon.js — the word lists the gloss rules run over
 *
 * Split out of asl.js so that file stays a readable rule engine. The rules are
 * the part worth reviewing and they were being pushed further down the file
 * with every word added; vocabulary grows without bound, rules do not.
 *
 * This file is data only. Nothing here knows what a gloss is, and no rule ever
 * lives here — if a list needs logic to decide membership, that logic belongs
 * in asl.js reading the list, not here.
 *
 * One thing to be clear about, because it has bitten this project repeatedly:
 * membership here is a claim about *grammar*, not about the avatar. Listing
 * MONDAY as a day says the rules should treat it as one. Whether the avatar can
 * actually sign it is signs.js's business, and the two disagree more often than
 * you would expect — asl.js keeps them honest through willFingerspell(), which
 * asks signs.js rather than trusting this file.
 *
 * Loaded before asl.js: see the script order in index.html and SCRIPTS in
 * build-standalone.py.
 */

(function () {
'use strict';

/* ---------------------------------------------------------------- *
 * Pronouns, possessives, reflexives
 * ---------------------------------------------------------------- */

/* Pronouns are points, and a point does not inflect for case: ASL indexes the
 * same locus whether English says "he" or "him". So the object forms map to the
 * same gloss as their subject form, and SIGN_FOR below sends them to the one
 * sign that exists. */
const PRONOUN = {
  I: 'IX-me', ME: 'IX-me', YOU: 'IX-you', WE: 'IX-we', US: 'IX-we',
  HE: 'IX-he', HIM: 'IX-he', SHE: 'IX-she', HER: 'IX-she',
  IT: 'IX-it', THEY: 'IX-they', THEM: 'IX-they',
};
/* Possession is a flat palm toward the same locus the point would use, so these
 * are the pointing glosses with POSS in place of IX. It was an unused array of
 * four words before this — declared, never referenced, so MY and YOUR fell
 * through to being looked up as ordinary lexical signs. */
const POSSESSIVE = {
  MY: 'POSS-me', MINE: 'POSS-me', YOUR: 'POSS-you', OUR: 'POSS-our',
  HIS: 'POSS-he', ITS: 'POSS-it', THEIR: 'POSS-they',
};
const REFLEXIVE = {
  MYSELF: 'SELF-me', YOURSELF: 'SELF-you', HIMSELF: 'SELF-he',
  HERSELF: 'SELF-she', THEMSELVES: 'SELF-they', OURSELVES: 'SELF-we',
};
/* Which sign actually gets animated for a gloss whose own word has no entry.
 * HIM, THEM, HIS and THEIR are not separate signs — they are the same point,
 * and the possessive/reflexive distinction lives in the handshape, which this
 * vocabulary does not yet carry. Sending them to the base point is the honest
 * approximation: right referent, wrong handshape. Fingerspelling H-I-S instead
 * would be neither. */
const SIGN_FOR = {
  HIM: 'HE', HER: 'SHE', THEM: 'THEY', US: 'WE',
  HIS: 'HE', ITS: 'IT', THEIR: 'THEY',
  MYSELF: 'ME', YOURSELF: 'YOU', HIMSELF: 'HE',
  HERSELF: 'SHE', THEMSELVES: 'THEY', OURSELVES: 'WE',
};
const WH = ['WHAT', 'WHERE', 'WHO', 'WHY', 'WHEN', 'HOW', 'WHICH', 'WHOSE'];

/* Determiners and indefinites — (filled in next step) */
const DETERMINERS = [];

/* ---------------------------------------------------------------- *
 * Time
 * ---------------------------------------------------------------- */

const TIME = ['NOW', 'TODAY', 'TOMORROW', 'YESTERDAY', 'TONIGHT', 'MORNING', 'NIGHT', 'LATER'];

/* Days and months — (filled in next step) */
const DAYS = [];
const MONTHS = [];

/* ---------------------------------------------------------------- *
 * Numbers
 * ---------------------------------------------------------------- */

/* Spelled out as words because the input is a speech transcript, which writes
 * "twenty", not "20". Listing them keeps the stemmer off them — ONES and TENS
 * are not plurals to strip — and lets the fingerspell flag tell the truth about
 * them, since a number is signed from a digit handshape rather than from VOCAB.
 * Only ONE..NINE are renderable today; see isNumberSign in asl.js. */
const NUMBERS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT',
  'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN',
  'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN', 'TWENTY'];

/* Quantifiers — (filled in next step) */
const QUANTIFIERS = [];

/* ---------------------------------------------------------------- *
 * Verbs
 * ---------------------------------------------------------------- */

/* CAN, MUST and SHOULD were already surviving the drop pass — nothing removes
 * them — but they were not verbs to isVerb, so topicalisation never fired on a
 * clause with a modal in it: "I can read book" left BOOK where English put it
 * because g[1] was CAN, not a verb. */
const VERBS = ['EAT', 'DRINK', 'GO', 'COME', 'HELP', 'LOVE', 'WANT', 'KNOW', 'UNDERSTAND',
  'LEARN', 'SEE', 'SLEEP', 'STOP', 'THANK', 'SIGN', 'WORK', 'PLEASE',
  'HAVE', 'LIKE', 'NEED', 'PLAY', 'READ', 'WRITE', 'WATCH', 'LIVE', 'STAY', 'TRY',
  'ASK', 'THINK', 'REMEMBER', 'FORGET', 'BUY', 'PAY', 'CAN', 'MUST', 'SHOULD'];

// ASL verbs do not inflect, so English irregular pasts map back to the base
// sign and the tense is carried separately.
const IRREGULAR_PAST = {
  WENT: 'GO', ATE: 'EAT', DRANK: 'DRINK', SAW: 'SEE', CAME: 'COME', KNEW: 'KNOW',
  UNDERSTOOD: 'UNDERSTAND', SLEPT: 'SLEEP', MADE: 'MAKE', GAVE: 'GIVE', TOOK: 'TAKE',
  TOLD: 'TELL', SAID: 'SAY', FELT: 'FEEL', LEFT: 'LEAVE', MET: 'MEET', TAUGHT: 'TEACH',
  LEARNT: 'LEARN', HELPED: 'HELP', WANTED: 'WANT', LOVED: 'LOVE',
};

/* Verbs that take a recipient as well as a thing. Only used to keep HER from
 * being read as a possessive when it is the recipient. */
const DITRANSITIVE = ['GIVE', 'TELL', 'SEND', 'SHOW', 'BUY', 'PAY', 'ASK', 'TEACH',
  'LEND', 'OFFER', 'BRING'];

/* ---------------------------------------------------------------- *
 * Nouns
 * ---------------------------------------------------------------- */

/* Place names are nouns like any other, and listing them here is what lets
 * them be topicalised — "I love New York" becoming NEW-YORK IX-me LOVE rather
 * than staying in English order. They are kept as their own list because the
 * vocabulary entries behind them carry caveats the rest of the nouns do not;
 * see the places section of signs.js. */
const PLACES = ['AMERICA', 'USA', 'UNITED-STATES', 'CANADA', 'ENGLAND', 'BRITAIN',
  'FRANCE', 'GERMANY', 'NEW-YORK', 'CALIFORNIA', 'TEXAS', 'CHICAGO', 'BOSTON',
  'WASHINGTON', 'CITY', 'COUNTRY'];
const NOUNS = ['WATER', 'FOOD', 'NAME', 'HOME', 'SCHOOL', 'FRIEND', 'FAMILY', 'PEOPLE',
  'LANGUAGE', 'SIGN-LANGUAGE', 'SIGN', 'WORK', 'COFFEE',
  'BOOK', 'CAR', 'DOOR', 'ROOM', 'MONEY', 'TIME', 'DAY', 'WEEK', 'YEAR', 'JOB',
  'TEACHER', 'STUDENT', 'DOCTOR', 'MOTHER', 'FATHER', 'SISTER', 'BROTHER'].concat(PLACES);

/* ---------------------------------------------------------------- *
 * Adjectives
 * ---------------------------------------------------------------- */

const ADJECTIVES = ['GOOD', 'BAD', 'HAPPY', 'SAD', 'ANGRY', 'TIRED', 'HUNGRY', 'DEAF', 'OK', 'MORE',
  'BIG', 'SMALL', 'NEW', 'OLD', 'FAST', 'SLOW', 'EASY', 'HARD', 'HOT', 'COLD'];

/* ---------------------------------------------------------------- *
 * Colors
 * ---------------------------------------------------------------- */

/* (filled in next step) */
const COLORS = [];

/* ---------------------------------------------------------------- *
 * Conjunctions
 * ---------------------------------------------------------------- */

/* (filled in next step) */
const CONJUNCTIONS = [];

/* ---------------------------------------------------------------- *
 * Discourse words
 * ---------------------------------------------------------------- */

/* (filled in next step) */
const DISCOURSE = [];

/* ---------------------------------------------------------------- *
 * Function words the gloss drops
 *
 * Dropped because ASL has no equivalent — not because the sign is missing.
 * ---------------------------------------------------------------- */

const ARTICLES = ['A', 'AN', 'THE'];
const COPULA = ['IS', 'AM', 'ARE', 'WAS', 'WERE', 'BE', 'BEEN', 'BEING'];
const DUMMY_AUX = ['DO', 'DOES', 'DID'];
const FUTURE_CUE = ['WILL', "'LL", 'SHALL', 'GONNA'];
const NEGATIVE = ['NOT', "DON'T", 'DONT', "DOESN'T", 'DOESNT', "DIDN'T", 'DIDNT',
  "CAN'T", 'CANT', 'CANNOT', 'NEVER', 'NO', 'NOTHING', 'NONE'];
const PAST_CUE = ['WAS', 'WERE', 'DID', 'HAD', "DIDN'T", 'DIDNT'];
const YN_STARTERS = ['DO', 'DOES', 'DID', 'ARE', 'IS', 'AM', 'CAN', 'COULD', 'WILL',
  'WOULD', 'SHOULD', 'HAVE', 'HAS', 'MAY'];

/* ---------------------------------------------------------------- *
 * Phrases
 *
 * Word pairs that collapse to a single gloss before any rule reorders them.
 * Every entry here needs a matching sign in signs.js: lookup() falls back on a
 * hyphenated gloss to its head noun and then to its first element, so a
 * collapsed phrase with no entry of its own quietly resolves to one of its
 * parts — LOOK-FOR becoming the preposition FOR — which is a worse failure
 * than the fingerspelling it was meant to avoid.
 * ---------------------------------------------------------------- */

const PHRASES = [['SIGN', 'LANGUAGE'], ['THANK', 'YOU'], ['GOOD', 'BYE'],
  ['NEW', 'YORK'], ['UNITED', 'STATES'],
  ['LOOK', 'FOR'], ['FIND', 'OUT'], ['GROW', 'UP'], ['TAKE', 'CARE'],
  ['LOS', 'ANGELES'], ['SAN', 'FRANCISCO']];

window.SLLEX = {
  PRONOUN, POSSESSIVE, REFLEXIVE, SIGN_FOR, WH, DETERMINERS,
  TIME, DAYS, MONTHS,
  NUMBERS, QUANTIFIERS,
  VERBS, IRREGULAR_PAST, DITRANSITIVE,
  NOUNS, PLACES,
  ADJECTIVES, COLORS,
  CONJUNCTIONS, DISCOURSE,
  ARTICLES, COPULA, DUMMY_AUX, FUTURE_CUE, NEGATIVE, PAST_CUE, YN_STARTERS,
  PHRASES,
};

})();
