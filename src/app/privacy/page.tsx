import type { Metadata } from 'next'
import { LEGAL, PRIVACY_REVISIONS } from '@/lib/legal'
import { LegalPage, Section, Bullets, Table } from '@/components/legal/LegalPage'

export const metadata: Metadata = { title: `개인정보처리방침 — ${LEGAL.serviceName}` }

/**
 * 실제 데이터 흐름 기준 (2026-10):
 * - 녹음 원본은 서버에도 기기에도 저장하지 않는다. /api/analyze-voice → OpenAI, /api/voice-quality → Modal 로 보내 분석만 한다.
 *   (2026-10-27 전에는 기기 IndexedDB에 원본이 남았다. 지금은 저장하지 않고 남은 것을 지운다.)
 * - 진단 3, 4단계 녹음과 발음 트랙 연습 녹음은 /api/transcribe → OpenAI 로 글자로 바꾸고, 화면에서 맞은 글자 비율만 계산해 저장한다(2026-10-26~).
 * - 녹음 탭 결과는 기기 sessionStorage에, 로그인했으면 user_voice_records 에 수치만 저장한다. 로그아웃하면 기기 쪽을 지운다.
 * - 훈련은 training_sessions, user_profiles 에 측정 수치, 계획(plan), 자가 응답만 저장한다.
 * - 공유 링크(shared_results)는 감정 점수와 장면 결과(scene)를 저장한다.
 * - GA에는 측정 수치, 감정 점수, 통증과 힘든 정도 답을 보내지 않는다. 장면 종류, 단계, 통과 여부 같은 결과의 종류는 보낸다.
 * 데이터 흐름이 바뀌면 이 문서도 같이 고친다.
 */
export default function PrivacyPage() {
  const { serviceName: S, brand, operator, privacyOfficer, contactEmail, effectiveDate } = LEGAL
  return (
    <LegalPage title="개인정보처리방침" effectiveDate={effectiveDate}>
      <p>
        {brand}(운영자 {operator}, 이하 &ldquo;운영자&rdquo;)는 {S} 서비스를 운영하면서 이용자의 개인정보를
        「개인정보 보호법」에 따라 처리합니다. 이 방침은 어떤 정보를 왜 받고, 어디에 얼마나 두는지 설명합니다.
      </p>

      <div className="rounded-2xl bg-primary/10 px-4 py-3 space-y-1">
        <p className="font-semibold text-foreground">먼저 알려 드려요</p>
        <Bullets items={[
          '녹음한 목소리 파일은 서버에도 이용자 기기에도 저장하지 않아요. 분석에만 쓰고, 결과 수치만 남겨요.',
          '목소리로 누구인지 알아보는 일(본인 확인이나 식별)에는 쓰지 않아요.',
          '개인정보를 다른 회사에 팔거나 넘기지 않아요.',
        ]} />
      </div>

      <Section title="1. 처리하는 개인정보와 목적">
        <Table
          head={['언제', '항목', '목적']}
          rows={[
            [
              '목소리 분석 (로그인 없이도)',
              '녹음한 목소리 (저장하지 않음)',
              '감정 경향과 음향 수치(음높이, 떨림, 말 속도, 크기) 분석',
            ],
            [
              '분석 결과',
              '감정 점수, 음향 수치',
              '결과 화면 표시. 로그인 전에는 이용자 기기에만 저장, 로그인하면 계정에 저장',
            ],
            [
              '로그인 (구글, 카카오)',
              '이메일, 이름 또는 닉네임, 프로필 사진 주소, 계정 고유 번호',
              '회원 식별, 기록 보관, 문의 응대',
            ],
            [
              '훈련',
              '고른 고민과 상황, 주간 연습 목표와 연습 시간, 훈련 단계, 진단과 연습 녹음에서 잰 수치(떨림, 말 속도, 크기, 길이, 알아들은 글자 비율), 직접 답한 내용(힘든 정도, 목이 아프거나 불편했는지, 2026년 10월 26일 이전 기록에 한해 그날 목을 많이 썼는지), 훈련 날짜. 녹음 자체와 녹음을 글자로 바꾼 내용은 저장하지 않음',
              '맞춤 훈련 단계 정하기, 무리한 훈련 막기, 개선 추이 보여 주기',
            ],
            [
              '결과 공유 링크를 만들 때',
              '감정 점수와 그 결과로 정한 장면(장면 이름, 목소리 지도 위치, 그렇게 들린 이유). 계정과 연결하지 않음',
              '공유 링크 화면 표시. 링크를 아는 사람은 누구나 볼 수 있음',
            ],
            [
              '서비스 이용 중 자동으로',
              '접속 기록, 기기와 브라우저 정보, 쿠키, 방문한 화면과 누른 버튼',
              '오류 확인, 이용 통계, 광고 성과 측정',
            ],
          ]}
        />
        <p className="text-xs text-muted-foreground">
          &ldquo;목이 아프거나 불편했는지&rdquo;는 훈련 강도를 낮추는 데에만 쓰고, 의료 판단에 쓰지 않습니다.
        </p>
      </Section>

      <Section title="2. 보유 기간과 파기">
        <Bullets items={[
          '녹음한 목소리: 저장하지 않습니다. 분석 요청이 끝나면 운영자 서버와 분석 서버의 메모리에서 사라집니다.',
          '계정 정보, 분석 기록, 훈련 기록: 탈퇴(삭제 요청) 때까지 보관하고, 요청을 받으면 5일 안에 지웁니다.',
          '공유 링크의 결과: 서비스를 운영하는 동안 보관합니다. 링크 주소를 알려 주시면 바로 지웁니다.',
          '이용자 기기에 저장된 결과: 운영자가 볼 수 없습니다. 로그아웃하거나 브라우저의 사이트 데이터를 지우면 함께 지워집니다.',
          '법령이 따로 보관을 요구하는 경우에는 그 기간 동안 분리해 보관합니다.',
          '전자 파일은 복구할 수 없는 방법으로 지웁니다.',
        ]} />
      </Section>

      <Section title="3. 제3자 제공">
        <p>
          운영자는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 법령에 따라 수사기관 등이 정해진 절차로 요구하는 경우만 예외입니다.
        </p>
      </Section>

      <Section title="4. 처리 위탁과 국외 이전">
        <p>
          서비스 운영을 위해 아래 회사에 처리를 맡깁니다. 대부분 미국에 서버가 있어 개인정보가 국외로 옮겨집니다.
          이용자가 서비스를 이용할 때 암호화된 통신(HTTPS)으로 전송됩니다.
        </p>
        <Table
          head={['받는 회사 (국가)', '옮겨지는 항목', '목적', '보유 기간']}
          rows={[
            ['OpenAI, L.L.C. (미국)', '녹음한 목소리', '감정 경향 분석', '저장하지 않음. 단, OpenAI가 남용 감시를 위해 최대 30일 보관 후 삭제하며 AI 학습에는 쓰지 않음'],
            ['OpenAI, L.L.C. (미국)', '훈련 진단 3, 4단계 녹음, 발음 트랙 연습 녹음', '녹음을 글자로 바꾸기 (음성 인식)', '저장하지 않음. OpenAI도 보관하지 않으며 AI 학습에 쓰지 않음'],
            ['Modal Labs, Inc. (미국)', '녹음한 목소리', '떨림과 음질 수치 측정', '저장하지 않음. 측정 직후 삭제'],
            ['Supabase, Inc. (미국)', '계정 정보, 분석 기록, 훈련 기록', '데이터베이스 보관, 로그인 처리', '탈퇴 때까지'],
            ['Vercel Inc. (미국)', '접속 기록', '웹사이트 호스팅', '각 회사 정책에 따름'],
            ['Google LLC (미국)', '쿠키, 이용 기록', '이용 통계 (Google Analytics)', '각 회사 정책에 따름'],
            ['Meta Platforms, Inc. (미국)', '쿠키, 이용 기록', '광고 성과 측정 (Meta 픽셀)', '각 회사 정책에 따름'],
          ]}
        />
        <p>
          구글이나 카카오 로그인을 고르면 해당 회사가 이용자 동의를 받아 위 1번의 로그인 항목을 운영자에게 보냅니다.
        </p>
        <p>
          국외 이전을 원하지 않으면 서비스 이용을 멈추고 아래 연락처로 삭제를 요청하실 수 있습니다.
          다만 목소리 분석은 위 회사를 거쳐야 해서, 이전을 거부하면 분석 기능을 쓸 수 없습니다.
        </p>
      </Section>

      <Section title="5. 쿠키와 행태정보">
        <p>
          운영자는 이용 통계와 광고 성과 측정을 위해 Google Analytics와 Meta 픽셀을 씁니다.
          여기에는 방문한 화면과 누른 버튼, 어떤 장면이 나왔는지나 훈련 단계를 통과했는지 같은 결과의 종류가 담깁니다.
          녹음, 측정 수치, 감정 점수, 목이 아프거나 힘들었다는 답은 보내지 않습니다.
        </p>
        <Bullets items={[
          '브라우저 설정에서 쿠키를 막거나 지울 수 있습니다.',
          'Google Analytics 차단: tools.google.com/dlpage/gaoptout',
          'Meta 광고 설정: facebook.com/adpreferences',
        ]} />
      </Section>

      <Section title="6. 이용자의 권리">
        <p>
          이용자는 언제든 자기 개인정보를 열람하거나 고치거나 지우도록 요청할 수 있고, 처리를 멈추라고 요청할 수 있습니다.
          아래 이메일로 요청하시면 본인 확인 후 열람, 정정, 처리정지는 10일 안에, 삭제와 탈퇴는 5일 안에 처리합니다.
          탈퇴도 같은 방법으로 요청하실 수 있습니다.
        </p>
      </Section>

      <Section title="7. 만 14세 미만">
        <p>
          {S}는 만 14세 이상만 이용할 수 있습니다. 만 14세 미만 이용자의 정보가 확인되면 바로 지웁니다.
        </p>
      </Section>

      <Section title="8. 안전하게 지키는 방법">
        <Bullets items={[
          '녹음 파일을 저장하지 않아 유출될 원본 자체를 두지 않습니다.',
          '모든 통신을 암호화(HTTPS)합니다.',
          '데이터베이스는 로그인한 본인만 자기 기록을 읽고 쓸 수 있게 막아 둡니다.',
          '관리 권한은 운영자만 가지며, 접근 키를 코드와 분리해 보관합니다.',
        ]} />
      </Section>

      <Section title="9. 개인정보 보호책임자">
        <Bullets items={[
          `책임자: ${privacyOfficer}`,
          `이메일: ${contactEmail}`,
        ]} />
        <p>개인정보 침해로 상담이 필요하면 아래 기관에도 문의할 수 있습니다.</p>
        <Bullets items={[
          '개인정보분쟁조정위원회 1833-6972 (kopico.go.kr)',
          '개인정보침해신고센터 118 (privacy.kisa.or.kr)',
          '대검찰청 1301 (spo.go.kr)',
          '경찰청 182 (ecrm.police.go.kr)',
        ]} />
      </Section>

      <Section title="10. 방침의 변경">
        <p>
          이 방침을 바꾸면 시행 7일 전에 서비스 화면으로 알립니다. 이용자에게 불리한 변경은 30일 전에 알립니다.
        </p>
      </Section>

      <Section title="11. 개정 이력">
        <div id="changes" className="space-y-3 scroll-mt-4">
          {PRIVACY_REVISIONS.map((r) => (
            <div key={r.isoDate} className="space-y-1">
              <p className="font-semibold text-foreground">{r.date}</p>
              <Bullets items={r.changes} />
            </div>
          ))}
        </div>
      </Section>
    </LegalPage>
  )
}
