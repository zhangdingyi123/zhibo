package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/zhibo/backend/internal/api/middleware"
	"github.com/zhibo/backend/internal/api/response"
	"github.com/zhibo/backend/internal/domain"
	"github.com/zhibo/backend/internal/service"
)

type LiveRoomHandler struct {
	svc *service.LiveRoomService
}

func NewLiveRoomHandler(svc *service.LiveRoomService) *LiveRoomHandler {
	return &LiveRoomHandler{svc: svc}
}

type liveRoomBody struct {
	Title    string `json:"title"`
	CoverURL string `json:"coverUrl"`
}

type addShelfBody struct {
	ProductID        uint64 `json:"productId" binding:"required"`
	StartingPrice    int64  `json:"startingPrice"`
	BidIncrement     int64  `json:"bidIncrement" binding:"required"`
	CapPrice         *int64 `json:"capPrice"`
	DurationSec      int    `json:"durationSec" binding:"required"`
	ExtendThresholdSec int  `json:"extendThresholdSec"`
	ExtendSec        int    `json:"extendSec"`
}

type commentBody struct {
	Content string `json:"content" binding:"required"`
}

func (h *LiveRoomHandler) Create(c *gin.Context) {
	var body liveRoomBody
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Fail(c, domain.ErrNotFound)
		return
	}
	user := middleware.CurrentUser(c)
	lr, err := h.svc.Create(c.Request.Context(), user.ID, service.CreateLiveRoomInput{
		Title:    body.Title,
		CoverURL: body.CoverURL,
	})
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.Created(c, lr)
}

func (h *LiveRoomHandler) List(c *gin.Context) {
	user := middleware.CurrentUser(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	items, total, err := h.svc.ListByAnchor(c.Request.Context(), user.ID, page, pageSize)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{"items": items, "total": total, "page": page, "pageSize": pageSize})
}

func (h *LiveRoomHandler) Get(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.Fail(c, domain.ErrNotFound)
		return
	}
	user := middleware.CurrentUser(c)
	detail, err := h.svc.GetDetail(c.Request.Context(), id, true, 80)
	if err != nil {
		response.Fail(c, err)
		return
	}
	if detail.AnchorID != user.ID {
		response.Fail(c, domain.ErrForbidden)
		return
	}
	response.OK(c, detail)
}

func (h *LiveRoomHandler) Update(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.Fail(c, domain.ErrNotFound)
		return
	}
	var body liveRoomBody
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Fail(c, domain.ErrNotFound)
		return
	}
	user := middleware.CurrentUser(c)
	lr, err := h.svc.UpdateMeta(c.Request.Context(), user.ID, id, body.Title, body.CoverURL)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, lr)
}

func (h *LiveRoomHandler) AddItem(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.Fail(c, domain.ErrNotFound)
		return
	}
	var body addShelfBody
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Fail(c, domain.ErrInvalidBidIncrement)
		return
	}
	rules := domain.AuctionRules{
		StartingPrice:      body.StartingPrice,
		BidIncrement:       body.BidIncrement,
		CapPrice:           body.CapPrice,
		DurationSec:        uint32(body.DurationSec),
		ExtendThresholdSec: uint32(body.ExtendThresholdSec),
		ExtendSec:          uint32(body.ExtendSec),
	}
	if rules.ExtendThresholdSec == 0 {
		rules.ExtendThresholdSec = 10
	}
	if rules.ExtendSec == 0 {
		rules.ExtendSec = 30
	}
	user := middleware.CurrentUser(c)
	item, err := h.svc.AddShelfItem(c.Request.Context(), user.ID, id, service.AddShelfItemInput{
		ProductID: body.ProductID,
		Rules:     rules,
	})
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.Created(c, item)
}

func (h *LiveRoomHandler) RemoveItem(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.Fail(c, domain.ErrNotFound)
		return
	}
	itemID, err := parseUintParam(c, "itemId")
	if err != nil {
		response.Fail(c, domain.ErrNotFound)
		return
	}
	user := middleware.CurrentUser(c)
	if err := h.svc.RemoveShelfItem(c.Request.Context(), user.ID, id, itemID); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{"removed": true})
}

func (h *LiveRoomHandler) Start(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.Fail(c, domain.ErrNotFound)
		return
	}
	user := middleware.CurrentUser(c)
	detail, err := h.svc.StartLive(c.Request.Context(), user.ID, id)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, detail)
}

func (h *LiveRoomHandler) End(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.Fail(c, domain.ErrNotFound)
		return
	}
	user := middleware.CurrentUser(c)
	lr, err := h.svc.EndLive(c.Request.Context(), user.ID, id)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, lr)
}

func (h *LiveRoomHandler) Switch(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.Fail(c, domain.ErrNotFound)
		return
	}
	sessionID, err := parseUintParam(c, "sessionId")
	if err != nil {
		response.Fail(c, domain.ErrNotFound)
		return
	}
	user := middleware.CurrentUser(c)
	detail, err := h.svc.SwitchSession(c.Request.Context(), user.ID, id, sessionID)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, detail)
}

func (h *LiveRoomHandler) ListComments(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.Fail(c, domain.ErrNotFound)
		return
	}
	user := middleware.CurrentUser(c)
	detail, err := h.svc.GetDetail(c.Request.Context(), id, false, 0)
	if err != nil {
		response.Fail(c, err)
		return
	}
	if detail.AnchorID != user.ID {
		response.Fail(c, domain.ErrForbidden)
		return
	}
	comments, err := h.svc.ListComments(c.Request.Context(), id, 100, true)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{"items": comments})
}

func (h *LiveRoomHandler) HideComment(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.Fail(c, domain.ErrNotFound)
		return
	}
	commentID, err := parseUintParam(c, "commentId")
	if err != nil {
		response.Fail(c, domain.ErrNotFound)
		return
	}
	user := middleware.CurrentUser(c)
	if err := h.svc.HideComment(c.Request.Context(), user.ID, id, commentID); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{"hidden": true})
}

// --- 用户端 ---

func (h *LiveRoomHandler) ListPublic(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	items, total, err := h.svc.ListPublic(c.Request.Context(), page, pageSize)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{"items": items, "total": total, "page": page, "pageSize": pageSize})
}

func (h *LiveRoomHandler) GetPublic(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.Fail(c, domain.ErrNotFound)
		return
	}
	detail, err := h.svc.GetDetail(c.Request.Context(), id, true, 30)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, detail)
}

func (h *LiveRoomHandler) GetPublicByRoomID(c *gin.Context) {
	roomID := c.Param("roomId")
	detail, err := h.svc.GetDetailByRoomID(c.Request.Context(), roomID, true)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, detail)
}

func (h *LiveRoomHandler) PostComment(c *gin.Context) {
	id, err := parseUintParam(c, "id")
	if err != nil {
		response.Fail(c, domain.ErrNotFound)
		return
	}
	var body commentBody
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Fail(c, domain.ErrCommentEmpty)
		return
	}
	user := middleware.CurrentUser(c)
	view, err := h.svc.PostComment(c.Request.Context(), id, user.ID, body.Content)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.Created(c, view)
}

func parseUintParam(c *gin.Context, name string) (uint64, error) {
	v, err := strconv.ParseUint(c.Param(name), 10, 64)
	if err != nil || v == 0 {
		return 0, domain.ErrNotFound
	}
	return v, nil
}
