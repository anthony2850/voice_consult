'use client'

import { extractAudioFeaturesWithPraat } from './extractAudioFeatures'
import { toMeasure, type Measure } from './trainingCycle'
import type { RungLevel } from './curriculum'

/** 녹음 하나를 트랙 지표로 바꾼다. 실패하면 null — 호출자가 다시 녹음을 안내한다. */
export async function measureBlob(blob: Blob, level?: RungLevel): Promise<Measure | null> {
  const features = await extractAudioFeaturesWithPraat(blob)
  if (!features) return null
  return toMeasure(features, level)
}
