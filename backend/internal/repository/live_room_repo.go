package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/zhibo/backend/internal/domain"
)

type LiveRoomRepo struct {
	db *sql.DB
}

func NewLiveRoomRepo(db *sql.DB) *LiveRoomRepo {
	return &LiveRoomRepo{db: db}
}

type CreateLiveRoomInput struct {
	AnchorID uint64
	Title    string
	CoverURL string
}

func (r *LiveRoomRepo) Create(ctx context.Context, in CreateLiveRoomInput) (*domain.LiveRoom, error) {
	placeholderRoom := fmt.Sprintf("room_tmp_live_%d", time.Now().UnixNano())
	const q = `INSERT INTO live_rooms (anchor_id, title, cover_url, room_id, status)
		VALUES (?, ?, ?, ?, 'idle')`
	res, err := r.db.ExecContext(ctx, q, in.AnchorID, in.Title, in.CoverURL, placeholderRoom)
	if err != nil {
		return nil, fmt.Errorf("insert live room: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	roomID := domain.DefaultLiveRoomID(uint64(id))
	if _, err := r.db.ExecContext(ctx, `UPDATE live_rooms SET room_id = ? WHERE id = ?`, roomID, id); err != nil {
		return nil, err
	}
	return r.GetByID(ctx, uint64(id))
}

func (r *LiveRoomRepo) GetByID(ctx context.Context, id uint64) (*domain.LiveRoom, error) {
	const q = `SELECT id, anchor_id, title, cover_url, room_id, status,
		current_session_id, started_at, ended_at, created_at, updated_at
		FROM live_rooms WHERE id = ?`
	return r.scanOne(ctx, q, id)
}

func (r *LiveRoomRepo) GetByRoomID(ctx context.Context, roomID string) (*domain.LiveRoom, error) {
	const q = `SELECT id, anchor_id, title, cover_url, room_id, status,
		current_session_id, started_at, ended_at, created_at, updated_at
		FROM live_rooms WHERE room_id = ?`
	return r.scanOne(ctx, q, roomID)
}

func (r *LiveRoomRepo) ListByAnchor(ctx context.Context, anchorID uint64, page, pageSize int) ([]domain.LiveRoom, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize
	var total int
	if err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM live_rooms WHERE anchor_id = ?`, anchorID).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, anchor_id, title, cover_url, room_id, status,
			current_session_id, started_at, ended_at, created_at, updated_at
			FROM live_rooms WHERE anchor_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
		anchorID, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var items []domain.LiveRoom
	for rows.Next() {
		lr, err := scanLiveRoom(rows)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, *lr)
	}
	return items, total, rows.Err()
}

func (r *LiveRoomRepo) ListPublic(ctx context.Context, page, pageSize int) ([]domain.LiveRoom, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize
	var total int
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM live_rooms`).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, anchor_id, title, cover_url, room_id, status,
			current_session_id, started_at, ended_at, created_at, updated_at
			FROM live_rooms ORDER BY FIELD(status, 'live', 'idle', 'ended'), id DESC LIMIT ? OFFSET ?`,
		pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var items []domain.LiveRoom
	for rows.Next() {
		lr, err := scanLiveRoom(rows)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, *lr)
	}
	return items, total, rows.Err()
}

func (r *LiveRoomRepo) UpdateMeta(ctx context.Context, id, anchorID uint64, title, coverURL string) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE live_rooms SET title = ?, cover_url = ? WHERE id = ? AND anchor_id = ? AND status != 'ended'`,
		title, coverURL, id, anchorID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return domain.ErrLiveRoomNotEditable
	}
	return nil
}

func (r *LiveRoomRepo) SetStatus(ctx context.Context, id uint64, status domain.LiveRoomStatus, currentSessionID *uint64) error {
	var started, ended sql.NullTime
	now := time.Now()
	switch status {
	case domain.LiveRoomStatusLive:
		started = sql.NullTime{Time: now, Valid: true}
	case domain.LiveRoomStatusEnded:
		ended = sql.NullTime{Time: now, Valid: true}
	}
	var cs sql.NullInt64
	if currentSessionID != nil {
		cs = sql.NullInt64{Int64: int64(*currentSessionID), Valid: true}
	}
	_, err := r.db.ExecContext(ctx,
		`UPDATE live_rooms SET status = ?, current_session_id = ?,
			started_at = COALESCE(started_at, ?), ended_at = ?
			WHERE id = ?`,
		status, cs, started, ended, id)
	return err
}

func (r *LiveRoomRepo) SetCurrentSession(ctx context.Context, id uint64, sessionID *uint64) error {
	var cs sql.NullInt64
	if sessionID != nil {
		cs = sql.NullInt64{Int64: int64(*sessionID), Valid: true}
	}
	_, err := r.db.ExecContext(ctx, `UPDATE live_rooms SET current_session_id = ? WHERE id = ?`, cs, id)
	return err
}

func (r *LiveRoomRepo) AddItem(ctx context.Context, liveRoomID, productID uint64, sessionID uint64, sortOrder uint32) (*domain.LiveRoomItem, error) {
	const q = `INSERT INTO live_room_items (live_room_id, product_id, session_id, sort_order, status)
		VALUES (?, ?, ?, ?, 'queued')`
	res, err := r.db.ExecContext(ctx, q, liveRoomID, productID, sessionID, sortOrder)
	if err != nil {
		return nil, fmt.Errorf("insert live room item: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	return r.GetItemByID(ctx, uint64(id))
}

func (r *LiveRoomRepo) GetItemByID(ctx context.Context, id uint64) (*domain.LiveRoomItem, error) {
	const q = `SELECT id, live_room_id, product_id, session_id, sort_order, status, created_at, updated_at
		FROM live_room_items WHERE id = ?`
	row := r.db.QueryRowContext(ctx, q, id)
	return scanLiveRoomItem(row)
}

func (r *LiveRoomRepo) GetItemByProduct(ctx context.Context, liveRoomID, productID uint64) (*domain.LiveRoomItem, error) {
	const q = `SELECT id, live_room_id, product_id, session_id, sort_order, status, created_at, updated_at
		FROM live_room_items WHERE live_room_id = ? AND product_id = ?`
	row := r.db.QueryRowContext(ctx, q, liveRoomID, productID)
	item, err := scanLiveRoomItem(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return item, err
}

func (r *LiveRoomRepo) ListItems(ctx context.Context, liveRoomID uint64) ([]domain.LiveRoomItem, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, live_room_id, product_id, session_id, sort_order, status, created_at, updated_at
			FROM live_room_items WHERE live_room_id = ? ORDER BY sort_order ASC, id ASC`, liveRoomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []domain.LiveRoomItem
	for rows.Next() {
		item, err := scanLiveRoomItem(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (r *LiveRoomRepo) RemoveItem(ctx context.Context, itemID, liveRoomID, anchorID uint64) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE i FROM live_room_items i
		 INNER JOIN live_rooms lr ON lr.id = i.live_room_id
		 WHERE i.id = ? AND i.live_room_id = ? AND lr.anchor_id = ? AND i.status = 'queued'`,
		itemID, liveRoomID, anchorID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return domain.ErrLiveRoomItemNotFound
	}
	return nil
}

func (r *LiveRoomRepo) UpdateItemStatus(ctx context.Context, itemID uint64, status domain.LiveRoomItemStatus) error {
	_, err := r.db.ExecContext(ctx, `UPDATE live_room_items SET status = ? WHERE id = ?`, status, itemID)
	return err
}

func (r *LiveRoomRepo) ResetItemsOnAir(ctx context.Context, liveRoomID uint64) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE live_room_items SET status = 'queued' WHERE live_room_id = ? AND status = 'on_air'`, liveRoomID)
	return err
}

func (r *LiveRoomRepo) NextSortOrder(ctx context.Context, liveRoomID uint64) (uint32, error) {
	var max sql.NullInt64
	err := r.db.QueryRowContext(ctx,
		`SELECT MAX(sort_order) FROM live_room_items WHERE live_room_id = ?`, liveRoomID).Scan(&max)
	if err != nil {
		return 0, err
	}
	if !max.Valid {
		return 0, nil
	}
	return uint32(max.Int64 + 1), nil
}

func (r *LiveRoomRepo) scanOne(ctx context.Context, q string, args ...any) (*domain.LiveRoom, error) {
	row := r.db.QueryRowContext(ctx, q, args...)
	lr, err := scanLiveRoom(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return lr, err
}

type liveRoomScanner interface {
	Scan(dest ...any) error
}

func scanLiveRoom(row liveRoomScanner) (*domain.LiveRoom, error) {
	var lr domain.LiveRoom
	var currentSession sql.NullInt64
	var startedAt, endedAt sql.NullTime
	err := row.Scan(
		&lr.ID, &lr.AnchorID, &lr.Title, &lr.CoverURL, &lr.RoomID, &lr.Status,
		&currentSession, &startedAt, &endedAt, &lr.CreatedAt, &lr.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if currentSession.Valid {
		v := uint64(currentSession.Int64)
		lr.CurrentSessionID = &v
	}
	if startedAt.Valid {
		t := startedAt.Time
		lr.StartedAt = &t
	}
	if endedAt.Valid {
		t := endedAt.Time
		lr.EndedAt = &t
	}
	return &lr, nil
}

func scanLiveRoomItem(row liveRoomScanner) (*domain.LiveRoomItem, error) {
	var item domain.LiveRoomItem
	var sessionID sql.NullInt64
	err := row.Scan(
		&item.ID, &item.LiveRoomID, &item.ProductID, &sessionID,
		&item.SortOrder, &item.Status, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if sessionID.Valid {
		v := uint64(sessionID.Int64)
		item.SessionID = &v
	}
	return &item, nil
}
