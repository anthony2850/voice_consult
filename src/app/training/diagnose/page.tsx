import LoginRequired from '@/components/LoginRequired'
import DiagnoseClient from './DiagnoseClient'

export default function DiagnosePage() {
  return (
    <LoginRequired>
      <DiagnoseClient />
    </LoginRequired>
  )
}
