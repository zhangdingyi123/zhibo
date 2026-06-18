import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }

type State = { error: Error | null }

export class AdminErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('admin render error', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="admin-page">
          <h2>页面加载失败</h2>
          <p className="form-error">{this.state.error.message}</p>
          <p className="muted">请尝试刷新页面，或返回商品管理。</p>
          <a href="/admin/products" className="btn-primary">返回商品管理</a>
        </div>
      )
    }
    return this.props.children
  }
}
