# 宠物看护控制面板（微信小程序）

基于微信原生小程序框架实现的宠物寄养看护面板，配套阿里云实时音视频（RTC）实现远程看护与对讲。设备数据链路复用 ThingsPanel 后端，与 H5 / Android / iOS 端共用同一套物模型与接口约定。

- 原型：[pet-prd/音视频交互原型.html](pet-prd/音视频交互原型.html)
- 物模型：[pet-prd/音视频物模型.json](pet-prd/音视频物模型.json)（ProductKey `a1AvPanel001`）
- 小程序工程根目录：`app/wxmini/`

---

## 一、功能

### 1. 单屏四 Tab 面板

| Tab | 内容 | 出现条件 |
| --- | --- | --- |
| 实时 | 宠物卡片、实时画面、观看 HUD、项圈卡片、宠物状态卡、快捷操作 | 常驻 |
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

`utils/model.js` 依据设备模型与当前回报计算能力集：

- 模型可用：按模型字段判断属性/服务是否存在。
- 模型不可用：按物模型必选集（`av_status` + `start_live`/`stop_live`）兜底，并按回报值推断。
- 枚举选项读取被平台裁剪后的 `specs`，保证画质等下拉选项与设备真实支持范围一致。

### 5. 演示模式

显式 `?demo=1` 编译条件或在未登录时自动启用演示运行时，**不依赖任何设备与后端**即可查看完整面板：

- 数值每 5 秒缓慢漂移（活跃度、舍内温度、观看人数）。
- `start_live` / `stop_live` / `snapshot` / `dispense_treat` 按与真实设备一致的返回码模拟。
- 开发者工具中导入 `app/wxmini/` 即可预览。

### 6. 异常提示

读取 30 分钟内的设备事件，按严重级别取最高一条展示告警条（推流异常 / 存储卡异常 / 舍内温度异常 / 吠叫提醒），可关闭；关闭仅隐藏提示，不代表清除设备事件。

---

## 二、云端交互设计

### 1. 寻址与鉴权

| 项 | 约定 |
| --- | --- |
| 服务地址 | 本地存储 `serverAddress`，允许带 `/api/v1` 后缀，客户端自动剥离 |
| 登录态 | 本地存储 `access_token` |
| 请求头 | `x-token: <access_token>`，`content-type: application/json` |
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
3. 通过阿里云小程序 RTC SDK 入会，SDK 写入页面 `pusher` / `playerList`，由 `live-pusher` / `live-player` 承载。
4. 停止时调用 `stop_live` 并退出频道。

**频道模型**：按设备维度固定（建议 `pet_{device_id}`），保证同一设备的多位主人进入同一频道；`user_id` 在频道内不可重复。

### 4. 平台业务数据链路

宠物档案、店铺信息、日报、店员留言、时间线、相册目前由 `services/platform.js` 的本地 mock 提供，接口就绪后替换实现即可（页面层无需改动）。涉及的存储键：`pet_timeline_mock`、`pet_album_mock`、`pet_album_badge`。

---

## 三、云端需要对接的事情

### 1. 实时音视频鉴权接口（必须新增）

```
POST /api/v1/pet/rtc/token
Header: x-token
Body:   { "device_id": "xxx" }
 Resp:  { "code": 200, "data": {
           "app_id":     "阿里云 ARTC / DingRTC 应用 AppID",
           "channel_id": "pet_<device_id>",
           "user_id":    "平台用户 ID（频道内唯一）",
           "user_name":  "显示名（可选）",
           "token":      "单参数入会 token",
           "expires_at": "ISO 时间或秒级时间戳"
         } }
```

- `token` 建议有效期 ≥ 2 小时；返回缺失任一必填字段时客户端报「实时音视频通道未配置」。
- 需在阿里云控制台创建 RTC 应用，并按设备开通/复用频道。

### 2. 宠物店平台业务接口（建议新增，当前为 mock）

```
GET  /api/v1/pet/profile?device_id=             → { pet:{name,breed,age,avatar,boarding_days}, shop:{name,open_time,close_time} }
GET  /api/v1/pet/daily-report?device_id=&date=  → { eat_count,sleep_hours,play_minutes,drink_count }
GET  /api/v1/pet/staff-notes?device_id=         → [{ id,content,staff_name,create_at }]
GET  /api/v1/pet/timeline?device_id=&limit=     → [{ id,type,text,time }]
POST /api/v1/pet/timeline  { device_id, type, text }
GET  /api/v1/pet/album?device_id=               → [{ id,src,time }]
POST /api/v1/pet/album     { device_id, src, time }
```

- `shop.open_time` / `close_time` 用于「店铺休息时段」封面态，未配置时视为全天开放。
- `pet.boarding_days` 用于宠物头部「寄养第 N 天」。
- 相册接口未就绪时，抓拍结果暂存本地 `pet_album_mock`，跨设备不同步。

### 3. 设备物模型落地（必须）

按下述 TSL 在平台建好设备模板，字段缺失会被能力探测自动降级隐藏。

**属性（18）**：`av_status`、`video_quality`、`mic_switch`、`speaker_volume`、`night_vision`、`image_flip`、`viewer_count`、`wifi_rssi`、`sd_status`、`pet_activity`、`activity_level`、`env_temperature`、`env_humidity`、`treat_left`、`collar_online`、`collar_battery`、`pet_body_temperature`、`pet_heart_rate`

其中后四项来自**宠物项圈**：项圈经 Wi-Fi 近场把数据报给边缘网关（带摄像头的网关），再由网关统一送云，因此与音视频共用同一台设备、同一套物模型。面板在实时画面下方以「项圈」卡片展示体温/心率/电量/在线状态，字段缺失时整块自动隐藏。

**服务（4）**：`start_live`、`stop_live`、`snapshot`、`dispense_treat`

**事件（4）**：`stream_error`、`sd_card_error`、`bark_alert`、`env_abnormal`

接入必选（缺失时仍按兜底渲染）：属性 `av_status`，服务 `start_live` / `stop_live`。

设备侧关键要求：

- `start_live` 成功后必须把 `av_status` 置为 `1`（推流中）/ `2`（对讲中），客户端据此展示画面；`stop_live` 后置回 `0`。
- `viewer_count` 上限 4，超出时 `start_live` 返回 2。
- 事件需带 `level`（ERROR/WARN/INFO）与 `level` 对应文案所需字段，客户端按级别取最高一条展示。

### 4. 小程序侧配置

- 企业主体 + 开通「实时播放音视频流 / 实时录制音视频流」接口权限，并配置 `live-pusher` / `live-player` 对应类目（IT科技-音视频设备 或 智能家居-控制摄像头）。
- 配置 request 合法域名（后端地址）与 socket 合法域名（实时推送）。
- 微信开发者工具**不支持** `live-pusher` / `live-player`，音视频必须真机调试，测试号不可用。

### 5. 启用阿里云 RTC SDK（三步）

1. 在 `app/wxmini/` 执行 `npm i aliyun-rtc-wx-sdk`；
2. 开发者工具执行「工具 > 构建 npm」；
3. 打开 `app/wxmini/app.js` 中 `require('aliyun-rtc-wx-sdk')` 两行注释，SDK 会写入 `globalData.AliRtcEngine`。

未接入 SDK 时，`createRtcSession` 返回降级会话，点击观看提示「当前小程序未接入实时音视频 SDK」，不影响其他功能。

---

## 四、目录结构

```
wxmini/
├── app.js / app.json / app.wxss        小程序入口、全局配置与设计变量
├── project.config.json                 开发者工具项目配置（含 demo=1 编译条件）
├── utils/
│   ├── tsl.js                          物模型事实（属性/服务/事件、枚举、写入类型）
│   ├── model.js                        能力探测（字段缺失降级、级联隐藏）
│   ├── format.js                       展示格式化（空值、枚举、温度、时长）
│   └── icons.js                        内联 SVG → data-uri 图标与活跃度圆环
├── services/
│   ├── request.js                      后端请求封装（x-token / serverAddress）
│   ├── runtime.js                      真实设备运行时（模型/回报/WS/写入/服务）
│   ├── demo.js                         演示运行时（无设备预览）
│   ├── platform.js                     宠物店业务数据（当前 mock）
│   └── rtc/
│       ├── index.js                    会话工厂（按 SDK 注入情况分发）
│       ├── rtc-wx.js                   阿里云小程序 RTC SDK 适配
│       └── token.js                    入会鉴权（POST pet/rtc/token）
└── pages/pet/                          面板页（wxml / wxss / js）
```

---

## 五、本地运行

1. 微信开发者工具导入 `app/wxmini/` 目录，AppID 使用 `project.config.json` 中的配置。
2. 选择编译条件「宠物面板（演示）」（`demo=1&device_id=demo-device`）即可查看完整面板。
3. 接真实设备时，先完成登录并写入 `access_token` / `serverAddress`，再以 `?device_id=<真实设备ID>` 打开。
