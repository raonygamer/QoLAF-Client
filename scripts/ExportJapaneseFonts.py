#!/usr/bin/env python3
"""Extract the original SWF font outlines and encode browser WOFF subsets.

Requires JPEXS ffdec on PATH and Python fontTools. No font substitution is used.
"""
import argparse
from pathlib import Path
import subprocess
import tempfile
from fontTools.ttLib import TTFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('original_fonts', type=Path)
parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'src/assets/fonts')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='qolaf-fonts-') as directory:
    root = Path(directory)
    for suffix in ('radicals', 'exta1', 'exta2', 'u1', 'u2', 'u3', 'u4', 'u5', 'compat'):
        stem = 'qolaf-japanese-' + suffix
        destination = root / stem
        subprocess.run(['ffdec', '-export', 'font', str(destination), str(args.original_fonts / (stem + '.swf'))], check=True)
        exported = list(destination.rglob('*.ttf'))
        if len(exported) != 1:
            raise RuntimeError(f'{stem}: expected exactly one font, found {len(exported)}')
        font = TTFont(exported[0])
        font.flavor = 'woff'
        font.save(args.output / (stem + '.woff'))
