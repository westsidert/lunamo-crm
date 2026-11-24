-- v6 마이그레이션: 크론 실행 흔적 기록 (2026-11-24 적용 완료)
-- auto-expense 크론이 매일 DB까지 도달하는지 사후 확인하기 위한 하트비트 테이블

CREATE TABLE IF NOT EXISTS cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job text NOT NULL,
  status text NOT NULL,
  detail text,
  ran_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cron_runs_job_ran_at_idx ON cron_runs (job, ran_at DESC);
ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read" ON cron_runs;
CREATE POLICY "authenticated read" ON cron_runs FOR SELECT USING (auth.role() = 'authenticated');
