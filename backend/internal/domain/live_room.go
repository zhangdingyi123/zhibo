package domain

import "time"

type LiveRoomStatus string

const (
	LiveRoomStatusIdle  LiveRoomStatus = "idle"
	LiveRoomStatusLive  LiveRoomStatus = "live"
	LiveRoomStatusEnded LiveRoomStatus = "ended"
)

type LiveRoomItemStatus string

const (
	LiveRoomItemQueued  LiveRoomItemStatus = "queued"
	LiveRoomItemOnAir   LiveRoomItemStatus = "on_air"
	LiveRoomItemSold    LiveRoomItemStatus = "sold"
	LiveRoomItemSkipped LiveRoomItemStatus = "skipped"
)

type LiveRoom struct {
	ID               uint64         `json:"id"`
	AnchorID         uint64         `json:"anchorId"`
	Title            string         `json:"title"`
	CoverURL         string         `json:"coverUrl"`
	RoomID           string         `json:"roomId"`
	Status           LiveRoomStatus `json:"status"`
	CurrentSessionID *uint64        `json:"currentSessionId,omitempty"`
	StartedAt        *time.Time     `json:"startedAt,omitempty"`
	EndedAt          *time.Time     `json:"endedAt,omitempty"`
	CreatedAt        time.Time      `json:"createdAt"`
	UpdatedAt        time.Time      `json:"updatedAt"`
}

type LiveRoomItem struct {
	ID         uint64             `json:"id"`
	LiveRoomID uint64             `json:"liveRoomId"`
	ProductID  uint64             `json:"productId"`
	SessionID  *uint64            `json:"sessionId,omitempty"`
	SortOrder  uint32             `json:"sortOrder"`
	Status     LiveRoomItemStatus `json:"status"`
	CreatedAt  time.Time          `json:"createdAt"`
	UpdatedAt  time.Time          `json:"updatedAt"`
}

type RoomComment struct {
	ID         uint64    `json:"id"`
	LiveRoomID uint64    `json:"liveRoomId"`
	UserID     uint64    `json:"userId"`
	Content    string    `json:"content"`
	IsHidden   bool      `json:"isHidden"`
	CreatedAt  time.Time `json:"createdAt"`
}

func DefaultLiveRoomID(liveRoomID uint64) string {
	return "room_live_" + formatUint(liveRoomID)
}
