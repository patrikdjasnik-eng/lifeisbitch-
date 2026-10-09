# Street Life — offline radio

Downloaded and license pages checked 2026-10-09. All third-party recordings and melody samples below were published by their uploaders under CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/

## Old School

- **Holizna**: Tension In The Air, CobWebs, Haunted Houses.
  Source and CC0 declaration: https://opengameart.org/content/horror-beats-collection
  Download: https://opengameart.org/sites/default/files/horror_beats.zip
- **Gichco** (OpenGameArt uploader: obscure music): Prophesy of Domination.
  Source and public-domain / CC0 declaration: https://opengameart.org/content/instrumental-hip-hop-theme
  Download: https://opengameart.org/sites/default/files/prophesy%20of%20domination%20%28promodj.com%29.mp3

These four complete tracks were only transcoded and loudness-normalized, not composed by the studio.

## Cloud Trap — Noční Praha

Original game arrangements, using melody samples by **Holizna**, synthesized drums and bass, prepared for Street Life with code assistance:

| Game track | Tempo | CC0 melody source |
| --- | --- | --- |
| Žižkov Afterhours | 130 BPM | Dark Trap #1 F#min — https://freesound.org/people/holizna/sounds/852260/ |
| Vinohrady Clouds | 140 BPM | Dark Trap Loop #2 C#min — https://freesound.org/people/holizna/sounds/852261/ |
| Noční linka | 150 BPM | Blood Money Trap Loop Emin — https://freesound.org/people/holizna/sounds/852259/ |

Public HQ preview downloads (same CC0 sounds):
- https://cdn.freesound.org/previews/852/852260_12574855-hq.mp3
- https://cdn.freesound.org/previews/852/852261_12574855-hq.mp3
- https://cdn.freesound.org/previews/852/852259_12574855-hq.mp3

The first eight bars are used as the melody loop, with an intro, breakdown, outro and varied drum patterns. These are new arrangements, not official JONNY5 songs, a licensed JONNY5 pack, or an artist endorsement. No JONNY5 or Mobb Deep recordings are included. CC0 applies to the source material; the game's existing project terms govern its new arrangement/code contributions.

## Reproduction and packaging

`tools/render-cloud-pack.py` renders the three arrangements using Python, NumPy, SciPy and FFmpeg. Supply the three numbered MP3 previews in its source directory. `tools/encode-radio.py` normalizes and encodes the full collection; its input directory also needs `tension.mp3`, `cobwebs.mp3`, `haunted.mp3`, `gichco.mp3` and the three generated WAV files.

Bundled audio is stereo MP3, 44.1 kHz, 112 kbps, normalized with FFmpeg `loudnorm=I=-18:TP=-1.5:LRA=11`. The manifest `web/radio-tracks.js` records duration, size and SHA-256 of each final file. Playback uses packaged local files only, with no streaming service, runtime download or external music account.
