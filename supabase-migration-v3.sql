-- v3 마이그레이션: 원천세 신고 도우미 (2026-07 적용 완료)

-- 1. 외주인건비 거래 <-> 인력 직접 연결
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS crew_id uuid REFERENCES crew(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_crew ON transactions(crew_id);

-- 2. 인력별 간이지급명세서 업종구분 코드 (기본: 940909 기타자영업)
ALTER TABLE crew ADD COLUMN IF NOT EXISTS biz_type_code text DEFAULT '940909';

-- 3. 귀속월별 신고 진행 상태
CREATE TABLE IF NOT EXISTS tax_filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text UNIQUE NOT NULL,              -- 'YYYY-MM' (지급월 = 귀속월)
  step_withholding boolean DEFAULT false,   -- 홈택스 원천세 신고 완료
  step_statement boolean DEFAULT false,     -- 간이지급명세서 제출 완료
  step_local boolean DEFAULT false,         -- 위택스 지방소득세 신고 완료
  step_paid boolean DEFAULT false,          -- 납부 완료
  snapshot jsonb,                           -- 완료 시점 합계 스냅샷
  memo text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE tax_filings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated only" ON tax_filings;
CREATE POLICY "authenticated only" ON tax_filings FOR ALL USING (auth.role() = 'authenticated');
