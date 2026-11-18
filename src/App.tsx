import { useEffect, useState } from "react";
import { loadRuntimeConfig, type GitLabConfig, type RuntimeConfig } from "./config";
import { BootScreen, LoginScreen } from "./components/LoginScreen";
import { KanbanScreen } from "./components/KanbanScreen";
import { useGitLabTasks } from "./hooks/useGitLabTasks";
import { useTasks } from "./hooks/useTasks";

export default function App() {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);

  useEffect(() => {
    let active = true;
    loadRuntimeConfig().then((value) => {
      if (active) setConfig(value);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!config) return <BootScreen message="正在加载看板…" />;
  return config.mode === "gitlab" ? <GitLabApp config={config} /> : <LocalApp />;
}

function LocalApp() {
  const store = useTasks();
  return <KanbanScreen store={store} />;
}

function GitLabApp({ config }: { config: GitLabConfig }) {
  const store = useGitLabTasks(config);

  if (store.authStatus === "loading") {
    return <BootScreen message="正在连接 GitLab…" />;
  }

  if (store.authStatus === "none") {
    return <LoginScreen config={config} error={store.error} onLogin={store.login} />;
  }

  if (store.authStatus === "error" || !store.user) {
    return (
      <LoginScreen
        config={config}
        error={store.error ?? "无法完成 GitLab 登录，请重试。"}
        onLogin={store.login}
      />
    );
  }

  return (
    <KanbanScreen
      store={store}
      remote={{
        user: { name: store.user.name, username: store.user.username },
        syncing: store.syncing,
        error: store.error,
        onRefresh: () => {
          void store.refresh();
        },
        onLogout: store.logout,
        onClearError: store.clearError,
        backendEmpty: store.tasks.length === 0 && !store.syncing,
        onImportLocal: store.importLocalTasks,
        onSeedDemo: store.seedDemoTasks,
      }}
    />
  );
}
