const INITIAL = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']
const VOWEL  = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ']
const FINAL  = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']

function decompose(text: string): string[] {
  const phonemes: string[] = []
  for (const char of text) {
    const code = char.charCodeAt(0)
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const idx = code - 0xAC00
      const i = Math.floor(idx / (21 * 28))
      const v = Math.floor((idx % (21 * 28)) / 28)
      const f = idx % 28
      phonemes.push(INITIAL[i], VOWEL[v])
      if (f > 0) phonemes.push(FINAL[f])
    } else if (code >= 0x3131 && code <= 0x314E) {
      phonemes.push(char)
    }
  }
  return phonemes
}

function levenshtein(a: string[], b: string[]): number {
  const m = a.length, n = b.length
  const prev = Array.from({ length: n + 1 }, (_, j) => j)
  const curr = new Array<number>(n + 1)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    prev.splice(0, n + 1, ...curr)
  }
  return prev[n]
}

/** Returns Phoneme Error Rate (0–1). 0 = perfect, 1 = all wrong. */
export function calcPER(reference: string, hypothesis: string): number {
  const ref = decompose(reference)
  if (ref.length === 0) return 0
  const hyp = decompose(hypothesis)
  return levenshtein(ref, hyp) / ref.length
}
