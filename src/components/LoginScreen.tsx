import { AlertTriangle, Cloud, Loader2, ShieldCheck, Users } from "lucide-react";
import type { GitLabConfig } from "../config";

interface LoginScreenProps {
  config: GitLabConfig;
  error?: string | null;
  onLogin: () => void;
}

export function LoginScreen({ error, onLogin }: LoginScreenProps) {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark">P</div>
          <div>
            <div className="brand-title">
              Plan
              <span className="brand-badge">任务排期看板</span>
            </div>
            <div className="brand-sub">GitLab 协作模式</div>
          </div>
        </div>

        <span className="login-kicker">CONNECT GITLAB</span>
        <h1 className="login-title">连接 GitLab，开始团队协作</h1>
        <p className="login-desc">
          使用 GitLab 账号登录后，任务会保存为项目中的 Issues，可在多台设备与团队成员之间共享。
        </p>

        <ul className="login-list">
          <li>
            <Users size={16} />
            任务、负责人、标签与排期同步到 GitLab
          </li>
          <li>
            <ShieldCheck size={16} />
            使用 GitLab OAuth 授权，权限由项目成员关系控制
          </li>
          <li>
            <Cloud size={16} />
            本地浏览器只是缓存，不再作为唯一数据源
          </li>
        </ul>

        {error && (
          <div className="login-error" role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <button type="button" className="btn btn-primary login-btn" onClick={onLogin}>
          <Cloud size={17} />
          使用 GitLab 登录
        </button>
        <p className="login-hint">
          登录后会跳转到 GitLab 授权页面，仅申请访问 GitLab API 的权限。数据存储在你当前有权限访问的
          GitLab 项目中。
        </p>
      </div>
    </div>
  );
}

export function BootScreen({ message }: { message: string }) {
  return (
    <div className="boot-screen">
      <div className="boot-inner">
        <div className="brand-mark">P</div>
        <div className="boot-text">{message}</div>
        <Loader2 size={20} className="spin" />
      </div>
    </div>
  );
}
