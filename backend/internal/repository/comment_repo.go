package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/zhibo/backend/internal/domain"
)

type CommentRepo struct {
	db *sql.DB
}

func NewCommentRepo(db *sql.DB) *CommentRepo {
	return &CommentRepo{db: db}
}

type CommentRow struct {
	ID         uint64
	LiveRoomID uint64
	UserID     uint64
	Nickname   string
	Avatar     string
	Content    string
	IsHidden   bool
	CreatedAt  time.Time
}

func (r *CommentRepo) Create(ctx context.Context, liveRoomID, userID uint64, content string) (*domain.RoomComment, error) {
	const q = `INSERT INTO room_comments (live_room_id, user_id, content) VALUES (?, ?, ?)`
	res, err := r.db.ExecContext(ctx, q, liveRoomID, userID, content)
	if err != nil {
		return nil, fmt.Errorf("insert comment: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, uint64(id))
}

func (r *CommentRepo) GetByID(ctx context.Context, id uint64) (*domain.RoomComment, error) {
	const q = `SELECT id, live_room_id, user_id, content, is_hidden, created_at FROM room_comments WHERE id = ?`
	row := r.db.QueryRowContext(ctx, q, id)
	var c domain.RoomComment
	var hidden int
	err := row.Scan(&c.ID, &c.LiveRoomID, &c.UserID, &c.Content, &hidden, &c.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	c.IsHidden = hidden == 1
	return &c, nil
}

func (r *CommentRepo) ListByRoom(ctx context.Context, liveRoomID uint64, limit int, includeHidden bool) ([]CommentRow, error) {
	if limit < 1 || limit > 200 {
		limit = 50
	}
	q := `SELECT c.id, c.live_room_id, c.user_id, u.nickname, u.avatar, c.content, c.is_hidden, c.created_at
		FROM room_comments c
		INNER JOIN users u ON u.id = c.user_id
		WHERE c.live_room_id = ?`
	if !includeHidden {
		q += ` AND c.is_hidden = 0`
	}
	q += ` ORDER BY c.id DESC LIMIT ?`
	rows, err := r.db.QueryContext(ctx, q, liveRoomID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []CommentRow
	for rows.Next() {
		var row CommentRow
		var hidden int
		if err := rows.Scan(&row.ID, &row.LiveRoomID, &row.UserID, &row.Nickname, &row.Avatar,
			&row.Content, &hidden, &row.CreatedAt); err != nil {
			return nil, err
		}
		row.IsHidden = hidden == 1
		items = append(items, row)
	}
	return items, rows.Err()
}

func (r *CommentRepo) Hide(ctx context.Context, commentID, liveRoomID, anchorID uint64) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE room_comments c
		 INNER JOIN live_rooms lr ON lr.id = c.live_room_id
		 SET c.is_hidden = 1
		 WHERE c.id = ? AND c.live_room_id = ? AND lr.anchor_id = ?`,
		commentID, liveRoomID, anchorID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return domain.ErrNotFound
	}
	return nil
}
