package domain

import "time"

type RoomComment struct {
	ID         uint64    `json:"id"`
	LiveRoomID uint64    `json:"liveRoomId,omitempty"`
	RoomID     string    `json:"roomId,omitempty"`
	UserID     uint64    `json:"userId"`
	Nickname   string    `json:"nickname,omitempty"`
	Avatar     string    `json:"avatar,omitempty"`
	Content    string    `json:"content"`
	IsHidden   bool      `json:"isHidden,omitempty"`
	CreatedAt  time.Time `json:"createdAt"`
}
