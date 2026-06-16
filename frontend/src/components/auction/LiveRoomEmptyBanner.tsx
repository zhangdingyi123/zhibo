import type { LiveRoomStatus } from '../../api/types'

type Props = {
  liveTitle?: string
  status?: LiveRoomStatus
}

export function LiveRoomEmptyBanner({ liveTitle, status }: Props) {
  const msg =
    status === 'idle'
      ? '主播尚未开播，稍后再来'
      : status === 'ended'
        ? '本场直播已结束'
        : '等待主播讲解商品'
  return (
    <div className="live-room-empty-banner">
      <p className="live-room-empty-banner__title">{liveTitle ?? '直播间'}</p>
      <p className="live-room-empty-banner__msg">{msg}</p>
    </div>
  )
}
