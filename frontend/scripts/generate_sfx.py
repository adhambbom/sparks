#!/usr/bin/env python3
"""
Generate 8-bit / chiptune-style WAV files for the game's SFX library.

Output: /app/frontend/assets/audio/<name>.wav  (16-bit PCM mono, 22050Hz)

These are bundled with the Android/iOS build so SFX play even when the
Web Audio API is unavailable on native devices.
"""
import math
import os
import struct
import wave

SR = 22050  # 22.05kHz — small enough for tiny files, plenty for SFX
OUT = "/app/frontend/assets/audio"
os.makedirs(OUT, exist_ok=True)


def write_wav(name, samples, sr=SR):
    """samples: iterable of floats in [-1, 1]"""
    path = os.path.join(OUT, f"{name}.wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        # clamp & convert to int16
        frames = b"".join(
            struct.pack("<h", max(-32767, min(32767, int(s * 32767))))
            for s in samples
        )
        w.writeframes(frames)
    print(f"  wrote {path}  ({len(samples)/sr*1000:.0f} ms)")


def square(freq, t):
    return 1.0 if math.sin(2 * math.pi * freq * t) >= 0 else -1.0


def sawtooth(freq, t):
    p = (t * freq) % 1.0
    return 2.0 * p - 1.0


def sine(freq, t):
    return math.sin(2 * math.pi * freq * t)


def envelope(i, n, attack=0.01, release=0.5):
    """Linear attack, exponential decay envelope (in seconds)."""
    t = i / SR
    total = n / SR
    if t < attack:
        return t / attack
    rem = total - t
    if rem <= 0:
        return 0.0
    # exponential release from 1.0 down
    return math.exp(-(t - attack) / release) if release > 0 else 1.0


def tone(freq, dur_ms, wave_type="square", vol=0.4, release=None):
    """Generate a single tone with attack/decay envelope."""
    n = int(SR * dur_ms / 1000)
    rel = release if release is not None else dur_ms / 1000.0 * 0.6
    out = []
    for i in range(n):
        t = i / SR
        if wave_type == "square":
            s = square(freq, t)
        elif wave_type == "sawtooth":
            s = sawtooth(freq, t)
        else:
            s = sine(freq, t)
        env = envelope(i, n, attack=0.005, release=rel)
        out.append(s * env * vol)
    return out


def sweep(f_start, f_end, dur_ms, wave_type="sawtooth", vol=0.4):
    """Frequency sweep (exponential) from f_start to f_end."""
    n = int(SR * dur_ms / 1000)
    rel = dur_ms / 1000.0 * 0.5
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SR
        # exponential interpolation between freqs
        ratio = i / max(1, n - 1)
        freq = f_start * ((max(40, f_end) / f_start) ** ratio)
        phase += freq / SR
        if wave_type == "square":
            s = 1.0 if (phase % 1.0) < 0.5 else -1.0
        elif wave_type == "sawtooth":
            s = 2.0 * (phase % 1.0) - 1.0
        else:
            s = math.sin(2 * math.pi * phase)
        env = envelope(i, n, attack=0.005, release=rel)
        out.append(s * env * vol)
    return out


def mix(*tracks):
    """Mix multiple sample lists, padding short ones with zeros."""
    n = max(len(t) for t in tracks)
    out = [0.0] * n
    for t in tracks:
        for i, s in enumerate(t):
            out[i] += s
    # normalize to avoid clipping
    peak = max((abs(s) for s in out), default=1.0)
    if peak > 1.0:
        out = [s / peak for s in out]
    return out


def delay(samples, ms):
    """Prepend `ms` of silence to a sample list."""
    pad = [0.0] * int(SR * ms / 1000)
    return pad + samples


def main():
    print("Generating SFX...")

    # Click — short blip
    write_wav("click", tone(720, 50, "square", 0.3))
    # Confirm — two-tone rising
    write_wav("confirm", mix(tone(880, 60, "square", 0.4),
                              delay(tone(1175, 70, "square", 0.4), 60)))
    # Cancel — low tone
    write_wav("cancel", tone(330, 100, "square", 0.4))
    # Hit — punchy down-sweep
    write_wav("hit", sweep(220, 90, 120, "sawtooth", 0.55))
    # Big hit — heavier, double layer
    write_wav("bigHit", mix(sweep(180, 60, 220, "square", 0.55),
                             delay(sweep(120, 40, 180, "sawtooth", 0.5), 60)))
    # Damage — receiving damage
    write_wav("damage", sweep(440, 110, 180, "square", 0.5))
    # Heal — three rising sine
    write_wav("heal", mix(tone(523, 80, "sine", 0.5),
                           delay(tone(659, 80, "sine", 0.5), 80),
                           delay(tone(784, 100, "sine", 0.5), 160)))
    # Victory — fanfare
    write_wav("victory", mix(tone(523, 100, "square", 0.4),
                              delay(tone(659, 100, "square", 0.4), 100),
                              delay(tone(784, 100, "square", 0.4), 200),
                              delay(tone(1047, 200, "square", 0.5), 300)))
    # Defeat — falling sad
    write_wav("defeat", mix(sweep(440, 100, 400, "sawtooth", 0.5),
                             delay(sweep(220, 50, 500, "sawtooth", 0.4), 200)))
    # Level up — ascending arpeggio
    write_wav("levelUp", mix(tone(523, 80, "square", 0.4),
                              delay(tone(659, 80, "square", 0.4), 80),
                              delay(tone(784, 80, "square", 0.4), 160),
                              delay(tone(1047, 80, "square", 0.4), 240),
                              delay(tone(1319, 200, "square", 0.55), 320)))
    # Encounter — sharp swell
    write_wav("encounter", mix(sweep(880, 220, 250, "square", 0.55),
                                delay(tone(110, 120, "sawtooth", 0.55), 250)))
    # Skill — rising sine sweep
    write_wav("skill", sweep(440, 1320, 200, "sine", 0.5))
    # Boss phase
    write_wav("bossPhase", mix(sweep(1320, 80, 600, "sawtooth", 0.6),
                                delay(tone(60, 300, "square", 0.55), 200)))
    # Buy — cash-register style
    write_wav("buy", mix(tone(880, 60, "sine", 0.5),
                          delay(tone(1320, 80, "sine", 0.5), 70)))
    # Footstep — short metallic clack (low volume; will play on every tile)
    write_wav("footstep", mix(tone(200, 35, "square", 0.18),
                               tone(95, 25, "sawtooth", 0.14)))
    # Drawbridge — heavy chain thud
    write_wav("drawbridge", mix(sweep(220, 70, 380, "sawtooth", 0.55),
                                 delay(tone(50, 220, "square", 0.5), 200)))

    print("Done.")


if __name__ == "__main__":
    main()
