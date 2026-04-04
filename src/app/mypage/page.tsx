import LoginRequired from '@/components/LoginRequired'
import MyPageClient from './MyPageClient'

export default function MyPage() {
  return (
    <LoginRequired>
      <MyPageClient />
    </LoginRequired>
  )
}
