package service

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/zhibo/backend/internal/domain"
	"github.com/zhibo/backend/internal/repository"
)

type LiveRoomBroadcaster interface {
	OnSessionSwitch(ctx context.Context, roomID string, session *domain.AuctionSession, product *domain.Product)
	OnCommentNew(ctx context.Context, roomID string, comment CommentView)
}

type NoopLiveRoomBroadcaster struct{}

func (NoopLiveRoomBroadcaster) OnSessionSwitch(context.Context, string, *domain.AuctionSession, *domain.Product) {}
func (NoopLiveRoomBroadcaster) OnCommentNew(context.Context, string, CommentView)                              {}

type LiveRoomService struct {
	liveRooms *repository.LiveRoomRepo
	products  *repository.ProductRepo
	sessions  *repository.SessionRepo
	comments  *repository.CommentRepo
	users     *repository.UserRepo
	auction   *AuctionService
	snap      *UserAuctionService
	broadcast LiveRoomBroadcaster
}

func NewLiveRoomService(
	liveRooms *repository.LiveRoomRepo,
	products *repository.ProductRepo,
	sessions *repository.SessionRepo,
	comments *repository.CommentRepo,
	users *repository.UserRepo,
	auction *AuctionService,
	snap *UserAuctionService,
) *LiveRoomService {
	return &LiveRoomService{
		liveRooms: liveRooms,
		products:  products,
		sessions:  sessions,
		comments:  comments,
		users:     users,
		auction:   auction,
		snap:      snap,
		broadcast: NoopLiveRoomBroadcaster{},
	}
}

func (s *LiveRoomService) SetBroadcaster(b LiveRoomBroadcaster) {
	if b != nil {
		s.broadcast = b
	}
}

type CreateLiveRoomInput struct {
	Title    string
	CoverURL string
}

type LiveRoomItemView struct {
	ID         uint64                   `json:"id"`
	ProductID  uint64                   `json:"productId"`
	SessionID  *uint64                  `json:"sessionId,omitempty"`
	SortOrder  uint32                   `json:"sortOrder"`
	Status     domain.LiveRoomItemStatus `json:"status"`
	Product    *domain.Product          `json:"product,omitempty"`
	Session    *domain.AuctionSession   `json:"session,omitempty"`
}

type LiveRoomDetail struct {
	domain.LiveRoom
	Items    []LiveRoomItemView `json:"items"`
	Anchor   *AnchorBrief       `json:"anchor,omitempty"`
	Comments []CommentView      `json:"comments,omitempty"`
}

type AnchorBrief struct {
	ID       uint64 `json:"id"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
}

type CommentView struct {
	ID        uint64 `json:"id"`
	UserID    uint64 `json:"userId"`
	Nickname  string `json:"nickname"`
	Avatar    string `json:"avatar"`
	Content   string `json:"content"`
	IsHidden  bool   `json:"isHidden"`
	CreatedAt string `json:"createdAt"`
}

type AddShelfItemInput struct {
	ProductID uint64
	Rules     domain.AuctionRules
}

func (s *LiveRoomService) Create(ctx context.Context, anchorID uint64, in CreateLiveRoomInput) (*domain.LiveRoom, error) {
	title := strings.TrimSpace(in.Title)
	if title == "" {
		title = "我的直播间"
	}
	return s.liveRooms.Create(ctx, repository.CreateLiveRoomInput{
		AnchorID: anchorID,
		Title:    title,
		CoverURL: in.CoverURL,
	})
}

func (s *LiveRoomService) ListByAnchor(ctx context.Context, anchorID uint64, page, pageSize int) ([]domain.LiveRoom, int, error) {
	return s.liveRooms.ListByAnchor(ctx, anchorID, page, pageSize)
}

func (s *LiveRoomService) ListPublic(ctx context.Context, page, pageSize int) ([]domain.LiveRoom, int, error) {
	return s.liveRooms.ListPublic(ctx, page, pageSize)
}

func (s *LiveRoomService) GetDetail(ctx context.Context, id uint64, withComments bool, commentLimit int) (*LiveRoomDetail, error) {
	lr, err := s.liveRooms.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return s.buildDetail(ctx, lr, withComments, commentLimit, true)
}

func (s *LiveRoomService) GetDetailByRoomID(ctx context.Context, roomID string, withComments bool) (*LiveRoomDetail, error) {
	lr, err := s.liveRooms.GetByRoomID(ctx, roomID)
	if err != nil {
		return nil, err
	}
	return s.buildDetail(ctx, lr, withComments, 30, false)
}

func (s *LiveRoomService) buildDetail(ctx context.Context, lr *domain.LiveRoom, withComments bool, commentLimit int, includeHidden bool) (*LiveRoomDetail, error) {
	items, err := s.liveRooms.ListItems(ctx, lr.ID)
	if err != nil {
		return nil, err
	}
	views := make([]LiveRoomItemView, 0, len(items))
	for _, item := range items {
		v := LiveRoomItemView{
			ID:        item.ID,
			ProductID: item.ProductID,
			SessionID: item.SessionID,
			SortOrder: item.SortOrder,
			Status:    item.Status,
		}
		if p, err := s.products.GetByID(ctx, item.ProductID); err == nil {
			v.Product = p
		}
		if item.SessionID != nil {
			if sess, err := s.sessions.GetByID(ctx, *item.SessionID); err == nil {
				v.Session = sess
			}
		}
		views = append(views, v)
	}
	detail := &LiveRoomDetail{
		LiveRoom: *lr,
		Items:    views,
	}
	if u, err := s.users.GetByID(ctx, lr.AnchorID); err == nil {
		detail.Anchor = &AnchorBrief{ID: u.ID, Nickname: u.Nickname, Avatar: u.Avatar}
	}
	if withComments {
		rows, err := s.comments.ListByRoom(ctx, lr.ID, commentLimit, includeHidden)
		if err == nil {
			for i := len(rows) - 1; i >= 0; i-- {
				row := rows[i]
				detail.Comments = append(detail.Comments, CommentView{
					ID:        row.ID,
					UserID:    row.UserID,
					Nickname:  row.Nickname,
					Avatar:    row.Avatar,
					Content:   row.Content,
					IsHidden:  row.IsHidden,
					CreatedAt: row.CreatedAt.Format(time.RFC3339),
				})
			}
		}
	}
	return detail, nil
}

func (s *LiveRoomService) UpdateMeta(ctx context.Context, anchorID, liveRoomID uint64, title, coverURL string) (*domain.LiveRoom, error) {
	if err := s.liveRooms.UpdateMeta(ctx, liveRoomID, anchorID, strings.TrimSpace(title), coverURL); err != nil {
		return nil, err
	}
	return s.liveRooms.GetByID(ctx, liveRoomID)
}

func (s *LiveRoomService) AddShelfItem(ctx context.Context, anchorID, liveRoomID uint64, in AddShelfItemInput) (*LiveRoomItemView, error) {
	if err := in.Rules.Validate(); err != nil {
		return nil, err
	}
	lr, err := s.liveRooms.GetByID(ctx, liveRoomID)
	if err != nil {
		return nil, err
	}
	if lr.AnchorID != anchorID {
		return nil, domain.ErrForbidden
	}
	if lr.Status == domain.LiveRoomStatusEnded {
		return nil, domain.ErrLiveRoomNotEditable
	}
	if _, err := s.liveRooms.GetItemByProduct(ctx, liveRoomID, in.ProductID); err == nil {
		return nil, domain.ErrLiveRoomItemExists
	}
	p, err := s.products.GetByID(ctx, in.ProductID)
	if err != nil {
		return nil, err
	}
	if p.AnchorID != anchorID {
		return nil, domain.ErrForbidden
	}
	active, err := s.sessions.HasActiveByProductID(ctx, in.ProductID)
	if err != nil {
		return nil, err
	}
	if active {
		return nil, domain.ErrActiveSessionExists
	}
	liveRoomIDCopy := liveRoomID
	session, err := s.sessions.Create(ctx, repository.CreateSessionInput{
		ProductID:  in.ProductID,
		AnchorID:   anchorID,
		LiveRoomID: &liveRoomIDCopy,
		RoomID:     lr.RoomID,
		Rules:      in.Rules,
	})
	if err != nil {
		return nil, err
	}
	if p.Status == domain.ProductStatusDraft {
		_ = s.products.UpdateStatus(ctx, in.ProductID, anchorID, domain.ProductStatusListed)
	}
	sortOrder, err := s.liveRooms.NextSortOrder(ctx, liveRoomID)
	if err != nil {
		return nil, err
	}
	item, err := s.liveRooms.AddItem(ctx, liveRoomID, in.ProductID, session.ID, sortOrder)
	if err != nil {
		return nil, err
	}
	return &LiveRoomItemView{
		ID:        item.ID,
		ProductID: item.ProductID,
		SessionID: item.SessionID,
		SortOrder: item.SortOrder,
		Status:    item.Status,
		Product:   p,
		Session:   session,
	}, nil
}

func (s *LiveRoomService) RemoveShelfItem(ctx context.Context, anchorID, liveRoomID, itemID uint64) error {
	item, err := s.liveRooms.GetItemByID(ctx, itemID)
	if err != nil {
		return err
	}
	if item.LiveRoomID != liveRoomID {
		return domain.ErrLiveRoomItemNotFound
	}
	if err := s.liveRooms.RemoveItem(ctx, itemID, liveRoomID, anchorID); err != nil {
		return err
	}
	if item.SessionID != nil {
		sess, err := s.sessions.GetByID(ctx, *item.SessionID)
		if err == nil && sess.Status == domain.SessionStatusPending && !sess.HasBids() {
			_ = s.auction.Cancel(ctx, anchorID, *item.SessionID, "从直播间货架移除")
		}
	}
	return nil
}

func (s *LiveRoomService) StartLive(ctx context.Context, anchorID, liveRoomID uint64) (*LiveRoomDetail, error) {
	lr, err := s.liveRooms.GetByID(ctx, liveRoomID)
	if err != nil {
		return nil, err
	}
	if lr.AnchorID != anchorID {
		return nil, domain.ErrForbidden
	}
	if lr.Status == domain.LiveRoomStatusLive {
		return s.GetDetail(ctx, liveRoomID, true, 50)
	}
	if lr.Status == domain.LiveRoomStatusEnded {
		return nil, domain.ErrLiveRoomNotEditable
	}
	items, err := s.liveRooms.ListItems(ctx, liveRoomID)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, domain.ErrLiveRoomNoItems
	}
	var firstSessionID *uint64
	for _, item := range items {
		if item.SessionID != nil {
			sid := *item.SessionID
			firstSessionID = &sid
			_ = s.liveRooms.UpdateItemStatus(ctx, item.ID, domain.LiveRoomItemOnAir)
			break
		}
	}
	if firstSessionID == nil {
		return nil, domain.ErrLiveRoomNoItems
	}
	if err := s.liveRooms.SetStatus(ctx, liveRoomID, domain.LiveRoomStatusLive, firstSessionID); err != nil {
		return nil, err
	}
	detail, err := s.GetDetail(ctx, liveRoomID, true, 50)
	if err != nil {
		return nil, err
	}
	for _, v := range detail.Items {
		if v.SessionID != nil && *v.SessionID == *firstSessionID && v.Product != nil {
			sess, _ := s.sessions.GetByID(ctx, *firstSessionID)
			if sess != nil {
				s.broadcast.OnSessionSwitch(ctx, lr.RoomID, sess, v.Product)
			}
			break
		}
	}
	return detail, nil
}

func (s *LiveRoomService) EndLive(ctx context.Context, anchorID, liveRoomID uint64) (*domain.LiveRoom, error) {
	lr, err := s.liveRooms.GetByID(ctx, liveRoomID)
	if err != nil {
		return nil, err
	}
	if lr.AnchorID != anchorID {
		return nil, domain.ErrForbidden
	}
	if lr.Status != domain.LiveRoomStatusLive {
		return nil, domain.ErrLiveRoomNotLive
	}
	if err := s.liveRooms.SetStatus(ctx, liveRoomID, domain.LiveRoomStatusEnded, nil); err != nil {
		return nil, err
	}
	return s.liveRooms.GetByID(ctx, liveRoomID)
}

func (s *LiveRoomService) SwitchSession(ctx context.Context, anchorID, liveRoomID, sessionID uint64) (*LiveRoomDetail, error) {
	lr, err := s.liveRooms.GetByID(ctx, liveRoomID)
	if err != nil {
		return nil, err
	}
	if lr.AnchorID != anchorID {
		return nil, domain.ErrForbidden
	}
	if lr.Status != domain.LiveRoomStatusLive {
		return nil, domain.ErrLiveRoomNotLive
	}
	sess, err := s.sessions.GetByID(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	if sess.AnchorID != anchorID {
		return nil, domain.ErrForbidden
	}
	items, err := s.liveRooms.ListItems(ctx, liveRoomID)
	if err != nil {
		return nil, err
	}
	var targetItem *domain.LiveRoomItem
	for i := range items {
		if items[i].SessionID != nil && *items[i].SessionID == sessionID {
			targetItem = &items[i]
			break
		}
	}
	if targetItem == nil {
		return nil, domain.ErrNotFound
	}
	_ = s.liveRooms.ResetItemsOnAir(ctx, liveRoomID)
	_ = s.liveRooms.UpdateItemStatus(ctx, targetItem.ID, domain.LiveRoomItemOnAir)
	if err := s.liveRooms.SetCurrentSession(ctx, liveRoomID, &sessionID); err != nil {
		return nil, err
	}
	p, _ := s.products.GetByID(ctx, sess.ProductID)
	s.broadcast.OnSessionSwitch(ctx, lr.RoomID, sess, p)
	return s.GetDetail(ctx, liveRoomID, true, 50)
}

func (s *LiveRoomService) PostComment(ctx context.Context, liveRoomID, userID uint64, content string) (*CommentView, error) {
	content = strings.TrimSpace(content)
	if content == "" {
		return nil, domain.ErrCommentEmpty
	}
	if utf8.RuneCountInString(content) > 200 {
		return nil, domain.ErrCommentTooLong
	}
	lr, err := s.liveRooms.GetByID(ctx, liveRoomID)
	if err != nil {
		return nil, err
	}
	c, err := s.comments.Create(ctx, liveRoomID, userID, content)
	if err != nil {
		return nil, err
	}
	u, _ := s.users.GetByID(ctx, userID)
	view := CommentView{
		ID:        c.ID,
		UserID:    c.UserID,
		Content:   c.Content,
		CreatedAt: c.CreatedAt.Format(time.RFC3339),
	}
	if u != nil {
		view.Nickname = u.Nickname
		view.Avatar = u.Avatar
	}
	s.broadcast.OnCommentNew(ctx, lr.RoomID, view)
	return &view, nil
}

func (s *LiveRoomService) HideComment(ctx context.Context, anchorID, liveRoomID, commentID uint64) error {
	return s.comments.Hide(ctx, commentID, liveRoomID, anchorID)
}

func (s *LiveRoomService) ListComments(ctx context.Context, liveRoomID uint64, limit int, includeHidden bool) ([]CommentView, error) {
	rows, err := s.comments.ListByRoom(ctx, liveRoomID, limit, includeHidden)
	if err != nil {
		return nil, err
	}
	views := make([]CommentView, 0, len(rows))
	for i := len(rows) - 1; i >= 0; i-- {
		row := rows[i]
		views = append(views, CommentView{
			ID:        row.ID,
			UserID:    row.UserID,
			Nickname:  row.Nickname,
			Avatar:    row.Avatar,
			Content:   row.Content,
			IsHidden:  row.IsHidden,
			CreatedAt: row.CreatedAt.Format(time.RFC3339),
		})
	}
	return views, nil
}
