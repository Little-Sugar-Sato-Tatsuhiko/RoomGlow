import { useCallback, useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { LocationDetectResponse, Settings, StatusResponse, VideoListItem, Period } from "../types.ts";
import { PERIOD_LABELS } from "../types.ts";

const PERIOD_ORDER: Period[] = ["morning", "daytime", "evening", "night"];

export default function AdminPage() {
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [scanning, setScanning] = useState(false);
  const [youtubeForm, setYoutubeForm] = useState({ url: "", period: "daytime" as Period, title: "" });
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectMessage, setDetectMessage] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [videosRes, settingsRes, statusRes] = await Promise.all([
      fetch("/api/videos"),
      fetch("/api/settings"),
      fetch("/api/status"),
    ]);
    const videosData = await videosRes.json();
    setVideos(videosData.videos);
    setSettings(await settingsRes.json());
    setStatus(await statusRes.json());
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleScan() {
    setScanning(true);
    try {
      const res = await fetch("/api/videos/scan", { method: "POST" });
      const data = await res.json();
      setVideos(data.videos);
    } finally {
      setScanning(false);
    }
  }

  async function toggleVideo(video: VideoListItem) {
    const res = await fetch(`/api/videos/${video.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !video.enabled }),
    });
    const updated = await res.json();
    setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
  }

  async function deleteVideo(video: VideoListItem) {
    await fetch(`/api/videos/${video.id}`, { method: "DELETE" });
    setVideos((prev) => prev.filter((v) => v.id !== video.id));
  }

  async function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    setSettings(await res.json());
    // DisplayPage is a sibling component (always-mounted behind this modal) with its
    // own polling loop; nudge it to refetch now instead of waiting for its next tick.
    window.dispatchEvent(new Event("roomglow:settings-changed"));
  }

  async function handleDetectLocation() {
    setDetecting(true);
    setDetectMessage(null);
    try {
      const res = await fetch("/api/location/detect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setDetectMessage(data.error ?? "現在地の検出に失敗しました");
        return;
      }
      const location = data as LocationDetectResponse;
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              weatherLatitude: location.latitude,
              weatherLongitude: location.longitude,
              locationSource: "auto",
            }
          : prev
      );
      setDetectMessage(`検出結果: ${location.city ?? "不明な都市"}（緯度 ${location.latitude} / 経度 ${location.longitude}）`);
    } catch {
      setDetectMessage("現在地の検出に失敗しました");
    } finally {
      setDetecting(false);
    }
  }

  async function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    setImportMessage(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await fetch("/api/videos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videos: parsed.videos }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportMessage(data.error ?? "インポートに失敗しました");
        return;
      }
      setVideos(data.videos);
      setImportMessage(
        `追加: ${data.imported}件 / 更新: ${data.updated}件` +
          (data.skipped.length > 0 ? ` / スキップ: ${data.skipped.length}件` : "")
      );
    } catch {
      setImportMessage("ファイルの読み込みに失敗しました（JSON形式を確認してください）");
    } finally {
      setImporting(false);
    }
  }

  async function handleAddYoutube(e: FormEvent) {
    e.preventDefault();
    setYoutubeError(null);
    setAdding(true);
    try {
      const res = await fetch("/api/videos/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: youtubeForm.url,
          period: youtubeForm.period,
          title: youtubeForm.title || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setYoutubeError(data.error ?? "追加に失敗しました");
        return;
      }
      setVideos((prev) => [...prev, data]);
      setYoutubeForm({ url: "", period: youtubeForm.period, title: "" });
    } finally {
      setAdding(false);
    }
  }

  if (!settings) {
    return <div className="admin-page admin-loading">読み込み中...</div>;
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>RoomGlow 管理画面</h1>
        {status && (
          <p className="admin-status">
            現在の時間帯: <strong>{PERIOD_LABELS[status.period]}</strong> / 再生中:{" "}
            <strong>{status.currentVideo?.name ?? "なし"}</strong>
          </p>
        )}
      </header>

      <section className="admin-section">
        <h2>表示設定</h2>
        <div className="settings-grid">
          <label className="setting-row">
            <span>自動切替</span>
            <input
              type="checkbox"
              checked={settings.autoMode}
              onChange={(e) => updateSetting("autoMode", e.target.checked)}
            />
          </label>
          <label className="setting-row">
            <span>Overlay表示</span>
            <input
              type="checkbox"
              checked={settings.overlayEnabled}
              onChange={(e) => updateSetting("overlayEnabled", e.target.checked)}
            />
          </label>
          <label className="setting-row">
            <span>時計表示</span>
            <input
              type="checkbox"
              checked={settings.clockEnabled}
              onChange={(e) => updateSetting("clockEnabled", e.target.checked)}
            />
          </label>
          <label className="setting-row">
            <span>更新間隔（秒）</span>
            <input
              type="number"
              min={5}
              value={settings.refreshIntervalSeconds}
              onChange={(e) => updateSetting("refreshIntervalSeconds", Number(e.target.value))}
            />
          </label>
          <label className="setting-row">
            <span>天気表示</span>
            <input
              type="checkbox"
              checked={settings.weatherEnabled}
              onChange={(e) => updateSetting("weatherEnabled", e.target.checked)}
            />
          </label>
          <label className="setting-row">
            <span>緯度</span>
            <input
              type="number"
              step="0.0001"
              value={settings.weatherLatitude}
              onChange={(e) => updateSetting("weatherLatitude", Number(e.target.value))}
            />
          </label>
          <label className="setting-row">
            <span>経度</span>
            <input
              type="number"
              step="0.0001"
              value={settings.weatherLongitude}
              onChange={(e) => updateSetting("weatherLongitude", Number(e.target.value))}
            />
          </label>
          <label className="setting-row">
            <span>雨雲レーダー表示</span>
            <input
              type="checkbox"
              checked={settings.radarEnabled}
              onChange={(e) => updateSetting("radarEnabled", e.target.checked)}
            />
          </label>
          <label className="setting-row">
            <span>雨予報時のみレーダー表示</span>
            <input
              type="checkbox"
              checked={settings.radarOnlyWhenRainy}
              onChange={(e) => updateSetting("radarOnlyWhenRainy", e.target.checked)}
            />
          </label>
        </div>
        <div className="admin-section-actions" style={{ marginTop: "0.75rem" }}>
          <button type="button" onClick={handleDetectLocation} disabled={detecting}>
            {detecting ? "検出中..." : "現在地を自動検出"}
          </button>
          <span className="empty-message">
            {settings.locationSource === "manual" ? "現在は手動設定（緯度・経度を直接編集すると自動検出は行われなくなります）" : "IPアドレスから自動検出した位置情報を使用中"}
          </span>
        </div>
        {detectMessage && <p className="empty-message">{detectMessage}</p>}
      </section>

      <section className="admin-section">
        <h2>時間帯の判定方法</h2>
        <div className="settings-grid">
          <label className="setting-row">
            <span>判定方法</span>
            <select
              value={settings.periodMode}
              onChange={(e) => updateSetting("periodMode", e.target.value as Settings["periodMode"])}
            >
              <option value="auto">自動（緯度・経度から日の出/日没で判定）</option>
              <option value="manual">手動（時刻を指定）</option>
            </select>
          </label>
        </div>
        {settings.periodMode === "auto" ? (
          <p className="empty-message">
            上の「緯度」「経度」をもとに、季節ごとの日の出・日没から朝/昼/夕方/夜を自動計算します。
          </p>
        ) : (
          <div className="settings-grid">
            <label className="setting-row">
              <span>朝の開始時刻</span>
              <input
                type="time"
                value={settings.morningStartTime}
                onChange={(e) => updateSetting("morningStartTime", e.target.value)}
              />
            </label>
            <label className="setting-row">
              <span>昼の開始時刻</span>
              <input
                type="time"
                value={settings.daytimeStartTime}
                onChange={(e) => updateSetting("daytimeStartTime", e.target.value)}
              />
            </label>
            <label className="setting-row">
              <span>夕方の開始時刻</span>
              <input
                type="time"
                value={settings.eveningStartTime}
                onChange={(e) => updateSetting("eveningStartTime", e.target.value)}
              />
            </label>
            <label className="setting-row">
              <span>夜の開始時刻</span>
              <input
                type="time"
                value={settings.nightStartTime}
                onChange={(e) => updateSetting("nightStartTime", e.target.value)}
              />
            </label>
          </div>
        )}
      </section>

      <section className="admin-section">
        <h2>YouTube動画を追加</h2>
        <form className="youtube-form" onSubmit={handleAddYoutube}>
          <input
            type="text"
            placeholder="YouTube URL または 動画ID"
            value={youtubeForm.url}
            onChange={(e) => setYoutubeForm((f) => ({ ...f, url: e.target.value }))}
            required
          />
          <select
            value={youtubeForm.period}
            onChange={(e) => setYoutubeForm((f) => ({ ...f, period: e.target.value as Period }))}
          >
            {PERIOD_ORDER.map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABELS[p]}（{p}）
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="タイトル（省略可）"
            value={youtubeForm.title}
            onChange={(e) => setYoutubeForm((f) => ({ ...f, title: e.target.value }))}
          />
          <button type="submit" disabled={adding}>
            {adding ? "追加中..." : "追加"}
          </button>
        </form>
        {youtubeError && <p className="form-error">{youtubeError}</p>}
      </section>

      <section className="admin-section">
        <div className="admin-section-header">
          <h2>動画一覧</h2>
          <div className="admin-section-actions">
            <a className="button-link" href="/api/videos/export" download>
              エクスポート
            </a>
            <label className="button-link">
              {importing ? "インポート中..." : "インポート"}
              <input
                type="file"
                accept="application/json"
                onChange={handleImportFile}
                disabled={importing}
                hidden
              />
            </label>
            <button onClick={handleScan} disabled={scanning}>
              {scanning ? "スキャン中..." : "動画フォルダを再スキャン"}
            </button>
          </div>
        </div>
        {importMessage && <p className="empty-message">{importMessage}</p>}

        {PERIOD_ORDER.map((period) => {
          const periodVideos = videos.filter((v) => v.period === period);
          return (
            <div key={period} className="video-group">
              <h3>{PERIOD_LABELS[period]}（{period}）</h3>
              {periodVideos.length === 0 ? (
                <p className="empty-message">動画がありません</p>
              ) : (
                <ul className="video-list">
                  {periodVideos.map((video) => (
                    <li key={video.id} className="video-item">
                      <span className="video-name">
                        {video.source === "youtube" && (
                          <img
                            className="video-thumbnail"
                            src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`}
                            alt=""
                          />
                        )}
                        {video.name}
                        <span className={`video-badge video-badge--${video.source}`}>
                          {video.source === "youtube" ? "YouTube" : "ローカル"}
                        </span>
                      </span>
                      <label className="video-toggle">
                        <input
                          type="checkbox"
                          checked={video.enabled}
                          onChange={() => toggleVideo(video)}
                        />
                        有効
                      </label>
                      <button type="button" className="video-delete" onClick={() => deleteVideo(video)}>
                        削除
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
