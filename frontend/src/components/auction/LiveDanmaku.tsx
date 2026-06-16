import { useEffect, useState } from 'react'
import {
  EventBidNew,
  EventCommentNew,
  type BidNewPayload,
  type CommentNewPayload,
  type RoomEvent,
} from '../../ws/types'

type DanmakuItem = {
  id: string
  text: string
  tone: 'bid' | 'comment' | 'hot'
  author?: string
}

type SeedComment = {
  id: number
  nickname: string
  content: string
}

type Props = {
  lastEvent: RoomEvent | null
  seedComments?: SeedComment[]
}

export function LiveDanmaku({ lastEvent, seedComments = [] }: Props) {
  const [items, setItems] = useState<DanmakuItem[]>([])

  useEffect(() => {
    if (seedComments.length === 0) return
    setItems(
      seedComments.slice(-8).map((c) => ({
        id: `seed-${c.id}`,
        text: c.content,
        tone: 'comment' as const,
        author: c.nickname,
      })),
    )
  }, [seedComments])

  useEffect(() => {
    if (!lastEvent?.type) return

    if (lastEvent.type === EventBidNew) {
      const p = lastEvent.payload as BidNewPayload | undefined
      const amount = p?.bid?.amount
      if (amount == null) return
      const yuan = (amount / 100).toFixed(amount % 100 === 0 ? 0 : 2)
      setItems((prev) => [
        ...prev.slice(-14),
        { id: `dm-bid-${lastEvent.seq ?? Date.now()}`, text: `有人出价 ¥${yuan}`, tone: 'bid' },
      ])
      return
    }

    if (lastEvent.type === EventCommentNew) {
      const p = lastEvent.payload as CommentNewPayload | undefined
      const c = p?.comment
      if (!c?.content) return
      setItems((prev) => [
        ...prev.slice(-14),
        {
          id: `dm-c-${c.id}`,
          text: c.content,
          tone: 'comment',
          author: c.nickname,
        },
      ])
    }
  }, [lastEvent])

  if (items.length === 0) return null

  return (
    <div className="live-danmaku" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={`live-danmaku__line live-danmaku__line--${item.tone}`}>
          {item.author && <span className="live-danmaku__author">{item.author}</span>}
          <span>{item.text}</span>
        </div>
      ))}
    </div>
  )
}
