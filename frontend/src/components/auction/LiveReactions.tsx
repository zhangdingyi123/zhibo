import { useEffect, useState } from 'react'
import { EventLikeUpdate, type LikeUpdatePayload, type RoomEvent } from '../../ws/types'

type Props = {
  lastEvent: RoomEvent | null
  likeCount: number
}

/** 点赞飘心动画 */
export function LiveReactions({ lastEvent, likeCount }: Props) {
  const [hearts, setHearts] = useState<{ id: number; x: number }[]>([])
  const [displayCount, setDisplayCount] = useState(likeCount)

  useEffect(() => {
    setDisplayCount(likeCount)
  }, [likeCount])

  useEffect(() => {
    if (lastEvent?.type !== EventLikeUpdate) return
    const p = lastEvent.payload as LikeUpdatePayload | undefined
    if (p?.likeCount != null) setDisplayCount(p.likeCount)
    const id = Date.now()
    const x = 10 + Math.random() * 60
    setHearts((prev) => [...prev.slice(-8), { id, x }])
  }, [lastEvent])

  useEffect(() => {
    if (hearts.length === 0) return
    const t = window.setTimeout(() => {
      setHearts((prev) => prev.slice(1))
    }, 2200)
    return () => clearTimeout(t)
  }, [hearts])

  return (
    <div className="live-reactions" aria-hidden>
      {displayCount > 0 && (
        <span className="live-reactions__count">{displayCount.toLocaleString('zh-CN')}</span>
      )}
      {hearts.map((h) => (
        <span
          key={h.id}
          className="live-reactions__heart"
          style={{ right: `${h.x}%` }}
        >
          ♥
        </span>
      ))}
    </div>
  )
}
