type Props = {
  title?: string
  coverUrl?: string
}

/** 模拟直播画面：封面 + 动态扫描线 */
export function LiveVideo({ title, coverUrl }: Props) {
  return (
    <div className="live-video">
      {coverUrl ? (
        <img className="live-video__cover" src={coverUrl} alt="" />
      ) : (
        <div className="live-video__gradient" />
      )}
      <div className="live-video__scan" aria-hidden />
      <div className="live-video__badge">LIVE</div>
      {title && <div className="live-video__title">{title}</div>}
    </div>
  )
}
