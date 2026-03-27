#!/usr/bin/env python3
"""
Audio feature extraction using librosa + scipy.
Usage: python3 analyze_audio.py <audio_file_path>
Outputs: JSON to stdout
"""

import sys
import json
import warnings
import numpy as np

warnings.filterwarnings('ignore')


def extract_features(file_path: str) -> dict:
    import librosa
    import scipy.signal

    y, sr = librosa.load(file_path, sr=None, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)

    # ── Pitch (F0) ─────────────────────────────────────────
    f0, voiced_flag, _ = librosa.pyin(
        y,
        fmin=librosa.note_to_hz('C2'),
        fmax=librosa.note_to_hz('C7'),
        sr=sr,
    )
    voiced_f0 = f0[voiced_flag & ~np.isnan(f0)]

    if len(voiced_f0) > 0:
        pitch = {
            'mean_hz': float(np.mean(voiced_f0)),
            'min_hz': float(np.min(voiced_f0)),
            'max_hz': float(np.max(voiced_f0)),
            'std_hz': float(np.std(voiced_f0)),
            'voiced_ratio': float(np.sum(voiced_flag) / len(voiced_flag)),
        }
    else:
        pitch = {'mean_hz': 0, 'min_hz': 0, 'max_hz': 0, 'std_hz': 0, 'voiced_ratio': 0}

    # ── RMS / dB Energy ────────────────────────────────────
    rms = librosa.feature.rms(y=y)[0]
    rms_db = librosa.amplitude_to_db(rms, ref=np.max)

    energy = {
        'rms_mean': float(np.mean(rms)),
        'rms_std': float(np.std(rms)),
        'db_mean': float(np.mean(rms_db)),
        'db_max': float(np.max(rms_db)),
        'db_min': float(np.min(rms_db)),
        'db_range': float(np.max(rms_db) - np.min(rms_db)),
    }

    # ── Spectral features ──────────────────────────────────
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85)[0]
    flatness = librosa.feature.spectral_flatness(y=y)[0]
    contrast = librosa.feature.spectral_contrast(y=y, sr=sr)

    spectral = {
        'centroid_mean_hz': float(np.mean(centroid)),
        'centroid_std_hz': float(np.std(centroid)),
        'bandwidth_mean_hz': float(np.mean(bandwidth)),
        'rolloff_mean_hz': float(np.mean(rolloff)),
        'flatness_mean': float(np.mean(flatness)),
        'contrast_mean_db': float(np.mean(contrast)),
    }

    # ── MFCCs (13 coefficients) ────────────────────────────
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfccs = {f'mfcc_{i+1}': float(np.mean(mfcc[i])) for i in range(13)}

    # ── Zero Crossing Rate ─────────────────────────────────
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    zero_crossing = {
        'mean': float(np.mean(zcr)),
        'std': float(np.std(zcr)),
    }

    # ── Tempo / Speaking rate ──────────────────────────────
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr)

    rhythm = {
        'tempo_bpm': float(tempo) if np.isscalar(tempo) else float(tempo[0]),
        'onset_count': int(len(onsets)),
        'onsets_per_second': float(len(onsets) / duration) if duration > 0 else 0,
    }

    # ── Jitter (pitch period perturbation) ────────────────
    if len(voiced_f0) > 1:
        periods = 1.0 / voiced_f0
        jitter_abs = float(np.mean(np.abs(np.diff(periods))))
        jitter_rel = float(jitter_abs / np.mean(periods)) if np.mean(periods) > 0 else 0
    else:
        jitter_abs, jitter_rel = 0.0, 0.0

    # ── Shimmer (amplitude perturbation) ──────────────────
    if len(rms) > 1:
        shimmer_abs = float(np.mean(np.abs(np.diff(rms))))
        shimmer_rel = float(shimmer_abs / np.mean(rms)) if np.mean(rms) > 0 else 0
    else:
        shimmer_abs, shimmer_rel = 0.0, 0.0

    voice_quality = {
        'jitter_abs_ms': jitter_abs * 1000,
        'jitter_rel_pct': jitter_rel * 100,
        'shimmer_abs': shimmer_abs,
        'shimmer_rel_pct': shimmer_rel * 100,
    }

    # ── HNR (Harmonics-to-Noise Ratio via autocorrelation) ─
    frame_length = int(0.025 * sr)
    hop_length = int(0.010 * sr)
    frames = librosa.util.frame(y, frame_length=frame_length, hop_length=hop_length)
    hnr_values = []
    for frame in frames.T:
        ac = np.correlate(frame, frame, mode='full')
        ac = ac[len(ac) // 2:]
        if ac[0] <= 0:
            continue
        ac = ac / ac[0]
        peaks, _ = scipy.signal.find_peaks(ac[1:], height=0)
        if len(peaks) > 0:
            r = float(ac[peaks[0] + 1])
            r = max(min(r, 0.9999), -0.9999)
            hnr_values.append(10 * np.log10(r / (1 - r)))

    hnr = float(np.mean(hnr_values)) if hnr_values else 0.0

    return {
        'duration_sec': float(duration),
        'sample_rate': int(sr),
        'pitch': pitch,
        'energy': energy,
        'spectral': spectral,
        'mfccs': mfccs,
        'zero_crossing': zero_crossing,
        'rhythm': rhythm,
        'voice_quality': voice_quality,
        'hnr_db': hnr,
    }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No file path provided'}))
        sys.exit(1)

    try:
        result = extract_features(sys.argv[1])
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
