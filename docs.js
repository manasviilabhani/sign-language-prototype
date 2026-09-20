/* docs.js — pull signable text out of an uploaded file
 *
 * Extraction only: nothing here knows what a sign is, touches the DOM, or
 * decides what gets signed. app.js owns that. This file's whole job is
 * file in, plain sentences out.
 *
 * .docx is unzipped here rather than through a library. A .docx is a ZIP with
 * the text in word/document.xml, and the browser can already inflate a deflate
 * stream — DecompressionStream has been in Chrome since 103, and this app
 * already requires Chrome for the Web Speech API. So the cost is a central
 * directory walk, about sixty lines, against a megabyte of dependency for a
 * project whose entire point is that you can read it.
 */

(function () {
'use strict';

/* ---------------------------------------------------------------- *
 * ZIP — only enough of it to reach one known file
 * ---------------------------------------------------------------- */

/* The End of Central Directory record is last in the file, but it ends with a
 * variable-length comment, so it has to be found by scanning backwards for its
 * signature rather than read from a fixed offset. */
function findEOCD(view) {
  const max = Math.min(view.byteLength, 65557);      // 64K comment + 22 header
  for (let i = view.byteLength - 22; i >= view.byteLength - max; i--) {
    if (i >= 0 && view.getUint32(i, true) === 0x06054b50) return i;
  }
  return -1;
}

async function unzipOne(buffer, wanted) {
  const view = new DataView(buffer);
  const eocd = findEOCD(view);
  if (eocd < 0) throw new Error('not a zip file');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);           // start of central directory

  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('bad zip directory');
    const method = view.getUint16(p + 10, true);
    const compressed = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localAt = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(buffer, p + 46, nameLen));

    if (name === wanted) {
      /* The local header repeats the name and extra fields at different
       * lengths from the central directory's, so the data offset has to come
       * from the local header — using the central copy lands mid-stream. */
      const lNameLen = view.getUint16(localAt + 26, true);
      const lExtraLen = view.getUint16(localAt + 28, true);
      const start = localAt + 30 + lNameLen + lExtraLen;
      const bytes = new Uint8Array(buffer, start, compressed);
      if (method === 0) return new TextDecoder().decode(bytes);
      if (method !== 8) throw new Error('unsupported compression in zip');
      const stream = new Blob([bytes]).stream()
        .pipeThrough(new DecompressionStream('deflate-raw'));
      return await new Response(stream).text();
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('no ' + wanted + ' in this file');
}

/* ---------------------------------------------------------------- *
 * Formats
 * ---------------------------------------------------------------- */

/* Word's XML down to text. Paragraph and line-break elements become newlines
 * before the tags are stripped, because otherwise every paragraph runs into
 * the next one and the sentence splitter sees one enormous sentence. */
function docxToText(xml) {
  return xml
    .replace(/<w:p[ >]/g, '\n<w:p ')
    .replace(/<w:br\s*\/?>/g, '\n')
    .replace(/<w:tab\s*\/?>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

const TEXT_EXT = /\.(txt|md|markdown|csv|text|log)$/i;

async function extract(file) {
  const name = file.name || '';
  if (TEXT_EXT.test(name) || file.type === 'text/plain') {
    return await file.text();
  }
  if (/\.docx$/i.test(name)) {
    return docxToText(await unzipOne(await file.arrayBuffer(), 'word/document.xml'));
  }
  /* .doc is not .docx: the old binary format needs a wholly different parser,
   * and PDF needs a real one — a PDF has no reading order, only glyphs at
   * coordinates, so pulling sentences out of it means shipping pdf.js. Both
   * are refused by name rather than half-attempted, because a parser that
   * returns plausible rubbish is worse here than one that declines. */
  if (/\.pdf$/i.test(name)) throw new Error('PDF needs pdf.js, which is not bundled — save as .docx or .txt');
  if (/\.doc$/i.test(name)) throw new Error('old .doc format is not supported — save as .docx or .txt');
  throw new Error('unsupported file type — use .txt, .md or .docx');
}

/* ---------------------------------------------------------------- *
 * Sentences
 * ---------------------------------------------------------------- */

/* A sentence is one unit of signing, because the gloss rules work over a
 * clause: tense, topicalisation and marker scope are all sentence-level, and
 * feeding the whole document in at once would produce one absurd gloss with a
 * single brow raise over it.
 *
 * Abbreviations are the usual trap for a full-stop split. The list is short on
 * purpose — this is a speech-to-sign demo, and a missed split costs one
 * run-on sentence, not a crash. */
const ABBREV = /\b(mr|mrs|ms|dr|prof|st|jr|sr|vs|etc|e\.g|i\.e|fig|no|approx)\.$/i;

function sentences(text) {
  const out = [];
  for (const block of String(text || '').split(/\n+/)) {
    const line = block.replace(/\s+/g, ' ').trim();
    if (!line) continue;
    let buf = '';
    for (const piece of line.split(/(?<=[.!?])\s+/)) {
      buf = buf ? buf + ' ' + piece : piece;
      if (ABBREV.test(buf)) continue;              // the stop was an abbreviation
      out.push(buf);
      buf = '';
    }
    if (buf) out.push(buf);
  }
  /* Anything with no letters in it — a page number, a row of dashes, a bare
   * bullet — has nothing to sign and would just be fingerspelled as noise. */
  return out.map((s) => s.trim()).filter((s) => /[a-z]/i.test(s));
}

window.SLDoc = { extract, sentences };

})();
