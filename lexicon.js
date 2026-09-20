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

/* Determiners and indefinites. NOBODY is listed here rather than with the
 * negatives, which is a simplification: it negates a clause the way NOT does
 * and ought to trigger the head shake, but the negation rule keys off NEGATIVE
 * and folding it in there would make it the clause's NOT. Left as a known gap
 * rather than half-wired. */
const DETERMINERS = ['THIS', 'THAT', 'THESE', 'THOSE', 'ANY', 'EACH', 'EVERY',
  'BOTH', 'ANOTHER', 'OTHER', 'SOMETHING', 'SOMEONE', 'ANYONE', 'EVERYONE',
  'NOBODY', 'EVERYTHING'];

/* ---------------------------------------------------------------- *
 * Time
 * ---------------------------------------------------------------- */

const TIME = ['NOW', 'TODAY', 'TOMORROW', 'YESTERDAY', 'TONIGHT', 'MORNING', 'NIGHT', 'LATER'];

/* Days and months are time signs, so asl.js fronts them the way it fronts
 * TOMORROW and sets the tense from them — "Monday I went to school" needs no
 * FINISH, because MONDAY has already said when.
 *
 * MAY is deliberately in both this list and YN_STARTERS. The modal and the
 * month are the same string, and the two never collide in practice: YN_STARTERS
 * is only consulted at the start of a sentence ("May I help you"), where a bare
 * month is not a sentence. */
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY',
  'SATURDAY', 'SUNDAY'];
const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY',
  'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

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

/* Quantifiers. MORE moved here out of ADJECTIVES, which changes one thing:
 * isAdj('MORE') is now false, so the adjective-after-noun rule no longer
 * reorders "more water" and it stays MORE WATER. That is the right outcome —
 * a quantifier precedes its noun where a descriptive adjective follows it. */
const QUANTIFIERS = ['MANY', 'MUCH', 'FEW', 'LITTLE', 'ALL', 'SOME', 'ENOUGH',
  'LESS', 'MORE'];

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
  'ASK', 'THINK', 'REMEMBER', 'FORGET', 'BUY', 'PAY', 'CAN', 'MUST', 'SHOULD',
  'START', 'BEGIN', 'CONTINUE', 'LISTEN', 'HEAR', 'SPEAK', 'TALK', 'MOVE',
  'WALK', 'RUN', 'DRIVE', 'FLY', 'TRAVEL', 'OPEN', 'CLOSE', 'PUT', 'GET',
  'CALL', 'VISIT', 'COOK', 'CLEAN', 'WASH', 'BELIEVE', 'HOPE', 'WISH', 'SHOW',
  'EXPLAIN', 'DESCRIBE', 'LOSE', 'WIN', 'GROW', 'CHANGE', 'BUILD', 'FIX', 'BREAK',
  /* These nine were reachable only through IRREGULAR_PAST: GAVE mapped to GIVE,
   * MET to MEET, and so on, but the base form was not a verb to isVerb — so
   * "she gave him her book" topicalised and "she gives him her book" did not.
   * All nine already have signs; they were simply never listed. */
  'MAKE', 'GIVE', 'TAKE', 'TELL', 'SAY', 'FEEL', 'LEAVE', 'MEET', 'TEACH',
  /* HAVE-TO and NEED-TO are listed but unreachable, and deliberately so: a
   * two-word gloss only ever gets built if PHRASES collapses it, and a
   * collapsed phrase with no sign of its own resolves to one of its parts or
   * spells as one run-on word. Both halves — the PHRASES entry and the sign —
   * have to land together. Until then these sit here doing nothing rather than
   * making "I have to go" worse than it is now.
   *
   * FINISH is missing from this list on purpose. It is the past-tense marker
   * (see the tense rule in asl.js), and adding it as a content verb would make
   * "I finish work" produce a FINISH token indistinguishable from the one the
   * tense rule unshifts. Telling those two apart is a disambiguation rule, not
   * a vocabulary entry, and rushing it risks the past-tense logic that
   * currently works. Known follow-up. CLEAN has the same shape of problem in
   * miniature — it is in this list and in ADJECTIVES, and nothing decides
   * which sense is meant in "clean room". */
  'HAVE-TO', 'NEED-TO'];

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
  'TEACHER', 'STUDENT', 'DOCTOR', 'MOTHER', 'FATHER', 'SISTER', 'BROTHER',
  'MAN', 'WOMAN', 'BOY', 'GIRL', 'BABY', 'CHILD', 'ADULT', 'KID',
  'HOUSE', 'STORE', 'HOSPITAL', 'RESTAURANT', 'PARK', 'OFFICE', 'CHURCH', 'LIBRARY',
  'PHONE', 'COMPUTER', 'TABLE', 'CHAIR', 'BED', 'WINDOW', 'PAPER', 'PEN', 'BAG',
  'BREAD', 'MEAT', 'FRUIT', 'VEGETABLE', 'MILK', 'EGG',
  'IDEA', 'PROBLEM', 'QUESTION', 'ANSWER', 'REASON', 'PLAN', 'RULE', 'LAW',
  'HOUR', 'MINUTE', 'SECOND', 'MONTH',
  'SUMMER', 'WINTER', 'SPRING', 'FALL', 'WEEKEND'].concat(PLACES);

/* ---------------------------------------------------------------- *
 * Adjectives
 * ---------------------------------------------------------------- */

const ADJECTIVES = ['GOOD', 'BAD', 'HAPPY', 'SAD', 'ANGRY', 'TIRED', 'HUNGRY', 'DEAF', 'OK',
  'BIG', 'SMALL', 'NEW', 'OLD', 'FAST', 'SLOW', 'EASY', 'HARD', 'HOT', 'COLD',
  'LONG', 'SHORT', 'HIGH', 'LOW', 'WIDE', 'NARROW', 'CLEAN', 'DIRTY',
  'STRONG', 'WEAK', 'RICH', 'POOR', 'SAME', 'DIFFERENT', 'IMPORTANT',
  'DIFFICULT', 'SIMPLE', 'FULL', 'EMPTY', 'RIGHT', 'WRONG', 'TRUE', 'FALSE'];

/* ---------------------------------------------------------------- *
 * Colors
 * ---------------------------------------------------------------- */

/* Colours behave as adjectives — isAdj in asl.js checks this list too, so
 * "red car" reorders to CAR RED like any other description. */
const COLORS = ['RED', 'BLUE', 'GREEN', 'YELLOW', 'BLACK', 'WHITE', 'BROWN',
  'ORANGE', 'PURPLE', 'PINK', 'GRAY'];

/* ---------------------------------------------------------------- *
 * Conjunctions
 * ---------------------------------------------------------------- */

/* Vocabulary only. ASL does not join clauses the way English does — it leans
 * on pausing, body shift and raised brows where English reaches for a
 * conjunction, and BECAUSE and BUT often front their clause rather than sitting
 * between the two. None of that is implemented: these are here so the words are
 * recognised rather than treated as unknown. The reordering is a future rule. */
const CONJUNCTIONS = ['BECAUSE', 'SO', 'BUT', 'OR', 'AND'];

/* ---------------------------------------------------------------- *
 * Discourse words
 * ---------------------------------------------------------------- */

/* NO is absent here because it is already in NEGATIVE, where the negation rule
 * needs it. */
const DISCOURSE = ['YES', 'MAYBE', 'PROBABLY'];

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

/* ---------------------------------------------------------------- *
 * Known, but not yet signable
 *
 * Every word above is vocabulary the rules understand. These 89 of them have
 * no entry in signs.js yet, so the avatar fingerspells them — and the point of
 * naming them here is to say that this is a gap in the *animation* data, not a
 * word that fell through the lexicon by accident. asl.js sets `pending` on
 * tokens it finds in this list, so a caller can tell "we know this word, the
 * sign is not built" apart from "we have never heard of this".
 *
 * Nothing reads this list to decide whether to fingerspell. That decision stays
 * with willFingerspell(), which asks signs.js directly — so if this list drifts
 * out of date the flag stays correct and only the explanation goes stale.
 *
 * Where the signs come from: the colours, the seven days and the twelve months
 * are the obvious next authoring pass, being closed sets with well-documented
 * forms — that alone is 30 of the 89. Numbers TEN..TWENTY need their own
 * handshapes rather than digits, since ASL does not build them by counting.
 * Prune each word from here as its sign lands. */
const NO_SIGN_YET = [
  'ADULT', 'ANOTHER', 'ANYONE', 'APRIL', 'AUGUST', 'BELIEVE', 'BLACK',
  'BLUE', 'BOTH', 'BROWN', 'CONTINUE', 'DECEMBER', 'DESCRIBE', 'EACH',
  'EIGHTEEN', 'ELEVEN', 'EMPTY', 'ENOUGH', 'EVERYONE', 'FALL', 'FALSE',
  'FEBRUARY', 'FIFTEEN', 'FLY', 'FOURTEEN', 'FRIDAY', 'FRUIT', 'GRAY',
  'GREEN', 'GROW', 'HAVE', 'HAVE-TO', 'HIGH', 'HOPE', 'JANUARY', 'JULY',
  'JUNE', 'KID', 'LAW', 'LOW', 'MARCH', 'MAY', 'MONDAY', 'MUCH', 'NARROW',
  'NEED-TO', 'NINETEEN', 'NOBODY', 'NOVEMBER', 'OCTOBER', 'ORANGE', 'OTHER',
  'PINK', 'PLAN', 'PROBABLY', 'PURPLE', 'PUT', 'RED', 'RULE', 'SATURDAY',
  'SECOND', 'SEPTEMBER', 'SEVENTEEN', 'SIMPLE', 'SIXTEEN', 'SO', 'SOMEONE',
  'SPRING', 'STAY', 'SUMMER', 'SUNDAY', 'TEN', 'THESE', 'THIRTEEN', 'THOSE',
  'THURSDAY', 'TRAVEL', 'TUESDAY', 'TWELVE', 'TWENTY', 'VEGETABLE', 'VISIT',
  'WEDNESDAY', 'WEEKEND', 'WHITE', 'WIDE', 'WINTER', 'WISH', 'YELLOW',
];

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
  NO_SIGN_YET,
};

})();
