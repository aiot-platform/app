// 宠物看护设备物模型定义。
// 来源：pet-prd/音视频物模型.json（TSL 1.1.0 / 模型 1.1.0，ProductKey a1AvPanel001）。
// 平台映射约定：properties → 遥测(telemetry)，events → 事件(event)，services → 命令(command)。
// 面板文案为单语中文，与微信小程序端（分支 pet-wxmini）保持一致。
export const PET_PRODUCT_KEY = 'a1AvPanel001'

// 产品建议的舒适区（PRD 4.4，可由店铺配置覆盖）。
export const COMFORT_RANGE = { min: 18, max: 28 }

// 枚举文案表：未知值统一显示「未知」，不默认选中任何一项。
export const ENUMS = {
  unknown: '未知',
  avStatus: { 0: '空闲', 1: '推流中', 2: '对讲中', 3: '异常' },
  videoQuality: { 1: '流畅', 2: '标清', 3: '高清', 4: '超清' },
  nightVision: { 0: '自动', 1: '始终开启', 2: '始终关闭' },
  imageFlip: { 0: '正常', 1: '旋转180度' },
  sdStatus: { 0: '未插卡', 1: '正常', 2: '异常', 3: '格式化中' },
  petActivity: { 0: '未检测到宠物', 1: '正在休息', 2: '正在睡觉', 3: '正在玩耍', 4: '正在进食', 5: '正在喝水' },
  errorCode: { 0: '编码器故障', 1: '摄像头无信号', 2: '网络拥塞' },
  abnormalType: { 0: '温度过高', 1: '温度过低', 2: '湿度异常' }
}

export const PROPERTIES = [
  { id: 1, code: 'av_status', access: 'r', required: true, dataType: 'enum', enumKey: 'avStatus', values: [0, 1, 2, 3] },
  { id: 2, code: 'video_quality', access: 'rw', dataType: 'enum', enumKey: 'videoQuality', values: [1, 2, 3, 4] },
  { id: 3, code: 'mic_switch', access: 'rw', dataType: 'bool' },
  { id: 4, code: 'speaker_volume', access: 'rw', dataType: 'int', min: 0, max: 100, step: 10, unit: '%' },
  { id: 5, code: 'night_vision', access: 'rw', dataType: 'enum', enumKey: 'nightVision', values: [0, 1, 2] },
  { id: 6, code: 'image_flip', access: 'rw', dataType: 'enum', enumKey: 'imageFlip', values: [0, 1] },
  { id: 7, code: 'viewer_count', access: 'r', dataType: 'int', min: 0, max: 4, unit: '人' },
  { id: 8, code: 'wifi_rssi', access: 'r', dataType: 'int', min: -100, max: 0, unit: 'dBm' },
  { id: 9, code: 'sd_status', access: 'r', dataType: 'enum', enumKey: 'sdStatus', values: [0, 1, 2, 3] },
  { id: 10, code: 'pet_activity', access: 'r', dataType: 'enum', enumKey: 'petActivity', values: [0, 1, 2, 3, 4, 5] },
  { id: 11, code: 'activity_level', access: 'r', dataType: 'int', min: 0, max: 100, unit: '%' },
  { id: 12, code: 'env_temperature', access: 'r', dataType: 'float', min: -20, max: 60, digits: 1, unit: '℃' },
  { id: 13, code: 'env_humidity', access: 'r', dataType: 'int', min: 0, max: 100, unit: '%' },
  { id: 14, code: 'treat_left', access: 'r', dataType: 'int', min: 0, max: 10, unit: '次' }
]

export const EVENTS = [
  { id: 15, code: 'stream_error', level: 'ERROR', outputs: [{ code: 'error_code', enumKey: 'errorCode', values: [0, 1, 2] }] },
  { id: 17, code: 'sd_card_error', level: 'WARN', outputs: [{ code: 'sd_error_status', enumKey: 'sdStatus', values: [0, 1, 2, 3] }] },
  { id: 19, code: 'bark_alert', level: 'INFO', outputs: [{ code: 'volume_db', dataType: 'int', unit: 'dB' }] },
  { id: 21, code: 'env_abnormal', level: 'WARN', outputs: [{ code: 'abnormal_type', enumKey: 'abnormalType', values: [0, 1, 2] }, { code: 'value', dataType: 'float', unit: '' }] }
]

export const SERVICES = [
  { id: 24, code: 'start_live', input: [{ code: 'quality', enumKey: 'videoQuality', values: [1, 2, 3, 4] }], resultKey: 'startLiveResult' },
  { id: 27, code: 'stop_live', resultKey: 'stopLiveResult' },
  { id: 29, code: 'snapshot', resultKey: 'snapshotResult' },
  { id: 31, code: 'dispense_treat', resultKey: 'dispenseTreatResult' }
]

// 接入必选：属性 av_status、服务 start_live/stop_live。模型不可用时按必选能力降级。
export const REQUIRED_CODES = ['av_status']
export const REQUIRED_SERVICES = ['start_live', 'stop_live']

export const PROPERTY_BY_CODE = Object.fromEntries(PROPERTIES.map(item => [item.code, item]))
export const SERVICE_BY_CODE = Object.fromEntries(SERVICES.map(item => [item.code, item]))

// PRD 3.2 / 4.8 / 4.9 / 4.12 的分组归属，用于级联隐藏。
export const MORE_GROUPS = {
  watch: ['video_quality', 'mic_switch', 'speaker_volume'],
  picture: ['night_vision', 'image_flip'],
  device: ['viewer_count', 'wifi_rssi', 'sd_status']
}

// 默认写入类型：属性按平台约定走遥测下发，服务走命令下发；模型里能查到真实类型时以模型为准。
export const DEFAULT_WRITE_KINDS = { property: 'telemetry', service: 'command' }
