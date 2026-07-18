-- v4 마이그레이션: AI 견적 피드백 루프 (2026-07 적용 완료)
-- AI 초안 vs 사용자 확정본을 기록해 다음 견적 분석 프롬프트에 수정 사례로 주입

CREATE TABLE IF NOT EXISTS quote_ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  description text,        -- 의뢰문
  video_type text,         -- AI가 분류한 영상 종류
  ai_items jsonb,          -- AI 초안 항목
  final_items jsonb,       -- 사용자 확정 항목
  ai_total numeric,        -- AI 초안 공급가 합계
  final_total numeric,     -- 확정 공급가 합계
  diff_summary text,       -- 프롬프트 주입용 압축 요약
  created_at timestamptz DEFAULT now()
);
ALTER TABLE quote_ai_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated only" ON quote_ai_feedback;
CREATE POLICY "authenticated only" ON quote_ai_feedback FOR ALL USING (auth.role() = 'authenticated');
