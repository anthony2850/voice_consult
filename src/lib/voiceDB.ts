/**
 * voiceDB.ts
 * IndexedDB 기반 음성 기록 저장소 (idb 라이브러리 사용)
 *
 * - DB: 'voice-history'  |  Store: 'records'
 * - keyPath: id (timestamp, number)
 */
import { openDB, IDBPDatabase } from 'idb'

const DB_NAME = 'voice-history'
const STORE_NAME = 'records'
const DB_VERSION = 1

// ── 타입 정의 ─────────────────────────────────────────────

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
  rhythm: { tempo_bpm: number; onset_count: number; onsets_per_second: number }
  voice_quality: {
    jitter_abs_ms: number
    jitter_rel_pct: number
    shimmer_abs: number
    shimmer_rel_pct: number
  }
  hnr_db: number
}

export interface VoiceAnalysisData {
  /** Hume AI 감정 분석 상위 5개 (score 내림차순) */
  emotions: VoiceEmotion[] | null
  /** 음향 피처: Pitch, dB, Jitter, Shimmer, 리듬 등 */
  audioFeatures: AudioFeatures | null
}

export interface VoiceRecord {
  /** 고유 ID — Date.now() 타임스탬프 */
  id: number
  /** 녹음 날짜 (YYYY-MM-DD) */
  date: string
  /** 원본 오디오 Blob (<audio> 재생용) */
  audioBlob: Blob
  /** 분석 결과 */
  analysisData: VoiceAnalysisData
}

// ── DB 싱글턴 ──────────────────────────────────────────────

let _dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (!_dbPromise) {
    _dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      },
    })
  }
  return _dbPromise
}

// ── 핵심 함수 ──────────────────────────────────────────────

/**
 * 새 음성 기록을 IndexedDB에 저장합니다.
 * @returns 저장된 record의 id (timestamp)
 */
export async function saveVoiceRecord(
  audioBlob: Blob,
  analysisData: VoiceAnalysisData,
): Promise<number> {
  const db = await getDB()
  const id = Date.now()
  const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  const record: VoiceRecord = { id, date, audioBlob, analysisData }
  await db.put(STORE_NAME, record)
  return id
}

/**
 * 가장 첫 번째 기록(Before)과 가장 최근 기록(After)을 반환합니다.
 * 기록이 1개뿐이면 before만 채워지고 after는 null입니다.
 */
export async function getBeforeAndAfter(): Promise<{
  before: VoiceRecord | null
  after: VoiceRecord | null
}> {
  const db = await getDB()
  const all = await db.getAll(STORE_NAME) as VoiceRecord[]

  if (all.length === 0) return { before: null, after: null }

  // id = timestamp → 오름차순 정렬
  all.sort((a, b) => a.id - b.id)

  const before = all[0]
  const after = all.length > 1 ? all[all.length - 1] : null

  return { before, after }
}

/**
 * 모든 기록을 최신순으로 반환합니다.
 */
export async function getAllRecords(): Promise<VoiceRecord[]> {
  const db = await getDB()
  const all = await db.getAll(STORE_NAME) as VoiceRecord[]
  return all.sort((a, b) => b.id - a.id)
}

/**
 * 특정 기록을 삭제합니다.
 */
export async function deleteRecord(id: number): Promise<void> {
  const db = await getDB()
  await db.delete(STORE_NAME, id)
}
