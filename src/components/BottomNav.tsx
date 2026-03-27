'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Mic, User } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/record', label: '목소리 분석', icon: Mic },
  { href: '/mypage', label: '마이페이지',  icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50">
      {/* glassmorphism bar */}
      <div className="glass border-t border-border/60 pb-[env(safe-area-inset-bottom,0px)]">
        <ul className="flex items-center justify-around h-16">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  className="flex flex-col items-center gap-1 py-2 group"
                >
                  <span
                    className={`
                      flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-200
                      ${active
                        ? 'gradient-primary shadow-lg shadow-primary/30 scale-105'
                        : 'text-muted-foreground group-hover:text-foreground'
                      }
                    `}
                  >
                    <Icon
                      size={20}
                      className={active ? 'text-white' : ''}
                      strokeWidth={active ? 2.5 : 2}
                    />
                  </span>
                  <span
                    className={`text-[10px] font-medium transition-colors ${
                      active ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
