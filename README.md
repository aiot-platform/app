# 宠物看护控制面板（uni-app 多端）

基于 Vue 3 + uni-app 实现的宠物寄养看护面板，可构建 H5 / Android / iOS 三端，配套阿里云实时音视频（RTC）实现远程看护与对讲。设备数据链路复用 ThingsPanel 后端，与微信小程序端共用同一套物模型与接口约定。

- 原型：[pet-prd/音视频交互原型.html](../pet-prd/音视频交互原型.html)
- 物模型：[pet-prd/音视频物模型.json](../pet-prd/音视频物模型.json)（ProductKey `a1AvPanel001`）
- 页面入口：`app/pages/pet/index.vue`，能力与数据实现位于 `app/features/pet/`

---

## 一、功能

### 1. 单屏四 Tab 面板

| Tab | 内容 | 出现条件 |
| --- | --- | --- |
| 实时 | 宠物卡片、实时画面、观看 HUD、宠物状态卡、快捷操作 | 常驻 |
| 动态 | 今日日报、店员留言、今日动态时间线 | 常驻 |
| 相册 | 抓拍照片网格、大图查看、新照片角标 | 设备支持 `snapshot` 服务时出现 |
| 更多 | 观看设置 / 画面设置 / 设备状态 三组 | 存在任一可配置项时出现 |

Tab 入口随设备能力**级联隐藏**：不支持的属性/服务对应的 UI 块不渲染，避免出现点不动的空控件。

### 2. 实时画面与音视频

- 封面五态：离线 / 店铺休息 / 连接中 / 推流异常 / 待观看，按设备在线状态与 `av_status` 自动切换。
- 观看 HUD：LIVE 标识、观看时长、观看人数、Wi-Fi 信号、宠物状态浮标、底部操作栏（静音、店内收音电平、画质、对讲、全屏、停止）。
- 对讲：本地麦克风上行，店家扬声器播放；演示模式本地同步 `av_status=2` 呈现「对讲中」。
- 画面设置（夜视 / 翻转）作用于演示占位画面，真实画面由设备侧生效。

### 3. 远程互动

- 抓拍：调用 `snapshot` 服务，成功后写入相册并累加角标。
- 投喂零食：调用 `dispense_treat` 服务，按 `treat_left` 校验剩余次数，成功后写入动态时间线并短暂切换状态图标。

### 4. 能力探测与降级

`features/pet/model/capabilities.js` 依据设备模型与当前回报计算能力集：

- 模型可用：按模型字段判断属性/服务是否存在。
- 模型不可用：按物模型必选集（`av_status` + `start_live`/`stop_live`）兜底，并按回报值推断。
- 枚举选项读取被平台裁剪后的 `specs`，保证画质等下拉选项与设备真实支持范围一致。

### 5. 演示模式

`?demo=1` 或未登录时自动启用演示运行时，**不依赖任何设备与后端**即可查看完整面板：数值每 5 秒缓慢漂移，四个服务按与真实设备一致的返回码模拟。

### 6. 异常提示

读取 30 分钟内的设备事件，按严重级别取最高一条展示告警条（推流异常 / 存储卡异常 / 舍内温度异常 / 吠叫提醒），可关闭；关闭仅隐藏提示，不代表清除设备事件。

### 7. 多端实时音视频实现路径

| 端 | 实现 | 说明 |
| --- | --- | --- |
| H5 | 阿里云 ARTC Web SDK 本地渲染（`rtc/rtc-h5.js`） | 自动识别新版 `DingRTC` 与旧版 `AliRtcEngine` 两种 SDK；支持静音、对讲 |
| Android / iOS | 默认 `web-view` 内嵌同一套 H5 页面（`embed=1`） | 三端共用一份 RTC 代码，无需原生插件与自定义基座；外层仅同步播放状态 |
| Android / iOS（可选） | 绑定阿里云 RTC 原生 / UTS 插件（`rtc/rtc-app.js`） | 更低延迟、支持后台音频、对讲更稳；插件桥接契约已在代码注释中约定 |
| 微信小程序 | 不支持，返回降级文案 | 小程序端由独立分支 `pet-wxmini`（原生小程序 + 阿里云小程序 SDK）实现 |

App 端内嵌地址：`{平台 H5 基址}/#/pages/pet/index?device_id=&embed=1&token=&lang=`，其中 `token` 通过 query 传入（内嵌网页与原生 App 的存储互相独立）。

---

## 二、云端交互设计

### 1. 寻址与鉴权

| 项 | 约定 |
| --- | --- |
| 服务地址 | 本地存储 `serverAddress`，允许带 `/api/v1` 后缀，客户端自动剥离 |
| 平台 H5 基址 | 本地存储 `webViewBase`（未配置时回退 `serverAddress`），供 App 内嵌 H5 使用 |
| 登录态 | 本地存储 `access_token` |
| 请求头 | `x-token: <access_token>` |
| 响应约定 | `{ code: 200, data: ... }`，`code !== 200` 视为失败并抛出 `message`/`msg` |
| 前缀 | 所有接口统一 `/api/v1/` 前缀 |
| WebSocket | 由服务地址把 `http(s)` 替换为 `ws(s)` |

### 2. 设备数据链路（复用 ThingsPanel 既有接口，无需新增）

| 用途 | 请求 |
| --- | --- |
| 设备详情（在线状态、模板 ID） | `GET device/detail/{device_id}` |
| 设备模型 | `GET device/model/{telemetry\|attributes\|events\|commands}?page=1&page_size=1000&device_template_id=` |
| 当前遥测 | `GET telemetry/datas/current/{device_id}` |
| 当前属性 | `GET attribute/datas/{device_id}`（仅模型含属性字段时调用） |
| 设备事件 | `GET event/datas` `{ device_id, page:1, page_size:50 }` |
| 属性写入 | `POST {telemetry\|attribute\|command}/datas/pub` `{ device_id, value: JSON.stringify({ [code]: value }) }` |
| 服务调用 | `POST {command\|telemetry}/datas/pub` `{ device_id, identify: code, value: JSON.stringify(input) }` |
| 遥测实时推送 | `WS .../api/v1/telemetry/datas/current/ws`，连上后发送 `{ device_id, token }`，每 8 秒 `ping` |
| 在线状态推送 | `WS .../api/v1/device/online/status/ws`，同上 |

写入类型判定：模型里能查到真实 `dataType` 时以模型为准，否则默认属性走 `telemetry`、服务走 `command`。

**服务返回码**（从响应 `data.<resultKey>` 或 `data.result` 读取，缺失视为 `null`）：

| 服务 | resultKey | 返回码 |
| --- | --- | --- |
| `start_live` | `startLiveResult` | 0 已开始推流 / 1 设备忙 / 2 观看人数已满 / 3 摄像头无信号 |
| `stop_live` | `stopLiveResult` | 0 成功 |
| `snapshot` | `snapshotResult` | 0 成功 / 1 未推流 / 2 抓拍失败 |
| `dispense_treat` | `dispenseTreatResult` | 0 成功 / 1 今日已投喂完 / 2、3 设备忙 |

### 3. 实时音视频链路

客户端**不持有 AppKey**，AppID / 频道 / 用户 / Token 全部由后端签发：

1. 客户端调用 `POST pet/rtc/token`（见下）拿到入会参数。
2. 调用 `start_live` 服务，并等待设备回报 `av_status` 进入 `1`（推流中）或 `2`（对讲中）——**以设备回报为准**，不信任接口返回即展示画面。
3. H5 端加载 ARTC Web SDK 入会并订阅远端画面；App 端默认由内嵌 H5 完成，绑定原生插件后走插件管线。
4. 停止时调用 `stop_live` 并退出频道。

**频道模型**：按设备维度固定（建议 `pet_{device_id}`），保证同一设备的多位主人进入同一频道；`user_id` 在频道内不可重复。

### 4. 平台业务数据链路

宠物档案、店铺信息、日报、店员留言、时间线、相册目前由 `features/pet/services/pet-platform.js` 的本地 mock 提供，接口就绪后替换实现即可（页面层无需改动）。涉及的存储键：`pet_timeline_mock`、`pet_album_mock`、`pet_album_badge`。

---

## 三、云端需要对接的事情

### 1. 实时音视频鉴权接口（必须新增）

```
POST /api/v1/pet/rtc/token
Header: x-token
Body:   { "device_id": "xxx" }
 Resp:  { "code": 200, "data": {
           "app_id":     "阿里云 ARTC 应用 AppID（控制台「视频直播 > 实时音视频 > 应用管理」）",
           "channel_id": "pet_<device_id>",
           "user_id":    "平台用户 ID（频道内唯一）",
           "user_name":  "显示名（可选）",
           "token":      "ARTC 单参数入会 token",
           "expires_at": "ISO 时间或秒级时间戳（前端据此提前 30 秒刷新）"
         } }
```

- `token` 建议有效期 ≥ 2 小时；返回缺失任一必填字段时客户端报「实时音视频通道未配置」。
- 需在阿里云控制台创建 RTC 应用，并按设备开通/复用频道。

### 2. 宠物店平台业务接口（建议新增，当前为 mock）

```
GET  /api/v1/pet/profile?device_id=             → { pet:{name,breed,age,avatar,boarding_days}, shop:{name,open_time,close_time} }
GET  /api/v1/pet/daily-report?device_id=&date=  → { eat_count,sleep_hours,play_minutes,drink_count }
GET  /api/v1/pet/staff-notes?device_id=         → [{ id,content,staff_name,create_at }]
GET  /api/v1/pet/timeline?device_id=&limit=     → [{ id,type(eat|play|sleep|care|treat),title,time }]
POST /api/v1/pet/timeline  { device_id, type, title }
GET  /api/v1/pet/album?device_id=               → [{ id,url,time }]
POST /api/v1/pet/album     { device_id, url, time }
```

- `shop.open_time` / `close_time` 用于「店铺休息时段」封面态，未配置时视为全天开放。
- `pet.boarding_days` 用于宠物头部「寄养第 N 天」。
- 相册接口未就绪时，抓拍结果暂存本地 `pet_album_mock`，跨设备不同步。

### 3. 设备物模型落地（必须）

按下述 TSL 在平台建好设备模板，字段缺失会被能力探测自动降级隐藏。平台映射：properties → 遥测，events → 事件，services → 命令。

**属性（14）**：`av_status`、`video_quality`、`mic_switch`、`speaker_volume`、`night_vision`、`image_flip`、`viewer_count`、`wifi_rssi`、`sd_status`、`pet_activity`、`activity_level`、`env_temperature`、`env_humidity`、`treat_left`

**服务（4）**：`start_live`（入参 `quality`）、`stop_live`、`snapshot`、`dispense_treat`

**事件（4）**：

| code | level | 输出参数 |
| --- | --- | --- |
| `stream_error` | ERROR | `error_code`（0 编码器故障 / 1 摄像头无信号 / 2 网络拥塞） |
| `sd_card_error` | WARN | `sd_error_status` |
| `bark_alert` | INFO | `volume_db` |
| `env_abnormal` | WARN | `abnormal_type`、`value` |

接入必选（缺失时仍按兜底渲染）：属性 `av_status`，服务 `start_live` / `stop_live`。

设备侧关键要求：

- `start_live` 成功后必须把 `av_status` 置为 `1`（推流中）/ `2`（对讲中），客户端据此展示画面；`stop_live` 后置回 `0`。
- `viewer_count` 上限 4，超出时 `start_live` 返回 2。
- 事件需带 `level`（ERROR/WARN/INFO），客户端按级别取最高一条展示。

### 4. H5 与 App 侧配置

- H5：需为平台域名配置 CORS，允许面板所在域名跨域访问 `/api/v1/*`；WebSocket 需允许 `ws(s)` 升级。
- App：配置 `webViewBase` 指向可访问的面板 H5 地址，供内嵌播放页加载；未配置时回退 `serverAddress`。
- 如需覆盖 RTC SDK 版本或走自建 CDN，可在 H5 上下文注入 `window.__petRtcSdkUrl`。

---

## 四、目录结构

```
pages/pet/index.vue                     面板页面（四 Tab 装配、播放器、浮层）
features/pet/
├── components/                         面板子组件（导航、播放器、告警条、四个 Tab）
├── model/
│   ├── tsl.js                          物模型定义（属性/服务/事件、平台映射约定）
│   └── capabilities.js                 能力探测（字段缺失降级、级联隐藏）
├── services/
│   ├── pet-runtime.js                  真实设备运行时（模型/回报/WS/写入/服务）
│   ├── pet-demo.js                     演示运行时（无设备预览）
│   ├── pet-platform.js                 宠物店业务数据（当前 mock）
│   └── rtc/
│       ├── index.js                    会话工厂（按端分发）
│       ├── rtc-h5.js                   阿里云 ARTC Web SDK 适配
│       ├── rtc-app.js                  App 端 web-view 内嵌 / 原生插件桥接
│       └── token.js                    入会鉴权（POST pet/rtc/token）
└── utils/pet-format.js                 展示格式化
```

---

## 五、本地运行与构建

1. `pnpm i` 安装依赖。
2. H5 调试：`pnpm dev:h5`，访问 `/#/pages/pet/index?demo=1` 查看演示面板；接真实设备时以 `?device_id=<真实设备ID>` 打开并确保已登录。
3. App 调试：用 HBuilderX 运行到 Android / iOS 自定义基座；观看端默认走内嵌 H5，无需相机权限与原生插件。
4. 小程序端不在本分支实现，见分支 `pet-wxmini`。
