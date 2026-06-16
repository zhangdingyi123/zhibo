import { Link, useNavigate } from 'react-router-dom'
import { ProfileIcon } from '../../components/icons/NavIcons'
import { clearSession, getUser, isAnchorOrAdmin, isLoggedIn } from '../../auth/session'

export function ProfilePage() {
  const navigate = useNavigate()
  const user = getUser()
  const loggedIn = isLoggedIn()

  function logout() {
    clearSession()
    navigate('/app/login', { replace: true })
  }

  if (!loggedIn || !user) {
    return (
      <div className="user-page user-page--profile">
        <header className="page-hero page-hero--compact">
          <div className="page-hero__content">
            <h1 className="page-hero__title">我的</h1>
            <p className="page-hero__sub">登录后参与竞拍与管理订单</p>
          </div>
        </header>
        <section className="user-card user-card--center user-card--elevated">
          <div className="avatar-placeholder" aria-hidden>
            <ProfileIcon className="avatar-placeholder__icon" />
          </div>
          <p className="user-card__lead">登录后可出价、查看订单与支付</p>
          <Link to="/app/login" className="btn-primary btn-block">
            登录
          </Link>
          <Link to="/app/register" className="btn-secondary btn-block">
            注册新账号
          </Link>
        </section>
      </div>
    )
  }

  const roleLabel =
    user.role === 'buyer' ? '买家' : user.role === 'anchor' ? '主播' : '管理员'

  return (
    <div className="user-page user-page--profile">
      <header className="profile-hero">
        <div className="profile-hero__avatar-wrap">
          {user.avatar ? (
            <img src={user.avatar} alt="" className="profile-avatar profile-avatar--lg" />
          ) : (
            <div className="avatar-placeholder avatar-placeholder--lg" aria-hidden>
              <span>{user.nickname.slice(0, 1)}</span>
            </div>
          )}
        </div>
        <div className="profile-hero__info">
          <h1>{user.nickname}</h1>
          <p className="profile-hero__meta">
            {user.phone ?? user.openId}
            <span className="role-chip">{roleLabel}</span>
          </p>
        </div>
        <button type="button" className="btn-ghost btn-sm" onClick={logout}>
          退出
        </button>
      </header>

      <section className="menu-card">
        <h3 className="menu-card__title">快捷入口</h3>
        <ul className="menu-list">
          <li>
            <Link to="/app/orders" className="menu-list__item">
              <span className="menu-list__label">我的订单</span>
              <span className="menu-list__arrow" aria-hidden>›</span>
            </Link>
          </li>
          <li>
            <Link to="/app/history" className="menu-list__item">
              <span className="menu-list__label">历史竞拍</span>
              <span className="menu-list__arrow" aria-hidden>›</span>
            </Link>
          </li>
          {isAnchorOrAdmin() && (
            <li>
              <Link to="/admin" className="menu-list__item menu-list__item--accent">
                <span className="menu-list__label">商家管理后台</span>
                <span className="menu-list__arrow" aria-hidden>›</span>
              </Link>
            </li>
          )}
        </ul>
      </section>
    </div>
  )
}
