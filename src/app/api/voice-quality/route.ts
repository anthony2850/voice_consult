import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

/**
 * Proxies a WAV recording to the Modal parselmouth service and returns
 * cycle-to-cycle Praat jitter/shimmer (+ HNR). Returns 204 when MODAL is
 * unconfigured or analysis fails — the client falls back to its in-browser
 * frame-based approximation.
 */
export async function POST(req: NextRequest) {
  const modalUrl = process.env.MODAL_VOICE_QUALITY_URL
  if (!modalUrl) {
    return new NextResponse(null, { status: 204 })
  }

  const wav = await req.arrayBuffer()
  if (wav.byteLength === 0) {
    return NextResponse.json({ error: 'empty body' }, { status: 400 })
  }

  try {
    const res = await fetch(modalUrl, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'audio/wav' },
      body: wav,
    })

    if (!res.ok) {
      console.warn('[voice-quality] Modal returned', res.status, (await res.text()).slice(0, 200))
      return new NextResponse(null, { status: 204 })
    }

    const data = (await res.json()) as {
      jitter_rel_pct?: unknown
      shimmer_rel_pct?: unknown
      hnr_db?: unknown
    }

    const j = Number(data.jitter_rel_pct)
    const s = Number(data.shimmer_rel_pct)
    const h = Number(data.hnr_db)
    if (!Number.isFinite(j) || !Number.isFinite(s)) {
      return new NextResponse(null, { status: 204 })
    }

    return NextResponse.json({
      jitter_rel_pct: j,
      shimmer_rel_pct: s,
      hnr_db: Number.isFinite(h) ? h : 0,
    })
  } catch (err) {
    console.warn('[voice-quality] Modal fetch failed:', err)
    return new NextResponse(null, { status: 204 })
  }
}
