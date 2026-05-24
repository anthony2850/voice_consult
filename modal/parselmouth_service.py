"""
parselmouth_service.py
─────────────────────────────────────────────────────────────────────────────
Modal microservice that computes clinical cycle-to-cycle jitter & shimmer
(plus HNR) from a WAV recording using Praat via parselmouth.

The browser pipeline extracts pitch / energy / rhythm locally; only the
voice-quality numbers come from here because cycle-detection is the part
that's hard to do well in JS.

──────────────────────────────────────────────────────────────────────────
Deploy
──────────────────────────────────────────────────────────────────────────
    pip install modal
    modal token new                 # one-time auth
    modal deploy modal/parselmouth_service.py

Modal prints a URL like:
    https://<workspace>--voice-quality-praat-quality.modal.run

POST raw WAV to that URL with Content-Type: audio/wav.
Copy that URL into .env.local as MODAL_VOICE_QUALITY_URL.

Iterate locally with:
    modal serve modal/parselmouth_service.py

──────────────────────────────────────────────────────────────────────────
Contract
──────────────────────────────────────────────────────────────────────────
POST <url>/
    Content-Type: audio/wav
    body: raw 16-bit PCM mono WAV (the browser produces this via audioToWav.ts)

200 OK
    { "jitter_rel_pct": 1.42, "shimmer_rel_pct": 3.07, "hnr_db": 18.3 }

422 if the recording is too short / unvoiced for Praat to extract cycles.
"""

import modal

app = modal.App("voice-quality")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "praat-parselmouth==0.4.5",
        "fastapi[standard]==0.115.6",
        "scipy==1.14.1",
        "numpy==1.26.4",
    )
)


@app.function(image=image, timeout=30)
@modal.asgi_app()
def praat_quality():
    """
    Returns a FastAPI ASGI app. Using `asgi_app` (rather than
    `fastapi_endpoint`) sidesteps Modal's signature-wrapping behavior that
    would otherwise hide the `Request` annotation from FastAPI and cause
    a 422 "missing query param" error on raw-body endpoints.
    """
    import io

    from fastapi import FastAPI, HTTPException, Request
    from fastapi.responses import JSONResponse
    import numpy as np
    import parselmouth
    from parselmouth.praat import call
    from scipy.io import wavfile

    web = FastAPI()

    @web.post("/")
    async def analyze(request: Request):
        wav_bytes = await request.body()
        if not wav_bytes:
            raise HTTPException(status_code=400, detail="empty body")

        # parselmouth.Sound() doesn't accept BytesIO; decode WAV → numpy first.
        try:
            sr, samples = wavfile.read(io.BytesIO(wav_bytes))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"could not decode WAV: {e}")

        # Mixdown stereo → mono just in case (browser sends mono but be safe)
        if samples.ndim == 2:
            samples = samples.mean(axis=1)

        # parselmouth expects float64 in [-1, 1]. Browser sends int16 PCM.
        if np.issubdtype(samples.dtype, np.integer):
            samples = samples.astype(np.float64) / float(np.iinfo(samples.dtype).max)
        else:
            samples = samples.astype(np.float64)

        try:
            sound = parselmouth.Sound(samples, sampling_frequency=float(sr))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"could not build Sound: {e}")

        # Praat pitch settings tuned for adult speech (60–500 Hz).
        # PointProcess (cc) picks glottal closure instants from the pitch track —
        # that's the basis for cycle-to-cycle jitter/shimmer.
        try:
            point_process = call(
                sound, "To PointProcess (periodic, cc)", 60.0, 500.0
            )

            # Local jitter (relative, fraction): mean absolute period perturbation
            # over consecutive cycles, normalized by mean period.
            # Args: startTime, endTime, shortestPeriod, longestPeriod, maxPeriodFactor
            jitter_local = call(
                point_process,
                "Get jitter (local)",
                0.0, 0.0, 0.0001, 0.02, 1.3,
            )

            # Local shimmer (relative, fraction): mean abs amplitude perturbation
            # between consecutive cycles, normalized by mean amplitude.
            shimmer_local = call(
                [sound, point_process],
                "Get shimmer (local)",
                0.0, 0.0, 0.0001, 0.02, 1.3, 1.6,
            )

            # HNR via cross-correlation method, returned in dB.
            harmonicity = call(
                sound,
                "To Harmonicity (cc)",
                0.01,    # time step
                75.0,    # minimum pitch
                0.1,     # silence threshold
                1.0,     # periods per window
            )
            hnr_db = call(harmonicity, "Get mean", 0.0, 0.0)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"praat analysis failed: {e}")

        def finite(x, default=0.0):
            # Praat returns NaN/inf when the signal has too few voiced cycles
            try:
                xf = float(x)
            except (TypeError, ValueError):
                return default
            if xf != xf or xf in (float("inf"), float("-inf")):
                return default
            return xf

        jitter_pct = finite(jitter_local) * 100.0
        shimmer_pct = finite(shimmer_local) * 100.0
        hnr = finite(hnr_db, default=0.0)

        if jitter_pct == 0.0 and shimmer_pct == 0.0:
            raise HTTPException(
                status_code=422,
                detail="no voiced cycles detected (recording too short or unvoiced)",
            )

        return JSONResponse(
            {
                "jitter_rel_pct": jitter_pct,
                "shimmer_rel_pct": shimmer_pct,
                "hnr_db": hnr,
            }
        )

    return web
