import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getAnchorBrief,
  getLiveRoomByRoomId,
  getRoomStats,
  listRoomComments,
  type AnchorBrief,
  type RoomSocialStats,
} from '../../api/social'
import type { LiveRoomDetail, SessionSummary } from '../../api/types'
import { AuctionLiveRoom } from '../../components/auction/AuctionLiveRoom'

export function LiveRoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const [detail, setDetail] = useState<LiveRoomDetail | null>(null)
  const [stats, setStats] = useState<RoomSocialStats | null>(null)
  const [anchor, setAnchor] = useState<AnchorBrief | null>(null)
  const [productId, setProductId] = useState<number | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [seedComments, setSeedComments] = useState<
    { id: number; nickname: string; content: string }[]
  >([])

  const load = useCallback(async () => {
    if (!roomId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getLiveRoomByRoomId(roomId)
      setDetail(data)
      const onAir = data.items.find((i) => i.status === 'on_air') ?? data.items[0]
      const pid = onAir?.productId
      setProductId(pid)
      if (data.anchor) {
        const brief = await getAnchorBrief(data.anchor.id)
        setAnchor(brief)
      }
      const [statsRes, commentsRes] = await Promise.all([
        getRoomStats(roomId, pid),
        listRoomComments(roomId),
      ])
      setStats(statsRes)
      setSeedComments(
        commentsRes.items.map((c) => ({
          id: c.id,
          nickname: c.nickname,
          content: c.content,
        })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [roomId])

  useEffect(() => {
    void load()
  }, [load])

  const refreshStats = useCallback(
    async (pid?: number) => {
      if (!roomId) return
      try {
        const statsRes = await getRoomStats(roomId, pid ?? productId)
        setStats(statsRes)
      } catch {
        /* ignore */
      }
    },
    [roomId, productId],
  )

  if (loading) {
    return <p className="muted" style={{ padding: 24 }}>进入直播间…</p>
  }

  if (error || !detail) {
    return (
      <div style={{ padding: 24 }}>
        <p className="form-error">{error ?? '直播间不存在'}</p>
      </div>
    )
  }

  const stripItems: SessionSummary[] = detail.items
    .filter((i) => i.sessionId != null)
    .map((i) => ({
      sessionId: i.sessionId!,
      name: i.product?.name ?? `商品 #${i.productId}`,
      coverUrl: i.product?.coverUrl,
      status: i.session?.status,
    }))

  const onAir = detail.items.find((i) => i.status === 'on_air') ?? detail.items[0]
  const currentSessionId = detail.currentSessionId ?? onAir?.sessionId

  return (
    <AuctionLiveRoom
      roomId={detail.roomId}
      sessionId={currentSessionId}
      productId={productId ?? onAir?.productId}
      productTitle={onAir?.product?.name}
      coverUrl={onAir?.product?.coverUrl ?? detail.coverUrl}
      liveRoomTitle={detail.title}
      liveRoomStatus={detail.status}
      anchor={anchor}
      roomStats={stats}
      multiSku
      stripItems={stripItems}
      seedComments={seedComments}
      onProductIdChange={(pid) => {
        setProductId(pid)
        void refreshStats(pid)
      }}
    />
  )
}
