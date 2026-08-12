#!/usr/bin/env bash
# Inline every script into one self-contained HTML file, for hosting somewhere
# that can only serve a single page.
#
#   ./build-standalone.sh [outfile]
#
# The output omits <!doctype>, <html>, <head> and <body> because the Artifact
# host supplies those. The 3D renderer is left out: it is an ES module that
# loads Three.js from vendor/, so it cannot be inlined into one file.
set -e
cd "$(dirname "$0")"
exec python3 build-standalone.py "$@"
