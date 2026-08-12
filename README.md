# Voice → Sign Language animation (prototype)

Speak into the mic; an animated avatar signs what you said — hands *and* face.
The English sentence is first rewritten into **ASL gloss order** (ASL is a
distinct language, not English-with-handshapes), known words become lexical
signs, anything else is fingerspelled, and the non-manual markers (brows, head,
mouth) are applied from the grammar.

## Run it

```bash
cd sign-language-prototype
./serve.sh          # or: python3 -m http.server 8765
```

Then open <http://localhost:8765> in **Chrome**.

Two things matter:

- **Chrome or Edge.** Speech capture uses the Web Speech API
  (`webkitSpeechRecognition`). Safari and Firefox don't support it — the typed
  input still works everywhere.
- **Serve over `http://localhost`, not `file://`.** Browsers only grant mic
  access on a secure origin, and `file://` isn't one.

Click **Start listening**, allow the microphone, and talk. There's also a text
box and example phrases if you'd rather not use voice.

## How it works

```
mic → Web Speech API → transcript text
    → asl.js: English → ASL gloss
        drop copula/articles/dummy-aux · stem inflection · TIME first
        WH to the end · topicalise object · NOT + head-shake scope
        tense as FINISH/time sign · pronouns → IX points
    → resolve each gloss: lexical sign, else fingerspell
    → keyframe timeline (hand pose + wrist position + rotation + face)
    → interpolate (smootherstep) → canvas render each frame
```

| File | Role |
| --- | --- |
| `asl.js` | English → ASL gloss: word order, dropped words, marker scope, rule trace |
| `signs.js` | Hand-shape definitions (26 letters, 0–9, ~65 word signs), stage anchors, per-sign markers |
| `face.js` | Avatar body + face rig: the 14 non-manual parameters and the named markers |
| `hand.js` | Canvas renderer — hand geometry, two-bone arm IK, timeline + player |
| `app.js` | Speech recognition, text → sign plan, clause markers, UI wiring |
| `test-poses.html` | Contact sheet of every hand shape |
| `test-faces.html` | Contact sheet of every facial marker |
| `test-frames.html` | Filmstrip of sampled animation frames per phrase |
| `test-gloss.html` | Gloss output + fired rules for a list of test sentences |

A pose is joint flexion angles per finger, spread angles, and two thumb angles.
Every pose flattens to a 19-number vector and the face to another 14, so
transitions between any two signs — face included — are a plain component-wise
interpolation of one 33-number vector. Anchors (`chin`, `chest`, `forehead`…)
are **wrist** positions — the hand extends about 95 stage-units above the wrist,
so a sign that contacts the chin puts the wrist near the collarbone.

### Deep links

`index.html?text=hello%20world` signs on load. Add `&t=1200` to freeze at that
millisecond — handy for screenshots and for debugging a specific transition.

## ASL grammar

ASL is **not** English word order with different words. `asl.js` rewrites the
sentence first, and the UI shows every rule that fired.

| English | ASL gloss |
| --- | --- |
| where is the water | `WATER WHERE` |
| what is your name | `YOUR NAME WHAT` |
| I love sign language | `SIGN-LANGUAGE IX-me LOVE` |
| I don't understand | `IX-me NOT UNDERSTAND` |
| yesterday I went to school | `YESTERDAY IX-me GO SCHOOL` |
| tomorrow I will help my friend | `TOMORROW IX-me HELP MY FRIEND` |
| the people are eating food | `PEOPLE EAT FOOD` |

The rules, and why:

- **TIME – TOPIC – COMMENT.** Time signs are fronted; ASL states when, then what
  you're talking about, then what about it.
- **Tense is marked once, lexically.** Verbs don't inflect. Past becomes the
  sign `FINISH` — *unless* a time sign already establishes tense, which is why
  it's `YESTERDAY ME GO`, not `YESTERDAY ME FINISH GO`. Likewise "will" is
  dropped when `TOMORROW` is present.
- **WH-words go last.** `WATER WHERE`, not `WHERE WATER`. This is a strong
  tendency rather than an absolute rule.
- **Topicalisation.** A known object can be fronted, giving object-subject-verb
  with a brow raise on the topic. Plain SVO is equally valid, so this only
  fires on statements with a pronoun subject and a known noun object.
- **No copula, no articles, no dummy auxiliaries.** ASL has no "to be" and no
  "the"; `do/does/did` carry no meaning. These are dropped because ASL doesn't
  express them — not because a sign is missing.
- **Negation** is `NOT` plus a head shake spanning from there to the end of the
  clause. A head shake alone negates a sign.
- **Pronouns are points**, glossed `IX-me` / `IX-you` — indexing, not words.

## Non-manual markers

In ASL the face is grammar. Brow position alone is what separates a WH-question
from a statement, so the avatar drives these automatically:

| Marker | Trigger | Shown as |
| --- | --- | --- |
| WH-question | what / where / who / why / when / how | brows down, slight head forward |
| Yes/no question | trailing `?`, or an opening auxiliary (do, can, is…) | brows up, eyes wide |
| Negation | from a negative word to the end of the clause | head shake, brows down |
| Affirmation | YES | head nod |
| Mouth morphemes | per sign (`mm`, `oo`, `cha`, `th`, `pah`) | mouth shape |
| Affect | per sign (happy, sad, angry, sorry…) | brows, eyes, mouth |

Because the WH sign lands at the end of the question, the brow furrow only has
to cover the end rather than the whole sentence — Lifeprint is explicit about
this. Yes/no marking is different: the brow raise is held across the whole
sentence.

Clause markers and sign markers occupy **different channels** and co-occur, the
way they do on a real signer: `compose()` in `face.js` takes brows/head/eyes
from the clause marker and mouth/affect from the sign, so a sign keeps its
mouth morpheme while the clause keeps its brow position.

Blinking and breathing are deliberately *not* on the sign timeline — they aren't
linguistic, so they run as a procedural idle in the player.

## Adding a sign

In `signs.js`, add to `VOCAB`. Each keyframe is
`kf(poseName, [x, y], rotationDeg, holdMs)`, and `at('chin', dx, dy)` offsets
from a named anchor:

```js
COFFEE: {
  face: 'mm',          // optional non-manual marker for this sign
  two: true,
  frames: [
    kf('S', at('chest', 0, -30), 0, 200),
    kf('S', at('chest', 0, -46), 0, 240),
  ],
},
```

A fifth argument to `kf()` overrides the face for one keyframe — that's how the
head shake on NO alternates within a single sign.

Reload `test-frames.html` (add your phrase to the `phrases` array) to check it.

## Honest limitations

This is a demo of the voice → animation pipeline, **not a translator**, and it
should not be used to communicate with Deaf people.

- **The grammar layer is a rule engine, not a translator.** It covers word
  order, dropped function words, tense and marker scope. It does not parse
  clauses, so long or complex sentences will come out wrong.
- **No spatial grammar.** Classifiers, verb agreement through space (setting up
  referents and moving verbs between them), and role shift are absent — these
  are core ASL and need a spatial model this doesn't have.
- **Not validated by a Deaf signer.** The rules come from published grammar
  references, but nothing here has been checked by a native signer or a
  certified interpreter, which is the only real test.
- **Partial non-manual grammar.** The main markers are modeled, but not the
  full system — no eye-gaze reference to spatial loci, no role shift, no
  intensity or adverbial mouth morphemes beyond the handful listed above.
- **One signing hand.** Two-handed signs are approximated with the dominant
  hand and labeled `2-handed` in the sign plan; the other arm just rests.
- **2D, no palm orientation.** Flexion is faked with in-plane rotation plus
  foreshortening. Signs distinguished only by palm facing or by depth of
  movement will look the same.
- Hand shapes are hand-authored approximations, not motion capture.

Doing this properly means a 3D avatar driven by mocap or pose-estimation data
(How2Sign, ASL-LEX) with a real gloss-translation model in front of it — and
Deaf signers involved throughout, not consulted at the end.

## Sources

The grammar rules are drawn from:

- Lifeprint / ASL University — [ASL grammar](https://www.lifeprint.com/asl101/pages-layout/grammar.htm),
  [WH-question placement](https://www.lifeprint.com/asl101/topics/wh-question-placement.htm),
  [sentence types](https://www.lifeprint.com/asl101/topics/sentencetypes.htm)
- Start ASL — [ASL sentence structure basics](https://www.startasl.com/understanding-asl-sentence-structure-basics/)
- Germanna Academic Center for Excellence — [ASL Grammar Guide (PDF)](https://germanna.edu/sites/default/files/2023-07/ASL%20Grammar%20Guide%20(edit%207-24-23).pdf)
- Wikipedia — [American Sign Language grammar](https://en.wikipedia.org/wiki/American_Sign_Language_grammar)
