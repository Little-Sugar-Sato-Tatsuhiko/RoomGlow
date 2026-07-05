# RoomGlow

Windows Mini PC + 4K ディスプレイで常時稼働させる、Atmoph Window 風の背景動画表示システム。
本体は Web アプリ（Node.js + Express + React）で、Chrome/Edge のキオスクモードでも、Electron のデスクトップアプリとしても動かせる（動画選択ロジックと表示コンポーネントを分離しているため、どちらでも同じ仕組みが使われる）。

## 画面構成

| パス       | 内容                                   |
| ---------- | -------------------------------------- |
| `/display` | 4K ディスプレイ表示用（背景動画 + Overlay） |
| `/admin`   | 管理画面（動画一覧・設定変更）          |
| `/api/*`   | フロントエンド用 API                    |

## ディレクトリ

```text
videos/
  morning/   05:00-10:59 に再生する動画
  daytime/   11:00-16:59 に再生する動画
  evening/   17:00-20:59 に再生する動画
  night/     21:00-04:59 に再生する動画
data/
  ai-window.sqlite  動画一覧・設定を保存する SQLite DB（自動生成）
```

対応拡張子: `mp4`, `webm`, `mov`, `mkv`

時間帯判定はサーバーのローカルタイムゾーンに依存する。Docker コンテナは既定で UTC になるため、`docker-compose.yml` の `TZ` 環境変数（既定値 `Asia/Tokyo`）を設置場所に合わせて変更すること。Windows Mini PC で直接起動する本番環境では OS のタイムゾーン設定がそのまま使われる。

---

## 開発環境（Docker Compose）

```bash
docker compose up -d --build
```

- `videos/` と `data/` はホストとコンテナ間でマウントされるため、動画ファイルを追加すればすぐに反映できます（要スキャン）。
- ソースコードもマウントしているため、`server/` `src/` の変更はホットリロードされます。

ブラウザで確認:

```text
http://localhost:3000/display
http://localhost:3000/admin
```

起動時に自動で `videos/` のスキャンを行いますが、後から動画を追加した場合は管理画面の「動画フォルダを再スキャン」ボタン、または以下の API を呼び出してください。

```bash
curl -X POST http://localhost:3000/api/videos/scan
```

停止:

```bash
docker compose down
```

## 開発環境（Docker を使わない場合）

```bash
npm install
npm run dev
```

## API 一覧

| メソッド | パス                  | 説明                             |
| -------- | --------------------- | -------------------------------- |
| GET      | `/api/status`          | 現在の時間帯・再生中動画・設定    |
| GET      | `/api/videos`          | 動画一覧                         |
| POST     | `/api/videos/scan`     | `videos/` を再スキャンして DB 更新 |
| PATCH    | `/api/videos/:id`      | 動画の有効/無効を切替 (`{ "enabled": true }`) |
| GET      | `/api/settings`        | 設定一覧                         |
| PATCH    | `/api/settings`        | 設定を更新                       |
| GET      | `/api/current-video`   | 現在時刻・設定から表示すべき動画を取得 |
| POST     | `/api/videos/youtube`  | YouTube 動画を登録 (`{ "url": "https://youtu.be/xxxx", "period": "evening", "title": "任意" }`) |
| DELETE   | `/api/videos/:id`      | 動画をリストから削除                |
| GET      | `/api/weather`         | 現在の気温・天気・6時間先までの予報 |

同一時間帯に有効な動画が複数ある場合、`refreshIntervalSeconds`（更新間隔）ごとに順番へ切り替わる（ローテーション）。有効な動画が1本のみの場合は常にその動画が選ばれる。ローカル動画・YouTube 動画は同じ仕組みで混在できる。

### YouTube 動画の埋め込みについて

管理画面の「YouTube動画を追加」から、URL（`watch?v=`, `youtu.be/`, `shorts/` いずれの形式も可）または動画IDを登録できる。動画ファイル自体はダウンロード・保存せず、YouTube 公式の IFrame Player を `/display` に埋め込んでストリーミング再生する（YouTube 利用規約に準拠した方法）。

- 常時インターネット接続が必要（ローカル動画のみの運用なら不要）。
- タイトル未入力時は YouTube の oEmbed から自動取得する（API キー不要）。
- 埋め込み無効化・削除済みなど再生できない動画は自動的に黒背景へフォールバックする。
- キオスク起動時は自動再生がブロックされないよう、`scripts/start-kiosk-edge.bat` / `start-kiosk-chrome.bat` に `--autoplay-policy=no-user-gesture-required` を付与済み。
- 著作権者が意図しない形での再配布・ダウンロードは行わないこと。あくまで個人利用の範囲で、公式プレイヤーによるストリーミング再生に留めること。

### 天気表示について

Overlay に現在の気温・天気・6時間先までの気温/天気予報を表示できる。天気データは [Open-Meteo](https://open-meteo.com/)（APIキー不要・無料）から取得する。

- 管理画面の「緯度」「経度」で観測地点を設定する（既定値は東京）。
- 「天気表示」設定でOverlayでの表示有無を切り替えられる。
- サーバー側で10分間キャッシュするため、頻繁に呼び出してもAPIへの負荷は小さい。
- 取得に失敗した場合は天気部分のみ非表示になり、他の表示（時計・動画など）には影響しない。

---

## 本番運用（Windows Mini PC）

本番では Docker を使わず、Windows Mini PC 上で Node.js アプリを直接起動する。

### 1. セットアップ

```bat
npm install
npm run build
```

`videos/morning` `videos/daytime` `videos/evening` `videos/night` に動画ファイルを配置する。

### 2. アプリ起動

```bat
npm run start
```

`scripts/start-app.bat` を実行しても同様に起動できる。

### 3. ディスプレイをキオスクモードで表示

Edge の場合、`scripts/start-kiosk-edge.bat`:

```bat
start msedge --kiosk http://localhost:3000/display --edge-kiosk-type=fullscreen
```

Chrome の場合、`scripts/start-kiosk-chrome.bat`:

```bat
start chrome --kiosk http://localhost:3000/display
```

### 4. Windows 起動時に自動実行する

1. `Win + R` → `shell:startup` でスタートアップフォルダを開く。
2. `scripts/start-app.bat` と、使用するブラウザの `scripts/start-kiosk-edge.bat`（または `start-kiosk-chrome.bat`）へのショートカットを作成し、スタートアップフォルダに配置する。
3. PC 再起動後、アプリ起動 → 数秒後にキオスクモードでディスプレイが立ち上がることを確認する。

キオスクモード終了は `Alt + F4`。

---

## デスクトップアプリ（Electron）

ブラウザのキオスクモードの代わりに、Windows/Mac 上でダブルクリックで起動できるデスクトップアプリとしても動かせる。中身は同じ Node/Express サーバーを Electron のメインプロセス内でそのまま起動し、`/display` を表示するウィンドウを開く仕組み。

### 開発中に動作確認する

```bash
npm run electron:start
```

内部で以下を順に行う。

1. `npm run build`（フロントエンドを `dist/` へビルド）
2. `npm run build:electron-server`（`server/` を esbuild で `electron/server-bundle.cjs` に単一ファイルへバンドル。`better-sqlite3` は native モジュールのため対象外）
3. `npm run electron:rebuild`（`better-sqlite3` を Electron の Node ABI 向けに再ビルド）
4. `electron .` でアプリを起動

起動すると、書き込み用のデータ・動画フォルダは OS 標準のユーザーデータ領域（Mac: `~/Library/Application Support/ai-window-web/`、Windows: `%APPDATA%/ai-window-web/`）に作成される。サーバーはポート競合を避けるため毎回空いているポートを自動選択する。

ウィンドウを閉じる/管理画面を開く手段:

- タスクトレイ（メニューバー）アイコンから「ディスプレイ画面を表示」「管理画面を開く」「フルスクリーン切替」「終了」を選べる
- ショートカット: `Cmd/Ctrl+Shift+A` で管理画面、`Cmd/Ctrl+Shift+D` でディスプレイ画面、`F11` でフルスクリーン切替、`Cmd/Ctrl+Q` で終了

### 配布用インストーラーを作る

```bash
npm run electron:build
```

`electron-builder` により `release/` 配下に Mac 用（dmg）・Windows 用（NSIS インストーラー）が生成される。

**注意点:**

- `better-sqlite3` は Node 用とElectron用でネイティブバイナリの ABI が異なる。`npm run electron:rebuild` を実行すると、ローカルの `node_modules` が Electron 向けにビルドされた状態になるため、その後 `npm run dev` / `npm run start` を素の Node で実行する場合は `npm rebuild` （または `npm install` の再実行）で元に戻すこと。Docker Compose 経由の開発環境は `node_modules` がコンテナ内に隔離されているため、この影響を受けない。
- Mac 用ビルドはコード署名なしの開発用ビルドになるため、初回起動時に「開発元を確認できません」という警告が出る。Finder でアプリを右クリック→「開く」で起動できる。
- Windows 用ビルドは Windows 実機での起動確認を推奨する（このリポジトリの開発環境は Mac のため、Windows 上での最終動作確認は未実施）。

---

## 時間帯の定義

管理画面の「時間帯の判定方法」で「自動」「手動」を選べる。

- **自動（既定）**: 天気設定の緯度・経度から [suncalc](https://github.com/mourner/suncalc) で日の出・日没を計算し、季節に応じて次のように判定する。
  - 朝: 日の出 〜 日の出+3時間
  - 昼: 朝の終わり 〜 日没-2時間
  - 夕方: 昼の終わり 〜 日没+1時間
  - 夜: それ以外（日没+1時間 〜 翌日の日の出）
- **手動**: 4つの開始時刻（朝/昼/夕方/夜）を直接指定する。既定値は次の通り。

```text
morning: 05:00 -
daytime: 11:00 -
evening: 17:00 -
night:   21:00 -
```

いずれのモードでも、緯度・経度・時刻の設定値が不正/未設定の場合は上記の既定値にフォールバックする。

## エラーハンドリング

- 動画が存在しない/再生できない場合は黒背景を表示する。
- 該当時間帯に有効な動画がない場合は Overlay に `No video available` と表示する。
- API エラーは JSON (`{ "error": "..." }`) で返す。
- DB ファイルや `videos/` 配下のディレクトリが存在しない場合は起動時に自動作成する。

## 今後の拡張

- `CalendarWidget`（`src/components/`）は表示用の枠のみ実装済み。カレンダー連携を追加する際は、このコンポーネントに data を渡すだけで表示できる。
- 動画選択ロジック（`server/services/playlistService.ts`）と表示コンポーネント（`src/components/BackgroundVideo.tsx`）は分離しているため、将来的に mpv 化する場合も API 部分はそのまま流用できる。
