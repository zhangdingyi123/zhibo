import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getToken, getUser, isLoggedIn } from '../../auth/session'
import type { AnchorBrief, RoomSocialStats } from '../../api/social'
import type { LiveRoomStatus, SessionSummary } from '../../api/types'
import { useAuctionNotifications } from '../../hooks/useAuctionNotifications'
import { useBidThrottle } from '../../hooks/useBidThrottle'
import { useAuctionSocket } from '../../ws'
import { EventSessionSwitch, type SessionSwitchPayload, type SettledPayload } from '../../ws/types'
import { connectionLabel } from '../../utils/connectionLabel'
import { BidPanel } from './BidPanel'
import { LiveDanmaku } from './LiveDanmaku'
import { LiveHostBar } from './LiveHostBar'
import { LiveInteractionDock } from './LiveInteractionDock'
import { LivePriceBoard } from './LivePriceBoard'
import { LiveReactions } from './LiveReactions'
import { LiveRoomEmptyBanner } from './LiveRoomEmptyBanner'
import { LiveVideo } from './LiveVideo'
import { ProductStrip } from './ProductStrip'
import { RankLeaderboard } from './RankLeaderboard'
import { ToastStack } from './ToastStack'

type SeedComment = { id: number; nickname: string; content: string }

type Props = {
  roomId?: string
  sessionId?: number
  productId?: number
  productTitle?: string
  coverUrl?: string
  liveRoomTitle?: string
  liveRoomStatus?: LiveRoomStatus
  anchor?: AnchorBrief | null
  roomStats?: RoomSocialStats | null
  multiSku?: boolean
  stripItems?: SessionSummary[]
  seedComments?: SeedComment[]
  onSessionSwitch?: (sessionId: number) => void
  onProductIdChange?: (productId: number) => void
}

export function AuctionLiveRoom({
  roomId: roomIdProp = 'room_sess_1',
  sessionId: sessionIdProp,
  productId: productIdProp,
  productTitle,
  coverUrl,
  liveRoomTitle,
  liveRoomStatus,
  anchor,
  roomStats,
  multiSku = false,
  stripItems = [],
  seedComments = [],
  onSessionSwitch,
  onProductIdChange,
}: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const loginReturnTo = `${location.pathname}${location.search}`
  const [roomId, setRoomId] = useState(roomIdProp)
  const [activeSessionId, setActiveSessionId] = useState(sessionIdProp)
  const [productId, setProductId] = useState(productIdProp)
  const [displayTitle, setDisplayTitle] = useState(productTitle)
  const [displayCover, setDisplayCover] = useState(coverUrl)
  const [likeCount, setLikeCount] = useState(roomStats?.likeCount ?? 0)
  const [isFavorited, setIsFavorited] = useState(roomStats?.isFavorited ?? false)
  const [isFollowing, setIsFollowing] = useState(roomStats?.isFollowing ?? false)
  const [rankOpen, setRankOpen] = useState(false)
  const user = getUser()
  const token = getToken()

  useEffect(() => {
    setRoomId(roomIdProp)
  }, [roomIdProp])

  useEffect(() => {
    setActiveSessionId(sessionIdProp)
    setProductId(productIdProp)
    setDisplayTitle(productTitle)
    setDisplayCover(coverUrl)
  }, [sessionIdProp, productIdProp, productTitle, coverUrl])

  useEffect(() => {
    if (!roomStats) return
    setLikeCount(roomStats.likeCount)
    setIsFavorited(roomStats.isFavorited ?? false)
    setIsFollowing(roomStats.isFollowing ?? false)
  }, [roomStats])

  const {
    connectionState,
    snapshot,
    rank,
    canBid,
    lastError,
    lastEvent,
    isBidding,
    bid,
    reconnect,
  } = useAuctionSocket({
    roomId,
    token,
    openId: user?.openId ?? null,
    userId: user ? String(user.id) : null,
    enabled: Boolean(roomId),
  })

  useEffect(() => {
    if (!lastEvent || lastEvent.type !== EventSessionSwitch) return
    const p = lastEvent.payload as SessionSwitchPayload | undefined
    if (!p?.session?.id) return
    setActiveSessionId(p.session.id)
    setProductId(p.session.productId)
    onProductIdChange?.(p.session.productId)
    setDisplayTitle(p.product?.name ?? displayTitle)
    setDisplayCover(p.product?.coverUrl ?? displayCover)
    onSessionSwitch?.(p.session.id)
  }, [lastEvent, onSessionSwitch, onProductIdChange, displayTitle, displayCover])

  const currentUserId = user?.id ?? null
  const needsReconnect =
    connectionState === 'closed' || connectionState === 'reconnecting'

  const handleSettled = useCallback(
    (payload: SettledPayload) => {
      const sid = payload.session?.id ?? activeSessionId
      if (sid) {
        window.setTimeout(() => navigate(`/app/result/${sid}`), 1500)
      }
    },
    [navigate, activeSessionId],
  )

  const { toasts, dismiss, outbidFlash } = useAuctionNotifications({
    currentUserId,
    rank,
    lastEvent,
    onSettled: handleSettled,
  })

  const { run: throttledBid, cooling } = useBidThrottle(300)
  const [throttleHint, setThrottleHint] = useState<string | null>(null)

  useEffect(() => {
    if (!throttleHint) return
    const t = window.setTimeout(() => setThrottleHint(null), 2000)
    return () => clearTimeout(t)
  }, [throttleHint])

  const handleBid = useCallback(
    (amountCents: number) => {
      const ok = throttledBid(() => bid(amountCents))
      setThrottleHint(ok ? null : '操作过快，请稍候')
    },
    [bid, throttledBid],
  )

  const handleStripSelect = useCallback(
    (sid: number) => {
      const item = stripItems.find((i) => i.sessionId === sid)
      if (item) {
        setDisplayTitle(item.name)
        setDisplayCover(item.coverUrl)
      }
      setActiveSessionId(sid)
      onSessionSwitch?.(sid)
    },
    [stripItems, onSessionSwitch],
  )

  const connected = connectionState === 'connected'
  const displayError = lastError?.message ?? throttleHint
  const displaySnapshot = snapshot

  return (
    <div className={`live-room live-room--social ${outbidFlash ? 'live-room--outbid' : ''}`}>
      <header className="live-room__header">
        <Link to="/app" className="live-room__back" aria-label="返回列表">
          ←
        </Link>
        <div className="live-room__title-wrap">
          <h1 className="live-room__title">
            {multiSku ? (liveRoomTitle ?? displayTitle ?? '直播间') : (displayTitle ?? '直播间竞拍')}
          </h1>
          <span className="live-room__conn conn-badge" data-state={connectionState}>
            {connectionLabel(connectionState)}
          </span>
        </div>
        <div className="live-room__toolbar">
          {isLoggedIn() && user ? (
            <span className="live-room__user muted" title={user.nickname}>
              {user.nickname}
            </span>
          ) : (
            <Link to="/app/login" state={{ from: loginReturnTo }} className="btn-ghost btn-sm">
              登录
            </Link>
          )}
          {needsReconnect && (
            <button type="button" className="btn-ghost btn-sm" onClick={reconnect}>
              重连
            </button>
          )}
        </div>
      </header>

      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <div className="live-room__body live-room__body--stack">
        <div className="live-room__stage">
          <div className="live-room__video-wrap">
            <LiveVideo title={displayTitle} coverUrl={displayCover} />
            <div className="live-room__overlay-top">
              <LiveHostBar
                anchor={anchor}
                liveTitle={liveRoomTitle ?? displayTitle}
                isFollowing={isFollowing}
                loginReturnTo={loginReturnTo}
                onFollowChange={setIsFollowing}
              />
            </div>
            <LiveReactions lastEvent={lastEvent} likeCount={likeCount} />
            <LiveDanmaku lastEvent={lastEvent} seedComments={seedComments} />
          </div>

          {multiSku && stripItems.length > 0 && (
            <ProductStrip
              items={stripItems}
              currentSessionId={displaySnapshot?.sessionId ?? activeSessionId}
              onSelect={handleStripSelect}
            />
          )}

          <div className="live-room__auction-panel">
            {multiSku && !displayTitle && !displaySnapshot && (
              <LiveRoomEmptyBanner liveTitle={liveRoomTitle} status={liveRoomStatus} />
            )}
            <LivePriceBoard snapshot={displaySnapshot} connectionState={connectionState} />
            <button
              type="button"
              className="live-room__rank-toggle"
              aria-expanded={rankOpen}
              onClick={() => setRankOpen((v) => !v)}
            >
              {rankOpen ? '收起排名' : `实时排名 · ${displaySnapshot?.participantCount ?? 0} 人参与`}
            </button>
            {rankOpen && (
              <div className="live-room__rank-sheet">
                <RankLeaderboard
                  items={rank}
                  currentUserId={currentUserId}
                  participantCount={displaySnapshot?.participantCount ?? 0}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <LiveInteractionDock
        roomId={roomId}
        productId={productId}
        likeCount={likeCount}
        isFavorited={isFavorited}
        loginReturnTo={loginReturnTo}
        onLikeCount={setLikeCount}
        onFavoriteChange={setIsFavorited}
      />

      <footer className="live-room__footer">
        <BidPanel
          snapshot={displaySnapshot}
          canBid={canBid}
          isBidding={isBidding}
          cooling={cooling}
          connected={connected}
          error={displayError}
          showCatchUp={outbidFlash}
          loginReturnTo={loginReturnTo}
          onBid={handleBid}
        />
      </footer>
    </div>
  )
}
