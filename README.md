# Vice Frame

![make.fun bounty](https://make.fun/badge/gta6-cover-art-01.svg)
![rank](https://make.fun/badge/gta6-cover-art-01/bdgpride/vice-frame/rank.svg)
![reward](https://make.fun/badge/gta6-cover-art-01/bdgpride/vice-frame/reward.svg)

**Vice Frame** turns a photo and a caption into cover art in the style of GTA 6's
posters — the multi-panel cover look, bold lettering and a Vice City sunset or neon
colour grade — and exports it as a PNG to share. It is an entry in make.fun's
[Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01) bounty.

The app is plain static files under `app/`: it opens in a desktop browser, works fully
offline, and never uploads anything — your photos are read and graded on your own
machine.

## Use it

```sh
node serve.ts   # then open http://localhost:8080
```

1. **Photo** — upload one, drag it onto the cover, or start from a bundled sample.
   It lands already framed in the Collage layout, so you are one click from an export.
2. **Layout** — Collage (a tall hero panel with a diagonal edge and three stacked
   cuts), Duo, Trio or Solo.
3. **Colour grade** — Vice Sunset, Neon Nights, Poster Ink or Golden Hour. Each is
   real per-pixel canvas work (saturation, an S-curve, split toning, a posterize for
   Poster Ink), baked into the export, never a CSS filter.
4. **Caption** — a big title line and a smaller second line, set in Anton and Oswald
   with an ink outline, a hard offset shadow and a teal-to-magenta rule.
5. **Panels** — click a panel to select it, drag inside it to reposition its photo,
   zoom with the slider. Fill several panels with one photo in different crops, or a
   different photo each.
6. **Export PNG** at 1080 × 1080, 1080 × 1350 or 1920 × 1080. One render path draws
   the preview and the export, so what you see is the file you get — finished with a
   vignette, a halftone print texture and a seeded film grain.

## The entry

`main.ts` (Node 22, standard library only) hands the app in: it copies `app/` and
`screenshots/` to the output directory and writes `dossier.json` with
`vendor/makefun-app.ts`, the kit's library, unchanged.

## Licences

The code is MIT (see `LICENSE`). The bundled fonts are under the SIL Open Font
License 1.1: Anton and Oswald, in `app/fonts/` with their licence texts
(`OFL-Anton.txt`, `OFL-Oswald.txt`). The sample photographs in `app/samples/` were
made for make.fun and are free to use. Everything else — the layouts, the grades, the
lettering — is this app's own work; no Rockstar Games logo, artwork or font is used.
