/* app.js — voice capture, text -> sign plan, UI wiring */

(function () {
'use strict';

const { POSES, VOCAB, A_, FINGERSPELL_MOTION, NUMBER_WORDS, kf, at, PALM_REST } = window.SL;
const { Player, Timeline } = window.SLPlayer;
const { compose } = window.SLFace;
const { toGloss } = window.SLASL;

/* ---------------------------------------------------------------- *
 * Gloss -> sign plan
 *
 * Word order, dropped words and marker scope are decided in asl.js; this
 * stage only turns each gloss into either a lexical sign or fingerspelling.
 * ---------------------------------------------------------------- */

function lookup(word) {
  if (VOCAB[word]) return VOCAB[word];
  const bare = word.replace(/^IX-/, '').toUpperCase();
  if (VOCAB[bare]) return VOCAB[bare];
  // Compound gloss (SIGN-LANGUAGE): fall back to the head noun, then the first
  // element, rather than fingerspelling the whole thing.
  if (bare.includes('-')) {
    const parts = bare.split('-');
    for (const p of [parts[parts.length - 1], parts[0]]) if (VOCAB[p]) return VOCAB[p];
  }
  return null;
}

function tokenize(text) {
  const { glosses, trace, english, type } = toGloss(text);
  const tokens = glosses.map((g) => {
    const label = g.display || g.gloss;
    const num = NUMBER_WORDS[g.gloss];
    if (num) {
      return { text: label, kind: 'sign', frames: [kf(num, at('spell', 8, -24), -6, 340)],
               marker: g.marker, gloss: g.gloss };
    }
    const entry = lookup(g.sign || g.gloss);
    if (entry) {
      return { text: label, kind: 'sign', frames: entry.frames, two: entry.two,
               face: entry.face, palm: entry.palm, marker: g.marker, gloss: g.gloss };
    }
    return { text: label, kind: 'spell', letters: g.gloss.replace(/[^A-Z0-9]/g, '').split(''),
             marker: g.marker, gloss: g.gloss };
  });
  return { tokens, trace, english, type };
}

// The clause marker drives brows and head; the sign's own face drives mouth
// and affect. compose() merges the two channels.
function resolveFaces(tokens) {
  for (const tok of tokens) {
    const composed = compose(tok.marker, tok.face);
    tok.faceObj = composed.face;
    tok.markerLabel = composed.label;
  }
  return tokens;
}

function buildTimeline(text) {
  const tl = new Timeline();
  const { tokens, trace, english, type } = tokenize(text);
  resolveFaces(tokens);
  for (const tok of tokens) {
    if (tok.kind === 'sign') {
      tl.add(tok.frames, tok.text, 'sign', tok.faceObj, tok.markerLabel, tok.palm);
    } else {
      const frames = [];
      for (const ch of tok.letters) {
        if (FINGERSPELL_MOTION[ch]) frames.push(...FINGERSPELL_MOTION[ch]);
        else if (POSES[ch]) {
          const r = POSES[ch].r === undefined ? -6 : POSES[ch].r;
          frames.push(kf(ch, at('spell', 8, -24), r, 300));
        }
      }
      if (frames.length) tl.add(frames, tok.text, 'spell', tok.faceObj, tok.markerLabel);
    }
  }
  /* Always end on a neutral rest, including when nothing in the input could be
   * signed at all — "the", "is", a stray "?" are dropped wholesale by the gloss
   * layer. Both callers used to bail out on an empty timeline, which left the
   * avatar holding whatever it had last been asked to do; `signed` lets them
   * tell the user nothing matched while the figure still returns to neutral. */
  const signed = tl.keys.length > 0;
  tl.add([kf('REST', A_.rest, 168, signed ? 200 : 260)], '', 'rest', 'neutral', '', PALM_REST);
  return { tl, tokens, trace, english, type, signed };
}

/* ---------------------------------------------------------------- *
 * UI
 * ---------------------------------------------------------------- */

const NO_EL = {
  textContent: '', innerHTML: '', value: '', disabled: false, scrollTop: 0, scrollHeight: 0,
  dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
  addEventListener() {}, appendChild() {},
};
// Every panel is optional — a stripped-down page must not break the pipeline.
const $ = (id) => document.getElementById(id) || NO_EL;

const player = new Player($('stage'));
const state = { queue: [], tokens: [], listening: false };

function renderPlan(tokens) {
  const host = $('plan');
  host.innerHTML = '';
  tokens.forEach((t, i) => {
    const el = document.createElement('span');
    el.className = 'chip ' + (t.kind === 'sign' ? 'chip-sign' : 'chip-spell');
    el.dataset.idx = i;
    el.textContent = t.text;
    const tag = document.createElement('em');
    const kind = t.kind === 'sign' ? (t.two ? 'sign · 2-handed' : 'sign') : 'fingerspelled';
    const marker = t.markerLabel;
    tag.textContent = marker ? kind + ' · ' + marker : kind;
    el.appendChild(tag);
    host.appendChild(el);
  });
  if (!tokens.length) host.innerHTML = '<span class="muted">Nothing to sign yet.</span>';
}

function highlight(idx) {
  document.querySelectorAll('#plan .chip').forEach((el) => {
    el.classList.toggle('active', Number(el.dataset.idx) === idx);
  });
  const tok = state.tokens[idx];
  $('now').textContent = tok ? tok.text : '—';
  $('nowKind').textContent = tok ? (tok.kind === 'sign' ? 'lexical sign' : 'fingerspelling') : '';
  const marker = tok ? tok.markerLabel : '';
  $('nowFace').textContent = marker ? '☺ ' + marker : '';
}

function signText(text, { append } = {}) {
  const trimmed = (text || '').trim();
  if (!trimmed) return;
  if (append && player.playing) {
    state.queue.push(trimmed);
    $('status').textContent = `queued (${state.queue.length})`;
    return;
  }
  const built = buildTimeline(trimmed);
  const { tl, tokens } = built;
  state.tokens = tokens;
  renderPlan(tokens);
  renderGloss(built);
  player.setTimeline(tl);
  player.play();
  $('status').textContent = built.signed ? 'signing…' : 'nothing signable in that input';
}

/* Listening view: the stage expands to 80% of the viewport and returns to its
 * previous size when listening stops. The sizing itself is CSS in vw/vh, so it
 * follows the window with no measuring here and no resize bookkeeping; the one
 * thing script must do is tell the renderer, because changing a class resizes
 * the canvas without firing a window resize event. Player.resize() is already
 * bound to window resize (hand.js), so the responsive case is covered. */
function setExpanded(on) {
  const panel = $('stagePanel');
  panel.classList.toggle('expanded', on);
  const veil = $('veil');
  if (veil !== NO_EL) veil.hidden = !on;
  // A frame for layout to settle before measuring the canvas.
  requestAnimationFrame(() => player.resize());
}

player.onItem = (idx) => highlight(idx);
player.onEnd = () => {
  highlight(-1);
  if (state.queue.length) signText(state.queue.shift());
  else $('status').textContent = state.listening ? 'listening…' : 'idle';
};

/* ---------------------------------------------------------------- *
 * Speech recognition
 * ---------------------------------------------------------------- */

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null;

/* Noise cancellation.
 *
 * Two mechanisms, because the Web Speech API captures the microphone inside
 * the browser and hands the page neither the audio nor a way to configure it.
 * Nothing here can filter what the recogniser actually transcribes.
 *
 *   1. The capture the page *does* control is opened with the browser's noise
 *      suppression, echo cancellation and gain control switched on, and held
 *      open for as long as we are listening. Whether the recogniser ends up
 *      sharing that processed device capture is up to the browser and the
 *      platform; the API guarantees nothing either way, so this is written to
 *      fail open — if the stream cannot be opened, listening still works.
 *   2. Whatever the recogniser hears, results below a confidence floor are
 *      dropped instead of being signed. This is the half that reliably helps:
 *      a noisy room does not produce silence, it produces plausible-looking
 *      nonsense, and low confidence is the only signal the page gets about it.
 */
const MIC_CONSTRAINTS = {
  audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true },
};
const CONFIDENCE_FLOOR = 0.55;
let micStream = null;

async function openProcessedMic() {
  if (micStream) return;
  const md = navigator.mediaDevices;
  if (!md || !md.getUserMedia) return;
  try {
    micStream = await md.getUserMedia(MIC_CONSTRAINTS);
    // Report what the browser actually honoured rather than what was asked
    // for — these constraints are advisory and some platforms ignore them.
    const track = micStream.getAudioTracks()[0];
    const got = track && track.getSettings ? track.getSettings() : {};
    if (got.noiseSuppression === false) {
      $('micNote').textContent =
        'Listening. This device does not support noise cancellation, so noisy '
        + 'input is filtered by confidence instead.';
    }
  } catch (err) {
    // Recognition has its own capture and works without this.
    micStream = null;
  }
}

function closeProcessedMic() {
  if (!micStream) return;
  for (const track of micStream.getTracks()) track.stop();
  micStream = null;
}

function setupRecognition() {
  if (!SR) {
    $('mic').disabled = true;
    $('micNote').textContent =
      'Speech recognition is unavailable in this browser. Use Chrome (or Edge) and the text box below.';
    return;
  }
  recog = new SR();
  recog.continuous = true;
  recog.interimResults = true;
  recog.lang = $('lang').value;

  recog.onstart = () => {
    state.listening = true;
    setExpanded(true);
    $('mic').classList.add('live');
    $('mic').textContent = '■ Stop listening';
    $('status').textContent = 'listening…';
  };

  recog.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) {
        const said = r[0].transcript.trim();
        // Chrome reports 0 for confidence it has not scored; only an actual
        // low score is treated as noise, so an unscored result is still signed.
        const conf = r[0].confidence;
        if (said && conf > 0 && conf < CONFIDENCE_FLOOR) {
          $('status').textContent = 'ignored — too noisy to make out';
        } else if (said) {
          appendTranscript(said);
          signText(said, { append: true });
        }
      } else {
        interim += r[0].transcript;
      }
    }
    $('interim').textContent = interim;
  };

  recog.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      $('micNote').textContent =
        'Microphone permission was denied. Allow it in the address bar, then try again.';
    } else if (e.error === 'no-speech') {
      return;
    } else {
      $('status').textContent = 'speech error: ' + e.error;
    }
  };

  recog.onend = () => {
    if (state.listening) {
      // Chrome stops the stream periodically; restart to stay continuous.
      try {
        recog.start();
        return;
      } catch (_) {
        /* fall through */
      }
    }
    state.listening = false;
    closeProcessedMic();
    setExpanded(false);
    $('mic').classList.remove('live');
    $('mic').textContent = '● Start listening';
    $('status').textContent = player.playing ? 'signing…' : 'idle';
  };
}

function appendTranscript(said) {
  const box = $('transcript');
  const line = document.createElement('div');
  line.className = 'line';
  line.textContent = said;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

$('mic').addEventListener('click', async () => {
  if (!recog) return;
  if (state.listening) {
    state.listening = false;
    recog.stop();
    closeProcessedMic();
  } else {
    // Opened before recognition starts, so the device is already initialised
    // with the filters on rather than being reconfigured underneath it.
    await openProcessedMic();
    try {
      recog.lang = $('lang').value;
      recog.start();
    } catch (_) {
      /* already started */
    }
  }
});

// The expanded stage covers the main mic button, so it carries its own stop.
$('stopBig').addEventListener('click', () => {
  if (!recog || !state.listening) return;
  state.listening = false;
  recog.stop();
  closeProcessedMic();
  setExpanded(false);
});

$('lang').addEventListener('change', () => {
  if (recog) recog.lang = $('lang').value;
});

$('signBtn').addEventListener('click', () => {
  signText($('input').value);
});

$('input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    signText($('input').value);
  }
});

$('replay').addEventListener('click', () => {
  if (!player.timeline.keys.length) return;
  player.seek(0);
  player.play();
});

$('speed').addEventListener('input', (e) => {
  player.speed = Number(e.target.value);
  $('speedVal').textContent = player.speed.toFixed(2) + '×';
});

document.querySelectorAll('.example').forEach((b) => {
  b.addEventListener('click', () => {
    $('input').value = b.textContent;
    signText(b.textContent);
  });
});

function renderGloss(built) {
  $('english').textContent = built.english;
  $('gloss').textContent = built.tokens.map((t) => t.text).join('  ') +
    (built.type === 'yn' || built.type === 'wh' ? '  ?' : '');
  const host = $('rules');
  host.innerHTML = '';
  if (!built.trace.length) {
    host.innerHTML = '<li class="muted">No rewriting needed.</li>';
    return;
  }
  for (const r of built.trace) {
    const li = document.createElement('li');
    const b = document.createElement('b');
    b.textContent = r.rule;
    li.appendChild(b);
    li.appendChild(document.createTextNode(' — ' + r.detail));
    host.appendChild(li);
  }
}

/* Vocabulary panel — aliases are listed too, since they are words you can say */
(function renderVocab() {
  const names = Object.keys(VOCAB).sort();
  $('vocab').textContent = names.join(' · ');
  $('vocabCount').textContent = names.length;
})();

window.SLApp = { buildTimeline, tokenize, signText, player, toGloss };

setupRecognition();
player.draw();
$('speedVal').textContent = '1.00×';

/* Deep link: ?text=hello%20world signs on load; &t=1200 freezes at that ms. */
(function fromUrl() {
  const q = new URLSearchParams(location.search);
  const text = q.get('text');
  if (!text) return;
  $('input').value = text;
  const built = buildTimeline(text);
  const { tl, tokens } = built;
  state.tokens = tokens;
  renderPlan(tokens);
  renderGloss(built);
  player.setTimeline(tl);
  const freeze = q.get('t');
  if (freeze !== null) {
    player.seek(Number(freeze));
    highlight(tl.itemAt(Number(freeze)));
    $('status').textContent = 'frame @ ' + freeze + 'ms';
  } else {
    player.play();
  }
})();

})();
