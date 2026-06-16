-- Mock 数据：直播间社交互动 + 进行中竞拍演示
-- 依赖：002_seed.sql、005_seed_live_rooms.sql、006_social.sql
-- 可重复执行（先清理再写入）
SET NAMES utf8mb4;

-- 清理本 seed 写入的数据
DELETE FROM room_likes WHERE room_id IN ('room_live_1', 'room_live_2');
DELETE FROM anchor_follows WHERE anchor_id = 1 AND user_id IN (2, 3, 4);
DELETE FROM product_favorites WHERE user_id IN (2, 3, 4) AND product_id IN (1, 3);
DELETE FROM bids WHERE request_id IN ('seed-live1-bid-1', 'seed-live1-bid-2');
DELETE FROM room_comments WHERE id BETWEEN 100 AND 119;

-- 直播间 1：进行中竞拍（演示出价/弹幕/点赞）
UPDATE auction_sessions
SET status = 'running',
    started_at = DATE_SUB(NOW(3), INTERVAL 45 SECOND),
    end_at = DATE_SUB(NOW(3), INTERVAL 45 SECOND) + INTERVAL 120 SECOND,
    current_price = 10000,
    bid_count = 2,
    participant_count = 2
WHERE id = 1;

UPDATE products SET status = 'auctioning' WHERE id = 1;

INSERT INTO bids (session_id, user_id, amount, request_id, seq, is_winning, created_at) VALUES
(1, 2, 0, 'seed-live1-bid-1', 1, 0, DATE_SUB(NOW(3), INTERVAL 40 SECOND)),
(1, 3, 10000, 'seed-live1-bid-2', 2, 1, DATE_SUB(NOW(3), INTERVAL 20 SECOND));

UPDATE live_rooms
SET status = 'live',
    started_at = DATE_SUB(NOW(3), INTERVAL 10 MINUTE),
    current_session_id = 1
WHERE id = 1;

-- 评论 room_id 回填
UPDATE room_comments rc
    INNER JOIN live_rooms lr ON lr.id = rc.live_room_id
    SET rc.room_id = lr.room_id
    WHERE rc.room_id IS NULL;

-- 弹幕（固定 id 100–119，便于幂等）
INSERT INTO room_comments (id, room_id, live_room_id, user_id, content, created_at) VALUES
(100, 'room_live_1', 1, 2, '主播今天福利好多！', DATE_SUB(NOW(3), INTERVAL 8 MINUTE)),
(101, 'room_live_1', 1, 3, '这个表好看，多少钱起拍？', DATE_SUB(NOW(3), INTERVAL 7 MINUTE)),
(102, 'room_live_1', 1, 4, '已关注，坐等开拍', DATE_SUB(NOW(3), INTERVAL 6 MINUTE)),
(103, 'room_live_1', 1, 2, '666666', DATE_SUB(NOW(3), INTERVAL 5 MINUTE)),
(104, 'room_live_1', 1, 3, '冲冲冲！', DATE_SUB(NOW(3), INTERVAL 4 MINUTE)),
(105, 'room_live_1', 1, 4, '能再便宜点吗哈哈', DATE_SUB(NOW(3), INTERVAL 3 MINUTE)),
(106, 'room_live_1', 1, 2, '已经出价了', DATE_SUB(NOW(3), INTERVAL 2 MINUTE)),
(107, 'room_live_1', 1, 3, '莉莉也来了', DATE_SUB(NOW(3), INTERVAL 90 SECOND)),
(108, 'room_live_1', 1, 4, '下一款钱包什么时候上？', DATE_SUB(NOW(3), INTERVAL 60 SECOND)),
(109, 'room_live_1', 1, 2, '主播讲解很详细', DATE_SUB(NOW(3), INTERVAL 30 SECOND)),
(110, 'room_live_2', 2, 3, '什么时候开播呀', DATE_SUB(NOW(3), INTERVAL 2 HOUR)),
(111, 'room_live_2', 2, 4, '蹲一个皮具专场', DATE_SUB(NOW(3), INTERVAL 1 HOUR));

-- 点赞
INSERT INTO room_likes (room_id, user_id, created_at) VALUES
('room_live_1', 2, DATE_SUB(NOW(3), INTERVAL 9 MINUTE)),
('room_live_1', 3, DATE_SUB(NOW(3), INTERVAL 8 MINUTE)),
('room_live_1', 4, DATE_SUB(NOW(3), INTERVAL 7 MINUTE)),
('room_live_1', 2, DATE_SUB(NOW(3), INTERVAL 6 MINUTE)),
('room_live_1', 3, DATE_SUB(NOW(3), INTERVAL 5 MINUTE)),
('room_live_1', 4, DATE_SUB(NOW(3), INTERVAL 4 MINUTE)),
('room_live_1', 2, DATE_SUB(NOW(3), INTERVAL 3 MINUTE)),
('room_live_1', 3, DATE_SUB(NOW(3), INTERVAL 2 MINUTE)),
('room_live_1', 4, DATE_SUB(NOW(3), INTERVAL 1 MINUTE)),
('room_live_1', 2, DATE_SUB(NOW(3), INTERVAL 30 SECOND)),
('room_live_1', 3, DATE_SUB(NOW(3), INTERVAL 20 SECOND)),
('room_live_2', 3, DATE_SUB(NOW(3), INTERVAL 1 HOUR)),
('room_live_2', 4, DATE_SUB(NOW(3), INTERVAL 50 MINUTE));

-- 关注主播
INSERT INTO anchor_follows (user_id, anchor_id, created_at) VALUES
(2, 1, DATE_SUB(NOW(3), INTERVAL 30 DAY)),
(3, 1, DATE_SUB(NOW(3), INTERVAL 15 DAY)),
(4, 1, DATE_SUB(NOW(3), INTERVAL 3 DAY));

-- 商品收藏
INSERT INTO product_favorites (user_id, product_id, created_at) VALUES
(2, 1, DATE_SUB(NOW(3), INTERVAL 2 DAY)),
(3, 1, DATE_SUB(NOW(3), INTERVAL 1 DAY)),
(2, 3, DATE_SUB(NOW(3), INTERVAL 12 HOUR)),
(4, 3, DATE_SUB(NOW(3), INTERVAL 6 HOUR));
