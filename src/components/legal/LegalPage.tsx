import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export function LegalPage({ title, effectiveDate, children }: {
  title: string
  effectiveDate: string
  children: React.ReactNode
}) {
  return (
    <div className="px-5 pt-4 pb-10">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <ChevronLeft size={16} /> 홈
      </Link>
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
      <p className="text-xs text-muted-foreground mt-1 mb-6">시행일 {effectiveDate}</p>
      <div className="space-y-6 text-sm leading-relaxed text-foreground/90">{children}</div>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      {children}
    </section>
  )
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  )
}

export function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>{head.map((h) => <th key={h} className="text-left font-semibold border-b border-border px-1 py-1.5 align-top">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-border/50 px-1 py-1.5 align-top">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 홈, 로그인, 마이페이지 하단에 붙이는 링크 한 줄 */
export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[11px] text-muted-foreground text-center ${className}`}>
      <Link href="/terms" className="underline underline-offset-2">이용약관</Link>
      <span className="inline-block w-5" aria-hidden="true" />
      <Link href="/privacy" className="underline underline-offset-2 font-semibold">개인정보처리방침</Link>
    </p>
  )
}
