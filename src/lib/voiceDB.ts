/**
 * voiceDB.ts
 * 목소리 분석 결과의 타입.
 *
 * 예전에는 분석할 때마다 원본 녹음을 IndexedDB('voice-history')에 저장했다. 아무 화면도 읽지 않았고,
 * "녹음은 저장하지 않아요"라는 안내와 어긋나서 2026-10-27에 저장을 멈추고 남은 것을 지운다.
 */

export interface VoiceEmotion {
  name: string
  score: number
}

export interface AudioFeatures {
  duration_sec: number
  sample_rate: number
  pitch: {
    mean_hz: number
    min_hz: number
    max_hz: number
    std_hz: number
    voiced_ratio: number
  }
  energy: {
    rms_mean: number
    rms_std: number
    db_mean: number
    db_max: number
    db_min: number
    db_range: number
  }
  spectral: {
    centroid_mean_hz: number
    centroid_std_hz: number
    bandwidth_mean_hz: number
    rolloff_mean_hz: number
    flatness_mean: number
    contrast_mean_db: number
  }
  mfccs: Record<string, number>
  zero_crossing: { mean: number; std: number }
  rhythm: { tempo_bpm: number; onset_count: number; onsets_per_second: number; articulation_rate?: number }
  voice_quality: {
    jitter_abs_ms: number
    jitter_rel_pct: number
    shimmer_abs: number
    shimmer_rel_pct: number
    source: 'praat' | 'frame'
    task?: 'vowel' | 'speech'
  }
  hnr_db: number
}

/** 예전에 기기에 쌓인 원본 녹음을 지운다. 이미 없으면 아무 일도 하지 않는다. */
export function clearStoredRecordings() {
  try {
    if (localStorage.getItem(CLEARED_KEY)) return
    const req = indexedDB.deleteDatabase('voice-history')
    req.onsuccess = () => { try { localStorage.setItem(CLEARED_KEY, '1') } catch { /* noop */ } }
  } catch { /* 저장소를 못 쓰는 브라우저 */ }
}

const CLEARED_KEY = 'mytoneRecordingsCleared'
