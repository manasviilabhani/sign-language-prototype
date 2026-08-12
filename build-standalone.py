#!/usr/bin/env python3
"""Assemble index.html and its scripts into one self-contained page.

Run it through build-standalone.sh, or directly:  python3 build-standalone.py [outfile]

The page keeps index.html's own palette and markup untouched. Two things change,
both forced by hosting the page inside a viewer that owns the theme:

  * the dark palette is also emitted under `:root[data-theme="dark"]`, and the
    media query is guarded with `:not([data-theme="light"])`, so a reader who
    explicitly picks a theme gets it whichever way their OS is set. As written,
    index.html reads `prefers-color-scheme` alone, so an explicit choice that
    disagrees with the OS is ignored.
  * <!doctype>, <html>, <head> and <body> are dropped; the host supplies them.

The 3D renderer is left out — it is an ES module pulling Three.js from vendor/,
so it cannot be inlined. The flat renderer is the default view anyway.
"""

import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
SCRIPTS = ['signs.js', 'asl.js', 'face.js', 'hand.js', 'app.js', 'flat.js']
TITLE = 'Voice → Sign Language'


def fail(msg):
    sys.exit('build-standalone: ' + msg)


def slice_between(text, start_pat, end_pat, what):
    start = re.search(start_pat, text, re.M)
    if not start:
        fail('could not find the start of %s in index.html' % what)
    end = re.search(end_pat, text[start.start():], re.M)
    if not end:
        fail('could not find the end of %s in index.html' % what)
    return text[start.start():start.start() + end.end()]


def theme_aware(style):
    """Re-key the dark palette off the theme stamp as well as the OS setting."""
    m = re.search(
        r'@media \(prefers-color-scheme: dark\) \{\s*:root \{(.*?)\}\s*\}',
        style, re.S)
    if not m:
        fail('could not find the dark-theme block in index.html')
    tokens = m.group(1).rstrip()
    patched = (
        '@media (prefers-color-scheme: dark) {\n'
        '    :root:not([data-theme="light"]) {%s}\n'
        '  }\n'
        '  :root[data-theme="dark"] {%s}' % (tokens, tokens)
    )
    return style[:m.start()] + patched + style[m.end():]


def main():
    out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / 'standalone.html'
    index = (HERE / 'index.html').read_text()

    style = theme_aware(slice_between(index, r'^<style>', r'^</style>', 'the stylesheet'))
    body = slice_between(index, r'^<div class="wrap">', r'^</div>$', 'the page body')

    parts = ['<title>%s</title>' % TITLE, style, body]
    for name in SCRIPTS:
        src = HERE / name
        if not src.exists():
            fail('missing script %s' % name)
        parts.append('<script>\n%s\n</script>' % src.read_text().rstrip())

    page = '\n'.join(parts) + '\n'

    leaked = re.search(r'<!doctype|<html\b|<head\b|<body\b', page, re.I)
    if leaked:
        fail('document scaffolding leaked into the output: %s' % leaked.group(0))
    if re.search(r'\bsrc=["\']', page):
        fail('an external script or asset reference survived inlining')

    out.write_text(page)
    print('wrote %s (%d bytes)' % (out, len(page.encode())))


if __name__ == '__main__':
    main()
