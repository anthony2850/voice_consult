export default function HomeHero() {
  return (
    <>
      <h1 className="text-[34px] font-black leading-[1.15] tracking-[-0.03em] mb-4">
        <span className="text-foreground">내 목소리를 재고</span>
        <br />
        <span className="text-accent">훈련하는 AI 코치</span>
      </h1>

      <p className="text-[15px] text-muted-foreground leading-relaxed mb-8 max-w-[300px]">
        짧은 글 한 단락을 읽으면 목소리를 수치로 진단하고
        <br />
        아쉬운 부분을 매일 훈련으로 다듬어요
      </p>
    </>
  )
}
