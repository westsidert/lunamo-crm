-- v5 마이그레이션: 인력 계좌번호 전용 칸 (2026-07 적용 완료)
-- 입금 목록 텍스트 정리 기능용. 기존 memo에 있던 계좌 정보를 account로 이전.

ALTER TABLE crew ADD COLUMN IF NOT EXISTS account text;

-- 메모에 들어있던 계좌 정보를 account로 이전 후 memo 비우기
UPDATE crew SET account = memo WHERE (account IS NULL OR account = '') AND memo IS NOT NULL AND memo <> '';
UPDATE crew SET memo = NULL WHERE account IS NOT NULL AND account = memo;
