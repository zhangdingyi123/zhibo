package api

import (
	"database/sql"
	"log"
	"net/url"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/zhibo/backend/internal/api/handler"
	"github.com/zhibo/backend/internal/api/middleware"
	"github.com/zhibo/backend/internal/config"
	redisc "github.com/zhibo/backend/internal/infra/redis"
	"github.com/zhibo/backend/internal/repository"
	"github.com/zhibo/backend/internal/service"
	"github.com/zhibo/backend/internal/ws"
)

func NewRouter(cfg config.Config, db *sql.DB) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.Use(cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			return corsOriginAllowed(origin, cfg.FrontendURL)
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Mock-Open-Id", "X-User-Id", "X-Client-Id"},
		AllowCredentials: true,
	}))

	health := handler.NewHealthHandler()
	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"service": "zhibo-api",
			"hint":    "这是 API 服务，请访问前端 http://localhost:5173 或接口 /api/v1/health",
			"health":  "/api/v1/health",
			"docs":    "/api/v1/ping",
		})
	})
	r.GET("/health", health.Check)
	r.GET("/api/v1/health", health.Check)

	userRepo := repository.NewUserRepo(db)
	productRepo := repository.NewProductRepo(db)
	sessionRepo := repository.NewSessionRepo(db)
	orderRepo := repository.NewOrderRepo(db)
	bidRepo := repository.NewBidRepo(db)
	liveRoomRepo := repository.NewLiveRoomRepo(db)
	commentRepo := repository.NewCommentRepo(db)
	socialRepo := repository.NewSocialRepo(db)

	orderSvc := service.NewOrderService(orderRepo)
	productSvc := service.NewProductService(productRepo, sessionRepo, orderRepo)
	auctionSvc := service.NewAuctionService(productRepo, sessionRepo, orderSvc)
	userAuctionSvc := service.NewUserAuctionService(sessionRepo, productRepo)
	var bidLocker service.SessionLocker = service.NoopLocker{}
	var roomCache service.RoomCache
	if rdb, err := redisc.Open(cfg); err != nil {
		log.Printf("redis: %v (出价分布式锁已禁用，仅 DB 行锁+乐观锁)", err)
	} else {
		bidLocker = rdb
		roomCache = service.NewRedisRoomCache(rdb, sessionRepo)
		log.Printf("redis: connected %s (lock + room cache)", cfg.RedisAddr)
	}
	bidSvc := service.NewBidService(db, sessionRepo, bidRepo, productRepo, orderRepo, bidLocker)
	if roomCache != nil {
		userAuctionSvc.SetRoomCache(roomCache)
		bidSvc.SetRoomCache(roomCache)
		auctionSvc.SetRoomCache(roomCache)
	}
	liveRoomSvc := service.NewLiveRoomService(liveRoomRepo, productRepo, sessionRepo, commentRepo, userRepo, auctionSvc, userAuctionSvc)
	socialSvc := service.NewSocialService(socialRepo, userRepo, liveRoomRepo, sessionRepo, productRepo)

	hub := ws.NewHub(sessionRepo, bidRepo, userAuctionSvc, bidSvc)
	roomNotifier := ws.NewNotifier(hub, bidRepo)
	if roomCache != nil {
		roomNotifier.SetRoomCache(roomCache)
	}
	bidSvc.SetRoomNotifier(roomNotifier)
	auctionSvc.SetRoomNotifier(roomNotifier)
	liveRoomSvc.SetBroadcaster(roomNotifier)
	socialSvc.SetBroadcaster(hub)

	metricsH := handler.NewMetricsHandler(hub)
	r.GET("/api/v1/metrics", metricsH.Get)

	authSvc := service.NewAuthService(userRepo, cfg.JWTSecret)
	authH := handler.NewAuthHandler(authSvc)

	wsH := ws.NewHandler(hub, userRepo, cfg.JWTSecret)
	r.GET("/api/v1/ws", wsH.ServeWS)

	productH := handler.NewProductHandler(productSvc)
	auctionH := handler.NewAuctionHandler(auctionSvc)
	orderH := handler.NewOrderHandler(orderSvc)
	userAuctionH := handler.NewUserAuctionHandler(userAuctionSvc, bidSvc)
	userOrderH := handler.NewUserOrderHandler(orderSvc)
	liveRoomH := handler.NewLiveRoomHandler(liveRoomSvc)
	socialH := handler.NewSocialHandler(socialSvc)

	v1 := r.Group("/api/v1")
	{
		v1.GET("/ping", func(c *gin.Context) {
			c.JSON(200, gin.H{"message": "pong"})
		})
		v1.POST("/auth/register", authH.Register)
		v1.POST("/auth/login", authH.Login)
		v1.GET("/auth/me", middleware.RequireAuth(userRepo, cfg.JWTSecret), authH.Me)
	}

	// 用户端（2.7–2.9）：列表/详情/快照可匿名；出价需登录
	user := v1.Group("")
	{
		user.GET("/auctions", userAuctionH.List)
		user.GET("/auctions/:sessionId", userAuctionH.Get)
		user.GET("/auctions/:sessionId/snapshot", userAuctionH.Snapshot)
		user.GET("/rooms/:roomId/snapshot", userAuctionH.SnapshotByRoom)

		user.GET("/rooms/:roomId/stats", middleware.OptionalAuth(userRepo, cfg.JWTSecret), socialH.GetStats)
		user.GET("/rooms/:roomId/comments", socialH.ListComments)
		user.GET("/anchors/:anchorId/brief", socialH.GetAnchorBrief)

		user.GET("/live-rooms", liveRoomH.ListPublic)
		user.GET("/live-rooms/:id", liveRoomH.GetPublic)
		user.GET("/live-rooms/by-room/:roomId", liveRoomH.GetPublicByRoomID)

		user.POST("/auctions/:sessionId/bids", middleware.RequireAuth(userRepo, cfg.JWTSecret), userAuctionH.PlaceBid)

		userAuth := user.Group("")
		userAuth.Use(middleware.RequireAuth(userRepo, cfg.JWTSecret))
		{
			userAuth.GET("/orders", userOrderH.List)
			userAuth.GET("/orders/:id", userOrderH.Get)
			userAuth.GET("/auctions/:sessionId/order", userOrderH.GetBySession)
			userAuth.POST("/orders/:id/mock-pay", userOrderH.MockPay)
			userAuth.POST("/rooms/:roomId/comments", socialH.PostComment)
			userAuth.POST("/rooms/:roomId/like", socialH.Like)
			userAuth.POST("/products/:productId/favorite", socialH.ToggleFavorite)
			userAuth.POST("/anchors/:anchorId/follow", socialH.ToggleFollow)
		}
	}

	admin := v1.Group("/admin")
	admin.Use(middleware.RequireAuth(userRepo, cfg.JWTSecret), middleware.RequireAnchor())
	{
		admin.POST("/products", productH.Create)
		admin.GET("/products", productH.List)
		admin.GET("/products/:id", productH.Get)
		admin.PUT("/products/:id", productH.Update)
		admin.DELETE("/products/:id", productH.Delete)
		admin.POST("/products/:id/auctions", auctionH.Publish)

		admin.GET("/auctions/:sessionId", auctionH.Get)
		admin.PUT("/auctions/:sessionId/rules", auctionH.UpdateRules)
		admin.POST("/auctions/:sessionId/cancel", auctionH.Cancel)

		admin.GET("/orders", orderH.List)
		admin.GET("/orders/:id", orderH.Get)

		admin.POST("/live-rooms", liveRoomH.Create)
		admin.GET("/live-rooms", liveRoomH.List)
		admin.GET("/live-rooms/:id", liveRoomH.Get)
		admin.PUT("/live-rooms/:id", liveRoomH.Update)
		admin.POST("/live-rooms/:id/items", liveRoomH.AddItem)
		admin.DELETE("/live-rooms/:id/items/:itemId", liveRoomH.RemoveItem)
		admin.POST("/live-rooms/:id/start", liveRoomH.Start)
		admin.POST("/live-rooms/:id/end", liveRoomH.End)
		admin.POST("/live-rooms/:id/switch/:sessionId", liveRoomH.Switch)
		admin.GET("/rooms/:roomId/comments", socialH.AdminListComments)
		admin.POST("/comments/:commentId/hide", socialH.HideComment)
	}

	return r
}

// corsOriginAllowed 允许配置的前端地址，以及同主机不同端口（部署时常用 80/8088）。
func corsOriginAllowed(origin, configured string) bool {
	if origin == "" {
		return true
	}
	if origin == configured {
		return true
	}
	ou, err1 := url.Parse(origin)
	cu, err2 := url.Parse(configured)
	if err1 != nil || err2 != nil || ou.Scheme == "" || cu.Scheme == "" {
		return false
	}
	if ou.Scheme != cu.Scheme {
		return false
	}
	return strings.EqualFold(ou.Hostname(), cu.Hostname())
}
