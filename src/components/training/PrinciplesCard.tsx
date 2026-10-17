import { LEARNING_PRINCIPLES } from '@/lib/curriculum'

/** 훈련 시작 전 학습 원리 5줄 (9교시 41쪽). */
export default function PrinciplesCard({ title = '시작 전에 알아 둘 다섯 가지' }: { title?: string }) {
  return (
    <div className="glass rounded-3xl p-5 space-y-3">
      <p className="text-sm font-bold text-foreground">{title}</p>
      <ol className="space-y-2.5">
        {LEARNING_PRINCIPLES.map((p, i) => (
          <li key={i} className="flex gap-3">
            <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground leading-snug">{p.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{p.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
