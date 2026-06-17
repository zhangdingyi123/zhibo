import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  addLiveRoomItem,
  endLiveRoom,
  getLiveRoom,
  hideRoomComment,
  listAdminRoomComments,
  listProducts,
  removeLiveRoomItem,
  startLiveRoom,
  switchLiveRoomSession,
} from '../../api/admin'
import type { LiveRoomDetail, ProductView } from '../../api/types'
import type { RoomComment } from '../../api/social'
import { LiveVideo } from '../../components/auction/LiveVideo'
import { useAuctionSocket } from '../../ws'
import { EventCommentNew } from '../../ws/types'
import { getToken, getUser } from '../../auth/session'
import { formatCents } from '../../utils/money'
import { StatusBadge } from '../components/StatusBadge'
import {
  LIVE_ROOM_ITEM_STATUS_LABEL,
  LIVE_ROOM_STATUS_LABEL,
  SESSION_STATUS_LABEL,
} from '../labels'

export function LiveRoomConsolePage() {
  const { id } = useParams<{ id: string }>()
  const liveRoomId = Number(id)
  const [detail, setDetail] = useState<LiveRoomDetail | null>(null)
  const [products, setProducts] = useState<ProductView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [danmaku, setDanmaku] = useState<RoomComment[]>([])
  const user = getUser()
  const token = getToken()

  const load = useCallback(async () => {
    if (!Number.isFinite(liveRoomId)) return
    setLoading(true)
    setError(null)
    try {
      const [room, prodRes] = await Promise.all([
        getLiveRoom(liveRoomId),
        listProducts({ page: 1, pageSize: 100, status: 'listed' }),
      ])
      setDetail(room)
      setProducts(prodRes.items ?? [])
      if (room.roomId) {
        try {
          const commentsRes = await listAdminRoomComments(room.roomId)
          setDanmaku(commentsRes?.items ?? [])
        } catch {
          setDanmaku([])
        }
      } else {
        setDanmaku([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [liveRoomId])

  useEffect(() => {
    void load()
  }, [load])

  const { lastEvent, snapshot } = useAuctionSocket({
    roomId: detail?.roomId ?? '',
    token,
    openId: user?.openId ?? null,
    userId: user ? String(user.id) : null,
    enabled: Boolean(detail?.roomId && detail.status === 'live'),
  })

  const handledSeq = useRef(0)
  useEffect(() => {
    if (!lastEvent?.type) return
    const seq = lastEvent.seq ?? 0
    if (seq > 0 && seq <= handledSeq.current) return
    if (seq > 0) handledSeq.current = seq

    if (lastEvent.type === EventCommentNew) {
      const p = lastEvent.payload as { comment?: RoomComment } | undefined
      if (p?.comment && !p.comment.isHidden) {
        setDanmaku((prev) => [...prev.slice(-79), p.comment!])
      }
    }
    if (lastEvent.type === 'session.switch') {
      void load()
    }
  }, [lastEvent, load])

  const currentItem = detail?.items.find((i) => i.status === 'on_air')
  const currentProduct = currentItem?.product

  async function runAction(fn: () => Promise<unknown>) {
    setBusy(true)
    try {
      await fn()
      await load()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleAddProduct(productId: number) {
    await runAction(() =>
      addLiveRoomItem(liveRoomId, {
        productId,
        startingPrice: 0,
        bidIncrement: 1000,
        durationSec: 120,
        extendThresholdSec: 10,
        extendSec: 30,
      }),
    )
  }

  if (!Number.isFinite(liveRoomId)) {
    return <p className="form-error">无效的直播间 ID</p>
  }

  if (loading && !detail) {
    return <p className="muted">加载直播间工作台…</p>
  }

  if (error && !detail) {
    return (
      <div className="admin-page">
        <p className="form-error">{error}</p>
        <Link to="/admin/live-rooms">返回列表</Link>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="admin-page">
        <p className="muted">直播间数据为空，请返回列表重试</p>
        <Link to="/admin/live-rooms">返回列表</Link>
      </div>
    )
  }

  const roomItems = detail.items ?? []
  const shelvedProductIds = new Set(roomItems.map((i) => i.productId))
  const availableProducts = products.filter((p) => !shelvedProductIds.has(p.id))

  return (
    <div className="admin-page live-console">
      <div className="admin-page__head">
        <div>
          <Link to="/admin/live-rooms" className="muted">
            ← 直播间列表
          </Link>
          <h2>{detail.title}</h2>
          <p className="page-desc">
            <StatusBadge
              label={LIVE_ROOM_STATUS_LABEL[detail.status]}
              tone={detail.status === 'live' ? 'success' : 'warn'}
            />
            <span className="mono" style={{ marginLeft: 8 }}>
              {detail.roomId}
            </span>
          </p>
        </div>
        <div className="live-console__actions">
          {detail.status === 'idle' && (
            <button
              type="button"
              className="btn-primary"
              disabled={busy || roomItems.length === 0}
              onClick={() => void runAction(() => startLiveRoom(liveRoomId))}
            >
              开始直播
            </button>
          )}
          {detail.status === 'live' && (
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => void runAction(() => endLiveRoom(liveRoomId))}
            >
              结束直播
            </button>
          )}
          <a
            href={`/app/live/${detail.roomId}`}
            className="btn-ghost"
            target="_blank"
            rel="noreferrer"
          >
            观众端预览
          </a>
        </div>
      </div>

      <div className="live-console__grid">
        <section className="live-console__preview card">
          <LiveVideo
            title={currentProduct?.name ?? detail.title}
            coverUrl={currentProduct?.coverUrl ?? detail.coverUrl}
          />
          {snapshot && (
            <div className="live-console__snapshot">
              <span>当前价 {formatCents(snapshot.currentPrice)}</span>
              <span>{snapshot.participantCount} 人参与</span>
            </div>
          )}
        </section>

        <section className="live-console__shelf card">
          <h3>商品货架</h3>
          <p className="page-desc">同一直播间可上架多个商品，点击切换讲解</p>
          <ul className="live-console__item-list">
            {roomItems.map((item) => (
              <li
                key={item.id}
                className={`live-console__item${item.status === 'on_air' ? ' live-console__item--active' : ''}`}
              >
                <img
                  src={item.product?.coverUrl}
                  alt=""
                  className="live-console__item-thumb"
                />
                <div className="live-console__item-meta">
                  <strong>{item.product?.name ?? `商品 #${item.productId}`}</strong>
                  <span className="muted">
                    {LIVE_ROOM_ITEM_STATUS_LABEL[item.status]}
                    {item.session &&
                      ` · ${SESSION_STATUS_LABEL[item.session.status] ?? item.session.status}`}
                  </span>
                </div>
                <div className="live-console__item-btns">
                  {detail.status === 'live' && item.sessionId && item.status !== 'on_air' && (
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      disabled={busy}
                      onClick={() =>
                        void runAction(() =>
                          switchLiveRoomSession(liveRoomId, item.sessionId!),
                        )
                      }
                    >
                      讲解此商品
                    </button>
                  )}
                  {item.status === 'queued' && detail.status !== 'live' && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() =>
                        void runAction(() => removeLiveRoomItem(liveRoomId, item.id))
                      }
                    >
                      移除
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {detail.status !== 'ended' && availableProducts.length > 0 && (
            <div className="live-console__add">
              <label className="muted">从商品库上架</label>
              <select
                defaultValue=""
                onChange={(e) => {
                  const pid = Number(e.target.value)
                  if (pid) void handleAddProduct(pid)
                  e.target.value = ''
                }}
              >
                <option value="">选择商品…</option>
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        <section className="live-console__danmaku card">
          <h3>弹幕管理</h3>
          <ul className="live-console__dm-list">
            {danmaku.length === 0 && <li className="muted">暂无弹幕</li>}
            {danmaku.map((c) => (
              <li key={c.id} className={c.isHidden ? 'live-console__dm--hidden' : ''}>
                <span className="live-console__dm-user">{c.nickname}</span>
                <span>{c.content}</span>
                {!c.isHidden && (
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() => void runAction(() => hideRoomComment(c.id))}
                  >
                    屏蔽
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
