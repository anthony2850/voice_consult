'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { ConcernSlug } from '@/lib/curriculum'
import { CONCERN_LABELS } from '@/lib/curriculum'

interface Props {
  open: boolean
  initial: ConcernSlug[]
  onClose: () => void
  onSave: (next: ConcernSlug[]) => Promise<void> | void
  title?: string
}

const ALL: ConcernSlug[] = ['small_voice', 'trembling', 'fast', 'diction']

export default function ConcernsModal({ open, initial, onClose, onSave, title = '내 목소리 고민' }: Props) {
  const [selected, setSelected] = useState<ConcernSlug[]>(initial)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setSelected(initial) }, [initial, open])

  if (!open) return null

  function toggle(c: ConcernSlug) {
    setSelected((cur) => cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c])
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(selected)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-card rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-foreground">{title}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          해당하는 고민을 모두 선택해주세요. 선택한 영역의 Day는 매일 더 깊은 훈련이 제공돼요.
          보통 1-2개를 권장합니다.
        </p>
        <div className="space-y-2">
          {ALL.map((c) => {
            const checked = selected.includes(c)
            return (
              <button
                key={c}
                onClick={() => toggle(c)}
                className={`w-full flex items-center justify-between gap-3 p-4 rounded-2xl text-left transition-colors ${
                  checked ? 'bg-primary/15 border border-primary/40' : 'bg-secondary/60 border border-transparent'
                }`}
              >
                <span className="text-sm font-semibold text-foreground">{CONCERN_LABELS[c]}</span>
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  checked ? 'border-primary bg-primary' : 'border-border'
                }`}>
                  {checked && <span className="text-white text-[10px]">✓</span>}
                </span>
              </button>
            )
          })}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 rounded-2xl gradient-primary text-white text-sm font-bold active:scale-95 transition-transform disabled:opacity-70"
        >
          {saving ? '저장 중…' : '저장하기'}
        </button>
      </div>
    </div>
  )
}
