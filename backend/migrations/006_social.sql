-- 社交互动：点赞、收藏、关注；评论表增加 room_id 索引字段
SET NAMES utf8mb4;

ALTER TABLE room_comments
    ADD COLUMN room_id VARCHAR(64) NULL COMMENT 'WS 房间 ID，与 live_rooms.room_id 对齐' AFTER id,
    MODIFY live_room_id BIGINT UNSIGNED NULL,
    ADD KEY idx_room_id_created (room_id, created_at);

UPDATE room_comments rc
    INNER JOIN live_rooms lr ON lr.id = rc.live_room_id
    SET rc.room_id = lr.room_id
    WHERE rc.room_id IS NULL;

CREATE TABLE IF NOT EXISTS room_likes (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    room_id     VARCHAR(64)     NOT NULL,
    user_id     BIGINT UNSIGNED NOT NULL,
    created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_room (room_id),
    KEY idx_user_room (user_id, room_id),
    CONSTRAINT fk_room_likes_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='直播间点赞';

CREATE TABLE IF NOT EXISTS product_favorites (
    user_id     BIGINT UNSIGNED NOT NULL,
    product_id  BIGINT UNSIGNED NOT NULL,
    created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (user_id, product_id),
    KEY idx_product (product_id),
    CONSTRAINT fk_fav_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_fav_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品收藏';

CREATE TABLE IF NOT EXISTS anchor_follows (
    user_id     BIGINT UNSIGNED NOT NULL,
    anchor_id   BIGINT UNSIGNED NOT NULL,
    created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (user_id, anchor_id),
    KEY idx_anchor (anchor_id),
    CONSTRAINT fk_follow_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_follow_anchor FOREIGN KEY (anchor_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='关注主播';
