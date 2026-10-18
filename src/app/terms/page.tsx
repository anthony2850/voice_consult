import type { Metadata } from 'next'
import Link from 'next/link'
import { LEGAL } from '@/lib/legal'
import { LegalPage, Section, Bullets } from '@/components/legal/LegalPage'

export const metadata: Metadata = { title: `이용약관 — ${LEGAL.serviceName}` }

export default function TermsPage() {
  const { serviceName: S, brand, operator, contactEmail, effectiveDate } = LEGAL
  return (
    <LegalPage title="이용약관" effectiveDate={effectiveDate}>
      <Section title="제1조 목적">
        <p>
          이 약관은 {brand}(운영자 {operator}, 이하 &ldquo;운영자&rdquo;)가 제공하는 {S}(이하 &ldquo;서비스&rdquo;)를 이용할 때
          운영자와 이용자의 권리, 의무, 책임을 정합니다.
        </p>
      </Section>

      <Section title="제2조 서비스 내용">
        <Bullets items={[
          '목소리 분석: 녹음한 목소리의 떨림, 말 속도, 억양 변화, 크기를 수치로 보여 주고 감정 경향을 추정합니다.',
          '훈련: 분석 결과와 이용자가 고른 고민에 맞춰 연습 과제를 내고 기록을 남깁니다.',
          '기록: 분석과 훈련 기록, 개선 추이를 보여 줍니다.',
        ]} />
        <p>운영자는 서비스를 더 낫게 만들기 위해 기능을 바꾸거나 더할 수 있습니다.</p>
      </Section>

      <Section title="제3조 이용 계약">
        <Bullets items={[
          '목소리 분석은 로그인 없이 쓸 수 있습니다. 훈련과 기록 보관은 구글 또는 카카오 계정으로 로그인해야 합니다.',
          '로그인하면 이 약관과 개인정보처리방침에 동의한 것으로 봅니다.',
          '만 14세 미만은 서비스를 이용할 수 없습니다.',
        ]} />
      </Section>

      <Section title="제4조 요금">
        <p>
          현재 서비스는 무료입니다. 유료 이용권을 도입하면 가격, 결제 방법, 환불 기준을 미리 알리고,
          결제에 따로 동의한 이용자에게만 요금을 받습니다.
        </p>
      </Section>

      <Section title="제5조 의료 서비스가 아닙니다">
        <Bullets items={[
          '서비스의 분석과 훈련은 말하기 연습을 돕기 위한 참고 정보입니다. 의학적 진단이나 치료가 아닙니다.',
          '훈련 중 목이 아프면 바로 멈추세요.',
          '목이 쉬거나 아픈 증상이 2주 넘게 이어지면 이비인후과 진료를 받으세요.',
          '분석 수치는 마이크, 주변 소음, 컨디션에 따라 달라질 수 있습니다.',
        ]} />
      </Section>

      <Section title="제6조 이용자의 의무">
        <p>이용자는 다음 행동을 해서는 안 됩니다.</p>
        <Bullets items={[
          '다른 사람의 목소리를 그 사람의 동의 없이 녹음해 분석하는 일',
          '다른 사람의 계정을 쓰는 일',
          '서비스에 비정상적인 요청을 보내 운영을 방해하는 일',
          '서비스의 화면, 문구, 훈련 과제를 허락 없이 복제해 판매하는 일',
        ]} />
      </Section>

      <Section title="제7조 권리의 귀속">
        <p>
          서비스의 화면, 문구, 훈련 과제에 대한 권리는 운영자에게 있습니다.
          이용자가 녹음한 목소리와 이용자의 기록은 이용자의 것이며, 운영자는{' '}
          <Link href="/privacy" className="underline underline-offset-2">개인정보처리방침</Link>에 적은 목적으로만 씁니다.
        </p>
      </Section>

      <Section title="제8조 서비스의 변경과 중단">
        <p>
          운영자는 점검, 장애, 외부 서비스 중단 같은 사유로 서비스를 잠시 멈출 수 있습니다.
          서비스를 끝내야 하면 30일 전에 알리고, 이용자 기록은 개인정보처리방침에 따라 지웁니다.
        </p>
      </Section>

      <Section title="제9조 탈퇴">
        <p>
          이용자는 언제든 {contactEmail}로 탈퇴를 요청할 수 있습니다. 운영자는 본인 확인 후 계정과 기록을 지웁니다.
        </p>
      </Section>

      <Section title="제10조 책임의 제한">
        <Bullets items={[
          '운영자는 천재지변, 외부 서비스 장애처럼 운영자가 막을 수 없는 사유로 생긴 손해에는 책임지지 않습니다.',
          '운영자는 이용자가 분석 결과를 의료 판단 등 서비스 목적 밖에 써서 생긴 손해에는 책임지지 않습니다.',
          '다만 운영자의 고의나 중대한 과실로 생긴 손해는 예외입니다.',
        ]} />
      </Section>

      <Section title="제11조 약관의 변경">
        <p>
          약관을 바꾸면 시행 7일 전에 서비스 화면으로 알립니다. 이용자에게 불리한 변경은 30일 전에 알립니다.
          바뀐 약관에 동의하지 않으면 탈퇴할 수 있습니다.
        </p>
      </Section>

      <Section title="제12조 준거법과 분쟁">
        <p>
          이 약관은 대한민국 법을 따릅니다. 분쟁이 생기면 먼저 {contactEmail}로 협의하고,
          소송은 민사소송법에 따른 관할 법원에서 합니다.
        </p>
      </Section>
    </LegalPage>
  )
}
