-- v2 마이그레이션: 외주인건비 지원 추가

-- 1. type 제약 조건 업데이트 (외주인건비 추가)
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('매출', '매입', '외주인건비'));

-- 2. 원천세 컬럼 추가 (외주인건비 전용, 매출/매입은 0)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS withholding_tax numeric DEFAULT 0;
