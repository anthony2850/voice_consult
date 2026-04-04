import LoginRequired from '@/components/LoginRequired'
import ArchiveClient from './ArchiveClient'

export default function ArchivePage() {
  return (
    <LoginRequired>
      <ArchiveClient />
    </LoginRequired>
  )
}
