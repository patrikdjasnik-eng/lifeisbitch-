"""Render original arrangements over Holizna CC0 melodies. Requires numpy, scipy, ffmpeg.
Usage: python tools/render-cloud-pack.py SOURCE_DIRECTORY OUTPUT_DIRECTORY
Source files: Freesound public HQ previews 852260.mp3, 852261.mp3, 852259.mp3.
See web/audio/CREDITS.md for source URLs and permissions.
"""
import pathlib
import subprocess
import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

sampleRate = 44100
sourceDir, outputDir = map(pathlib.Path, sys.argv[1:3])
outputDir.mkdir(parents=True, exist_ok=True)
for number, (sourceId, bpm, root, name) in enumerate([
  (852260, 130, 46.2493, 'zizkov-afterhours'),
  (852261, 140, 34.6478, 'vinohrady-clouds'),
  (852259, 150, 41.2034, 'nocni-linka')
]):
  rng = np.random.default_rng(500 + number)
  raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(sourceDir / f'{sourceId}.mp3'), '-f', 'f32le', '-ac', '2', '-ar', str(sampleRate), '-'])
  melody = np.frombuffer(raw, dtype='<f4').reshape(-1, 2)
  beat = 60 / bpm
  loopSize = round(beat * 32 * sampleRate)
  melody = melody[:loopSize]
  if len(melody) < loopSize:
    melody = np.pad(melody, ((0, loopSize-len(melody)), (0, 0)))
  melody = signal.sosfilt(signal.butter(2, 140, 'highpass', fs=sampleRate, output='sos'), melody, axis=0)
  # Short edge fades keep repeated preview loops free of clicks.
  edge = round(.008 * sampleRate)
  melody[:edge] *= np.linspace(0, 1, edge)[:, None]
  melody[-edge:] *= np.linspace(1, 0, edge)[:, None]
  count = loopSize * 8
  mix = np.tile(melody, (8, 1)).astype(np.float32) * .48
  for cycle in [0, 4, 7]:
    mix[cycle * loopSize:(cycle + 1) * loopSize] *= .72
  def add(sound, when, gain=1, pan=0):
    start = round(when * sampleRate)
    end = min(count, start + len(sound))
    if start < 0 or start >= count:
      return
    mix[start:end] += sound[:end-start, None] * gain * np.array([1-max(0, pan), 1+min(0, pan)])
  def tone(duration, frequency, decay, pitchDrop=0):
    t = np.arange(round(duration * sampleRate)) / sampleRate
    phase = np.cumsum(frequency + pitchDrop * np.exp(-t * 45)) * 2 * np.pi / sampleRate
    env = np.minimum(t / .004, 1) * np.exp(-t * decay) * np.minimum((duration-t) / .025, 1)
    return np.sin(phase) * env
  kick = tone(.24, 49, 19, 125)
  noise = rng.normal(0, 1, round(.22 * sampleRate))
  snare = signal.sosfilt(signal.butter(2, [1100, 9000], 'bandpass', fs=sampleRate, output='sos'), noise)
  snare *= np.exp(-np.arange(len(noise)) / sampleRate * 26)
  snare += tone(.22, 185, 24) * .25
  hatNoise = rng.normal(0, 1, round(.12 * sampleRate))
  hat = signal.sosfilt(signal.butter(2, 8500, 'highpass', fs=sampleRate, output='sos'), hatNoise)
  hat *= np.exp(-np.arange(len(hat)) / sampleRate * 70)
  for bar in range(64):
    # Intro, breakdown and outro leave room for the atmospheric melody.
    if bar < 4 or 32 <= bar < 36 or bar >= 60:
      continue
    base = bar * beat * 4
    kicks = [0, 1.5, 3.25] if (bar+number) % 2 else [0, 2.75]
    if bar % 8 == 7:
      kicks = [0, 1.75, 3, 3.5]
    for at in kicks:
      add(kick, base + at * beat, .48)
      semi = [0, 0, -2, -5][(bar // 2) % 4]
      bass = np.tanh(tone(beat * .9, root * 2 ** (semi/12), 2.8) * 1.5) * .27
      add(bass, base + at * beat)
    add(snare, base + 2 * beat, .26)
    for step in range(8):
      at = step * .5 + (.035 if step % 2 else 0)
      add(hat, base + at * beat, .105 if step % 2 == 0 else .067, (-1 if step % 2 else 1) * .23)
    if bar % 4 == 3:
      for at in [3.5, 3.6667, 3.8333]:
        add(hat, base + at * beat, .075, .25)
  fade = round(beat * 4 * sampleRate)
  mix[:fade] *= np.linspace(0, 1, fade)[:, None]
  mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
  mix *= .87 / max(.01, float(np.max(np.abs(mix))))
  wavfile.write(outputDir / f'{name}.wav', sampleRate, mix.astype(np.float32))
  print(name, round(count/sampleRate, 2), flush=True)
