// 宠物看护设备物模型事实（来源：pet-prd/音视频物模型.json，ProductKey a1AvPanel001，TSL 1.1.0）。
// 与 uni-app 版 features/pet/model/tsl.js 保持一致；小程序端页面只用其中的枚举与能力定义。
export const PRODUCT_KEY = 'a1AvPanel001'

// 物模型枚举文案（含平台写入结果的业务枚举，原型 ENUMS 同名同值）。
export const ENUMS = {
  av_status: { 0: '空闲', 1: '推流中', 2: '对讲中', 3: '异常' },
  video_quality: { 1: '流畅', 2: '标清', 3: '高清', 4: '超清' },
  night_vision: { 0: '自动', 1: '始终开启', 2: '始终关闭' },
  image_flip: { 0: '正常', 1: '旋转180度' },
  sd_status: { 0: '未插卡', 1: '正常', 2: '异常', 3: '格式化中' },
  pet_activity: { 0: '未检测到宠物', 1: '正在休息', 2: '正在睡觉', 3: '正在玩耍', 4: '正在进食', 5: '正在喝水' },
  stream_error: { 0: '编码器故障', 1: '摄像头无信号', 2: '网络拥塞' },
  start_live_result: { 0: '已开始推流', 1: '设备忙', 2: '观看人数已满', 3: '摄像头无信号' }
}

// 画质档位对应的分辨率标签。
export const RES = { 1: [160, 100, '360P'], 2: [320, 200, '480P'], 3: [640, 400, '720P'], 4: [960, 600, '1080P'] }
export const SPEC = { speaker_volume: { min: 0, max: 100, step: 10, unit: '%' }, viewer_count: { max: 4 }, temp: { lo: 18, hi: 28 } }

// 能力探测所需的物模型定义（access: r 只读 / rw 可写）。
export const PROPERTIES = [
  { code: 'av_status', access: 'r', dataType: 'enum', enumKey: 'av_status', values: [0, 1, 2, 3] },
  { code: 'video_quality', access: 'rw', dataType: 'enum', enumKey: 'video_quality', values: [1, 2, 3, 4] },
  { code: 'mic_switch', access: 'rw', dataType: 'bool' },
  { code: 'speaker_volume', access: 'rw', dataType: 'int', min: 0, max: 100, step: 10, unit: '%' },
  { code: 'night_vision', access: 'rw', dataType: 'enum', enumKey: 'night_vision', values: [0, 1, 2] },
  { code: 'image_flip', access: 'rw', dataType: 'enum', enumKey: 'image_flip', values: [0, 1] },
  { code: 'viewer_count', access: 'r', dataType: 'int', min: 0, max: 4 },
  { code: 'wifi_rssi', access: 'r', dataType: 'int', min: -100, max: 0 },
  { code: 'sd_status', access: 'r', dataType: 'enum', enumKey: 'sd_status', values: [0, 1, 2, 3] },
  { code: 'pet_activity', access: 'r', dataType: 'enum', enumKey: 'pet_activity', values: [0, 1, 2, 3, 4, 5] },
  { code: 'activity_level', access: 'r', dataType: 'int', min: 0, max: 100 },
  { code: 'env_temperature', access: 'r', dataType: 'float', min: -20, max: 60 },
  { code: 'env_humidity', access: 'r', dataType: 'int', min: 0, max: 100 },
  { code: 'treat_left', access: 'r', dataType: 'int', min: 0, max: 10, unit: '次' },
  { code: 'collar_online', access: 'r', dataType: 'bool' },
  { code: 'collar_battery', access: 'r', dataType: 'int', min: 0, max: 100, unit: '%' },
  { code: 'pet_body_temperature', access: 'r', dataType: 'float', min: 30, max: 45, digits: 1, unit: '℃' },
  { code: 'pet_heart_rate', access: 'r', dataType: 'int', min: 0, max: 250, unit: 'bpm' }
]

export const SERVICES = [
  { code: 'start_live', resultKey: 'startLiveResult' },
  { code: 'stop_live', resultKey: 'stopLiveResult' },
  { code: 'snapshot', resultKey: 'snapshotResult' },
  { code: 'dispense_treat', resultKey: 'dispenseTreatResult' }
]

export const SERVICE_BY_CODE = Object.fromEntries(SERVICES.map(item => [item.code, item]))

// 默认写入类型：属性按平台约定走遥测下发，服务走命令下发；模型里能查到真实类型时以模型为准。
export const DEFAULT_WRITE_KINDS = { property: 'telemetry', service: 'command' }

export const EVENTS = ['stream_error', 'sd_card_error', 'bark_alert', 'env_abnormal']

export const ALL_CODES = PROPERTIES.map(item => item.code)
export const ALL_SERVICES = SERVICES.map(item => item.code)

// 接入必选：属性 av_status、服务 start_live/stop_live（PRD 3.2），模型不可用时按必选降级。
export const REQUIRED_CODES = ['av_status']
export const REQUIRED_SERVICES = ['start_live', 'stop_live']

export const PROPERTY_BY_CODE = Object.fromEntries(PROPERTIES.map(item => [item.code, item]))

// 更多页三个分组的归属，用于级联隐藏（PRD 3.2 / 4.8 / 4.9 / 4.12）。
export const MORE_GROUPS = {
  watch: ['video_quality', 'mic_switch', 'speaker_volume'],
  picture: ['night_vision', 'image_flip'],
  device: ['viewer_count', 'wifi_rssi', 'sd_status']
}
