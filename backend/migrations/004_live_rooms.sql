-- 直播间多商品上架 + 弹幕
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS live_rooms (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    anchor_id           BIGINT UNSIGNED NOT NULL,
    title               VARCHAR(128)    NOT NULL,
    cover_url           VARCHAR(512)    NOT NULL DEFAULT '',
    room_id             VARCHAR(64)     NOT NULL COMMENT 'WebSocket 房间 ID，同一直播间共享',
    status              ENUM('idle', 'live', 'ended') NOT NULL DEFAULT 'idle',
    current_session_id  BIGINT UNSIGNED NULL COMMENT '当前讲解/竞拍场次',
    started_at          DATETIME(3)     NULL,
    ended_at            DATETIME(3)     NULL,
    created_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_room_id (room_id),
    KEY idx_anchor_status (anchor_id, status),
    CONSTRAINT fk_live_rooms_anchor FOREIGN KEY (anchor_id) REFERENCES users (id),
    CONSTRAINT fk_live_rooms_session FOREIGN KEY (current_session_id) REFERENCES auction_sessions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='直播间';

CREATE TABLE IF NOT EXISTS live_room_items (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    live_room_id    BIGINT UNSIGNED NOT NULL,
    product_id      BIGINT UNSIGNED NOT NULL,
    session_id      BIGINT UNSIGNED NULL,
    sort_order      INT UNSIGNED    NOT NULL DEFAULT 0,
    status          ENUM('queued', 'on_air', 'sold', 'skipped') NOT NULL DEFAULT 'queued',
    created_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_room_product (live_room_id, product_id),
    KEY idx_room_sort (live_room_id, sort_order),
    CONSTRAINT fk_items_room FOREIGN KEY (live_room_id) REFERENCES live_rooms (id),
    CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products (id),
    CONSTRAINT fk_items_session FOREIGN KEY (session_id) REFERENCES auction_sessions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='直播间商品货架';

CREATE TABLE IF NOT EXISTS room_comments (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    live_room_id    BIGINT UNSIGNED NOT NULL,
    user_id         BIGINT UNSIGNED NOT NULL,
    content         VARCHAR(500)    NOT NULL,
    is_hidden       TINYINT(1)      NOT NULL DEFAULT 0,
    created_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_room_created (live_room_id, created_at),
    CONSTRAINT fk_comments_room FOREIGN KEY (live_room_id) REFERENCES live_rooms (id),
    CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='直播间弹幕';

ALTER TABLE auction_sessions
    ADD COLUMN live_room_id BIGINT UNSIGNED NULL COMMENT '所属直播间' AFTER anchor_id,
    ADD KEY idx_live_room (live_room_id);

-- 同一直播间多场共享 room_id，去掉场次级唯一约束
ALTER TABLE auction_sessions DROP INDEX uk_room_id;
ALTER TABLE auction_sessions ADD KEY idx_room_id (room_id);
