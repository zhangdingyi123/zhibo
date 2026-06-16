-- 演示：一个直播间上架多个商品
SET NAMES utf8mb4;

INSERT INTO live_rooms (id, anchor_id, title, cover_url, room_id, status, current_session_id, started_at) VALUES
(1, 1, '小美晚间福利专场', 'https://picsum.photos/seed/live1/800', 'room_live_1', 'live', 1, DATE_SUB(NOW(3), INTERVAL 10 MINUTE)),
(2, 1, '皮具臻选好物', 'https://picsum.photos/seed/live2/800', 'room_live_2', 'idle', NULL, NULL)
ON DUPLICATE KEY UPDATE title = VALUES(title), status = VALUES(status);

-- 将已有场次 1、2 挂到直播间 1
UPDATE auction_sessions SET live_room_id = 1, room_id = 'room_live_1' WHERE id IN (1, 2);

INSERT INTO live_room_items (live_room_id, product_id, session_id, sort_order, status) VALUES
(1, 1, 1, 0, 'on_air'),
(1, 3, 2, 1, 'queued')
ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order), status = VALUES(status);

-- 基础弹幕（006 迁移后会自动回填 room_id）
INSERT IGNORE INTO room_comments (live_room_id, user_id, content) VALUES
(1, 2, '来了来了！'),
(1, 3, '今晚有什么好物？');
