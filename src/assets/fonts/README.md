These nine WOFF subsets contain the font outlines from AstrofluxClient's original
`src/assets/fonts/qolaf-japanese-*.swf` files (revision
`b7a4f5cba87c8af9c484339de4ecf0dec0d4d890`). They are Noto Sans CJK-derived
subsets; the original OFL license is included here.

Rebuild with `python scripts/ExportJapaneseFonts.py /path/to/AstrofluxClient/src/assets/fonts`.
JPEXS exports the SWF DefineFont3 glyphs to TrueType; fontTools repackages those
same outlines as WOFF. The original kana bitmap atlas remains separate.

A headless Firefox check loaded all nine subsets and measured representative
glyphs at the source's 42px size. Runtime layout keeps the source's 48px baseline,
56px cells, three normal cache pages, reference protection and LRU eviction.
Browser rasterization still requires comparison against Flash at screenshot level.
