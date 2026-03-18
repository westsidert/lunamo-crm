-- ============================================================
-- 루나모 과거 견적서 데이터 (AI 가견적 참고용)
-- 총 12건 / 2025-04 ~ 2026-01
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- ① 2026 드론쇼코리아 LIG부스 사진 촬영 (2026-01-15)
INSERT INTO quotes (id, client_name_override, project_title, quote_date, status, is_first_deal, discount_rate, sub_total, vat_amount, final_amount)
VALUES ('00000000-0000-0000-0000-000000000001', '투닷', '2026 드론쇼코리아 LIG부스 사진 촬영', '2026-01-15', '수주', false, 0, 500000, 50000, 550000);

INSERT INTO quote_items (quote_id, category, contents, each_price, qty, day, sum, sort_order)
VALUES ('00000000-0000-0000-0000-000000000001', 'production', '촬영감독', 500000, 1, 1, 500000, 0);


-- ② 울산대학교 신입생 프로그램 현장 스케치 영상 제작 (2026-01-14)
INSERT INTO quotes (id, client_name_override, project_title, quote_date, status, is_first_deal, discount_rate, sub_total, vat_amount, final_amount)
VALUES ('00000000-0000-0000-0000-000000000002', '더HR컴퍼니', '울산대학교 신입생 프로그램 현장 스케치 영상 제작', '2026-01-14', '수주', true, 15, 1650000, 140000, 1540000);

INSERT INTO quote_items (quote_id, category, contents, each_price, qty, day, sum, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'production', '촬영감독', 500000, 2, 1, 1000000, 0),
  ('00000000-0000-0000-0000-000000000002', 'production', '출장비', 250000, 1, 1, 250000, 1),
  ('00000000-0000-0000-0000-000000000002', 'Post-production', '종합편집', 400000, 1, 1, 400000, 2);


-- ③ 부산사회서비스원 일상돌봄 서비스 우수사례 홍보영상 제작 (2025-12-04)
INSERT INTO quotes (id, client_name_override, project_title, quote_date, status, is_first_deal, discount_rate, sub_total, vat_amount, final_amount)
VALUES ('00000000-0000-0000-0000-000000000003', '부산사회서비스원', '일상돌봄 서비스 우수사례 홍보영상 제작', '2025-12-04', '수주', true, 15, 4850000, 485000, 4500000);

INSERT INTO quote_items (quote_id, category, contents, each_price, qty, day, sum, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000003', 'Pre-production', '기획료', 300000, 1, 2, 600000, 0),
  ('00000000-0000-0000-0000-000000000003', 'Pre-production', '콘티', 300000, 1, 1, 300000, 1),
  ('00000000-0000-0000-0000-000000000003', 'Pre-production', '진행비', 100000, 1, 1, 100000, 2),
  ('00000000-0000-0000-0000-000000000003', 'production', '프로듀서', 500000, 1, 1, 500000, 3),
  ('00000000-0000-0000-0000-000000000003', 'production', '촬영감독', 500000, 1, 1, 500000, 4),
  ('00000000-0000-0000-0000-000000000003', 'production', '촬영부', 450000, 1, 1, 450000, 5),
  ('00000000-0000-0000-0000-000000000003', 'production', '배우 섭외', 900000, 1, 1, 900000, 6),
  ('00000000-0000-0000-0000-000000000003', 'production', '로케이션 섭외', 200000, 1, 1, 200000, 7),
  ('00000000-0000-0000-0000-000000000003', 'production', '진행비', 200000, 1, 3, 600000, 8),
  ('00000000-0000-0000-0000-000000000003', 'Post-production', '종합편집', 400000, 1, 1, 400000, 9),
  ('00000000-0000-0000-0000-000000000003', 'Post-production', '2D 그래픽', 400000, 1, 1, 400000, 10),
  ('00000000-0000-0000-0000-000000000003', 'Post-production', '성우 녹음', 300000, 1, 1, 300000, 11);


-- ④ 경남 RISE 센터 홍보영상 제작 (2025-11-19)
INSERT INTO quotes (id, client_name_override, project_title, quote_date, status, is_first_deal, discount_rate, sub_total, vat_amount, final_amount)
VALUES ('00000000-0000-0000-0000-000000000004', '경남 RISE 센터', '경남 RISE 센터 홍보영상 제작', '2025-11-19', '수주', true, 15, 30900000, 3090000, 28800000);

INSERT INTO quote_items (quote_id, category, contents, each_price, qty, day, sum, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000004', 'Pre-production', '기획료', 300000, 7, 1, 2100000, 0),
  ('00000000-0000-0000-0000-000000000004', 'Pre-production', '시나리오', 500000, 3, 1, 1500000, 1),
  ('00000000-0000-0000-0000-000000000004', 'Pre-production', '콘티', 300000, 3, 1, 900000, 2),
  ('00000000-0000-0000-0000-000000000004', 'Pre-production', '진행비', 100000, 7, 1, 700000, 3),
  ('00000000-0000-0000-0000-000000000004', 'production', '프로듀서', 500000, 3, 1, 1500000, 4),
  ('00000000-0000-0000-0000-000000000004', 'production', '감독', 600000, 3, 1, 1800000, 5),
  ('00000000-0000-0000-0000-000000000004', 'production', '연출부', 300000, 3, 1, 900000, 6),
  ('00000000-0000-0000-0000-000000000004', 'production', '촬영감독', 500000, 3, 1, 1500000, 7),
  ('00000000-0000-0000-0000-000000000004', 'production', '촬영부', 450000, 3, 1, 1350000, 8),
  ('00000000-0000-0000-0000-000000000004', 'production', '조명감독', 600000, 3, 1, 1800000, 9),
  ('00000000-0000-0000-0000-000000000004', 'production', '사운드감독', 500000, 3, 1, 1500000, 10),
  ('00000000-0000-0000-0000-000000000004', 'production', '분장', 600000, 3, 1, 1800000, 11),
  ('00000000-0000-0000-0000-000000000004', 'production', '모델', 300000, 1, 5, 1500000, 12),
  ('00000000-0000-0000-0000-000000000004', 'production', '보조출연', 100000, 1, 5, 500000, 13),
  ('00000000-0000-0000-0000-000000000004', 'production', '지원', 200000, 3, 2, 1200000, 14),
  ('00000000-0000-0000-0000-000000000004', 'production', '진행비', 300000, 3, 1, 900000, 15),
  ('00000000-0000-0000-0000-000000000004', 'Post-production', '편집', 450000, 5, 1, 2250000, 16),
  ('00000000-0000-0000-0000-000000000004', 'Post-production', '2D 그래픽', 450000, 5, 1, 2250000, 17),
  ('00000000-0000-0000-0000-000000000004', 'Post-production', '자막', 250000, 1, 1, 250000, 18),
  ('00000000-0000-0000-0000-000000000004', 'Post-production', '색보정', 300000, 3, 1, 900000, 19),
  ('00000000-0000-0000-0000-000000000004', 'Post-production', '성우 녹음', 300000, 1, 1, 300000, 20),
  ('00000000-0000-0000-0000-000000000004', 'Post-production', '믹싱', 300000, 1, 1, 300000, 21),
  ('00000000-0000-0000-0000-000000000004', '기타', '유튜브 마케팅', 3200000, 1, 1, 3200000, 22);


-- ⑤ 수영고성연구회 2026 국제학술대회 홍보영상 (2025-10-02)
INSERT INTO quotes (id, client_name_override, project_title, quote_date, status, is_first_deal, discount_rate, sub_total, vat_amount, final_amount)
VALUES ('00000000-0000-0000-0000-000000000005', '수영고성연구회', '2026 국제학술대회 개최 홍보용 영상 제작', '2025-10-02', '수주', true, 15, 3000000, 300000, 2800000);

INSERT INTO quote_items (quote_id, category, contents, each_price, qty, day, sum, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000005', 'Pre-production', '기획료', 300000, 1, 1, 300000, 0),
  ('00000000-0000-0000-0000-000000000005', 'Pre-production', '콘티', 300000, 1, 1, 300000, 1),
  ('00000000-0000-0000-0000-000000000005', 'production', '촬영감독', 500000, 1, 2, 1000000, 2),
  ('00000000-0000-0000-0000-000000000005', 'production', '진행비', 200000, 1, 1, 200000, 3),
  ('00000000-0000-0000-0000-000000000005', 'Post-production', '종합편집', 450000, 1, 2, 900000, 4),
  ('00000000-0000-0000-0000-000000000005', 'Post-production', '색보정', 300000, 1, 1, 300000, 5);


-- ⑥ 벡스코 탄소중립 EXPO 2025 현장 스케치 (2025-08-20)
INSERT INTO quotes (id, client_name_override, project_title, quote_date, status, is_first_deal, discount_rate, sub_total, vat_amount, final_amount)
VALUES ('00000000-0000-0000-0000-000000000006', 'LS ELECTRIC', '탄소중립 EXPO 2025 현장 스케치', '2025-08-20', '수주', true, 10, 2000000, 200000, 2000000);

INSERT INTO quote_items (quote_id, category, contents, each_price, qty, day, sum, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000006', 'production', '촬영감독', 500000, 1, 2, 1000000, 0),
  ('00000000-0000-0000-0000-000000000006', 'production', '진행비', 100000, 1, 1, 100000, 1),
  ('00000000-0000-0000-0000-000000000006', 'Post-production', '종합편집', 300000, 1, 3, 900000, 2);


-- ⑦ 벡스코 고려아연 부스 스케치 영상 제작 (2025-08-18)
INSERT INTO quotes (id, client_name_override, project_title, quote_date, status, is_first_deal, discount_rate, sub_total, vat_amount, final_amount)
VALUES ('00000000-0000-0000-0000-000000000007', '리줌 미디어랩', '벡스코 고려아연 부스 스케치 영상 제작', '2025-08-18', '수주', true, 10, 3800000, 380000, 3800000);

INSERT INTO quote_items (quote_id, category, contents, each_price, qty, day, sum, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000007', 'production', '타임랩스 촬영', 500000, 1, 3, 1500000, 0),
  ('00000000-0000-0000-0000-000000000007', 'production', '촬영감독', 500000, 1, 1, 500000, 1),
  ('00000000-0000-0000-0000-000000000007', 'production', '실내 드론 촬영', 500000, 1, 1, 500000, 2),
  ('00000000-0000-0000-0000-000000000007', 'production', '진행비', 100000, 4, 1, 400000, 3),
  ('00000000-0000-0000-0000-000000000007', 'Post-production', '종합편집', 300000, 1, 3, 900000, 4);


-- ⑧ 블루비젼 11월 행사 스케치 & 스냅사진 촬영 (2025-08-12)
INSERT INTO quotes (id, client_name_override, project_title, quote_date, status, is_first_deal, discount_rate, sub_total, vat_amount, final_amount)
VALUES ('00000000-0000-0000-0000-000000000008', '블루비젼', '11월 행사 스케치 영상 & 스냅사진 촬영', '2025-08-12', '수주', false, 0, 2000000, 200000, 2200000);

INSERT INTO quote_items (quote_id, category, contents, each_price, qty, day, sum, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000008', 'production', '촬영감독', 500000, 1, 1, 500000, 0),
  ('00000000-0000-0000-0000-000000000008', 'production', '장비 사용료', 100000, 1, 1, 100000, 1),
  ('00000000-0000-0000-0000-000000000008', 'production', '진행비', 200000, 1, 1, 200000, 2),
  ('00000000-0000-0000-0000-000000000008', 'production', '사진 촬영', 600000, 1, 1, 600000, 3),
  ('00000000-0000-0000-0000-000000000008', 'Post-production', '종합편집', 200000, 1, 3, 600000, 4);


-- ⑨ 한국여성경제인협회 경남지회 창립 26주년 기념식 (2025-07-08)
INSERT INTO quotes (id, client_name_override, project_title, quote_date, status, is_first_deal, discount_rate, sub_total, vat_amount, final_amount)
VALUES ('00000000-0000-0000-0000-000000000009', '한국여성경제인협회 경남지회', '창립 26주년 기념식 행사진행 및 사진 촬영', '2025-07-08', '수주', false, 0, 1000000, 100000, 1100000);

INSERT INTO quote_items (quote_id, category, contents, each_price, qty, day, sum, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000009', 'production', '행사 MC', 500000, 1, 1, 500000, 0),
  ('00000000-0000-0000-0000-000000000009', 'production', '사진 촬영', 500000, 1, 1, 500000, 1);


-- ⑩ 아이업텐 인터뷰 기반 바이럴 영상 제작 (전체) (2025-06-20)
INSERT INTO quotes (id, client_name_override, project_title, quote_date, status, is_first_deal, discount_rate, sub_total, vat_amount, final_amount)
VALUES ('00000000-0000-0000-0000-000000000010', '아이업텐', '인터뷰 기반 바이럴 영상 제작 (영상제작 전체)', '2025-06-20', '수주', false, 0, 3000000, 300000, 3300000);

INSERT INTO quote_items (quote_id, category, contents, each_price, qty, day, sum, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000010', 'Pre-production', '기획료', 100000, 1, 5, 500000, 0),
  ('00000000-0000-0000-0000-000000000010', 'production', '촬영감독', 800000, 1, 1, 800000, 1),
  ('00000000-0000-0000-0000-000000000010', 'production', '진행비', 200000, 1, 1, 200000, 2),
  ('00000000-0000-0000-0000-000000000010', 'production', '배우 섭외', 300000, 3, 1, 900000, 3),
  ('00000000-0000-0000-0000-000000000010', 'Post-production', '종합편집', 100000, 1, 6, 600000, 4);


-- ⑪ 아이업텐 인터뷰 기반 바이럴 영상 제작 (촬영+편집) (2025-06-20)
INSERT INTO quotes (id, client_name_override, project_title, quote_date, status, is_first_deal, discount_rate, sub_total, vat_amount, final_amount)
VALUES ('00000000-0000-0000-0000-000000000011', '아이업텐', '인터뷰 기반 바이럴 영상 제작 (촬영 및 편집)', '2025-06-20', '미수주', false, 0, 2100000, 210000, 2310000);

INSERT INTO quote_items (quote_id, category, contents, each_price, qty, day, sum, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000011', 'Pre-production', '기획료', 100000, 1, 5, 500000, 0),
  ('00000000-0000-0000-0000-000000000011', 'production', '촬영감독', 800000, 1, 1, 800000, 1),
  ('00000000-0000-0000-0000-000000000011', 'production', '진행비', 200000, 1, 1, 200000, 2),
  ('00000000-0000-0000-0000-000000000011', 'Post-production', '종합편집', 100000, 1, 6, 600000, 3);


-- ⑫ 영도구종합사회복지관 굿앤딩 스케치 영상 제작 (2025-04-30)
INSERT INTO quotes (id, client_name_override, project_title, quote_date, status, is_first_deal, discount_rate, sub_total, vat_amount, final_amount)
VALUES ('00000000-0000-0000-0000-000000000012', '영도구 종합사회복지관', '굿앤딩(Good-And(&)ing) 사업 스케치 영상 제작', '2025-04-30', '수주', false, 0, 2600000, 260000, 2860000);

INSERT INTO quote_items (quote_id, category, contents, each_price, qty, day, sum, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000012', 'Pre-production', '기획료', 500000, 1, 1, 500000, 0),
  ('00000000-0000-0000-0000-000000000012', 'production', '촬영감독', 400000, 1, 3, 1200000, 1),
  ('00000000-0000-0000-0000-000000000012', 'production', '진행비', 100000, 3, 1, 300000, 2),
  ('00000000-0000-0000-0000-000000000012', 'Post-production', '종합편집', 100000, 2, 3, 600000, 3);
