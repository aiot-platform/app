// 宠物看护设备物模型定义。
// 来源：pet-prd/音视频物模型.json（TSL 1.1.0 / 模型 1.1.0，ProductKey a1AvPanel001）。
// 平台映射约定：properties → 遥测(telemetry)，events → 事件(event)，services → 命令(command)。
// 文案一律走 labelKey/enumKey，不在本文件写死中文，便于复用语言包。
export const PET_PRODUCT_KEY = 'a1AvPanel001'

// 产品建议的舒适区（PRD 4.4，可由店铺配置覆盖）。
export const COMFORT_RANGE = { min: 18, max: 28 }

export const PROPERTIES = [
  { id: 1, code: 'av_status', labelKey: 'pages.pet.props.avStatus', access: 'r', required: true, dataType: 'enum', enumKey: 'avStatus', values: [0, 1, 2, 3] },
  { id: 2, code: 'video_quality', labelKey: 'pages.pet.props.videoQuality', access: 'rw', dataType: 'enum', enumKey: 'videoQuality', values: [1, 2, 3, 4] },
  { id: 3, code: 'mic_switch', labelKey: 'pages.pet.props.micSwitch', access: 'rw', dataType: 'bool' },
  { id: 4, code: 'speaker_volume', labelKey: 'pages.pet.props.speakerVolume', access: 'rw', dataType: 'int', min: 0, max: 100, step: 10, unit: '%' },
  { id: 5, code: 'night_vision', labelKey: 'pages.pet.props.nightVision', access: 'rw', dataType: 'enum', enumKey: 'nightVision', values: [0, 1, 2] },
  { id: 6, code: 'image_flip', labelKey: 'pages.pet.props.imageFlip', access: 'rw', dataType: 'enum', enumKey: 'imageFlip', values: [0, 1] },
  { id: 7, code: 'viewer_count', labelKey: 'pages.pet.props.viewerCount', access: 'r', dataType: 'int', min: 0, max: 4, unit: '人' },
  { id: 8, code: 'wifi_rssi', labelKey: 'pages.pet.props.wifiRssi', access: 'r', dataType: 'int', min: -100, max: 0, unit: 'dBm' },
  { id: 9, code: 'sd_status', labelKey: 'pages.pet.props.sdStatus', access: 'r', dataType: 'enum', enumKey: 'sdStatus', values: [0, 1, 2, 3] },
  { id: 10, code: 'pet_activity', labelKey: 'pages.pet.props.petActivity', access: 'r', dataType: 'enum', enumKey: 'petActivity', values: [0, 1, 2, 3, 4, 5] },
  { id: 11, code: 'activity_level', labelKey: 'pages.pet.props.activityLevel', access: 'r', dataType: 'int', min: 0, max: 100, unit: '%' },
  { id: 12, code: 'env_temperature', labelKey: 'pages.pet.props.envTemperature', access: 'r', dataType: 'float', min: -20, max: 60, digits: 1, unit: '℃' },
  { id: 13, code: 'env_humidity', labelKey: 'pages.pet.props.envHumidity', access: 'r', dataType: 'int', min: 0, max: 100, unit: '%' },
  { id: 14, code: 'treat_left', labelKey: 'pages.pet.props.treatLeft', access: 'r', dataType: 'int', min: 0, max: 10, unit: '次' }
]

export const EVENTS = [
  { id: 15, code: 'stream_error', labelKey: 'pages.pet.events.streamError', level: 'ERROR', outputs: [{ code: 'error_code', enumKey: 'errorCode', values: [0, 1, 2] }] },
  { id: 17, code: 'sd_card_error', labelKey: 'pages.pet.events.sdCardError', level: 'WARN', outputs: [{ code: 'sd_error_status', enumKey: 'sdStatus', values: [0, 1, 2, 3] }] },
  { id: 19, code: 'bark_alert', labelKey: 'pages.pet.events.barkAlert', level: 'INFO', outputs: [{ code: 'volume_db', dataType: 'int', unit: 'dB' }] },
  { id: 21, code: 'env_abnormal', labelKey: 'pages.pet.events.envAbnormal', level: 'WARN', outputs: [{ code: 'abnormal_type', enumKey: 'abnormalType', values: [0, 1, 2] }, { code: 'value', dataType: 'float', unit: '' }] }
]

export const SERVICES = [
  { id: 24, code: 'start_live', labelKey: 'pages.pet.services.startLive', input: [{ code: 'quality', enumKey: 'videoQuality', values: [1, 2, 3, 4] }], resultKey: 'startLiveResult' },
  { id: 27, code: 'stop_live', labelKey: 'pages.pet.services.stopLive', resultKey: 'stopLiveResult' },
  { id: 29, code: 'snapshot', labelKey: 'pages.pet.services.snapshot', resultKey: 'snapshotResult' },
  { id: 31, code: 'dispense_treat', labelKey: 'pages.pet.services.dispenseTreat', resultKey: 'dispenseTreatResult' }
]

// 接入必选：属性 av_status、服务 start_live/stop_live。模型不可用时按必选能力降级。
export const REQUIRED_CODES = ['av_status']
export const REQUIRED_SERVICES = ['start_live', 'stop_live']

export const PROPERTY_BY_CODE = Object.fromEntries(PROPERTIES.map(item => [item.code, item]))
export const EVENT_BY_CODE = Object.fromEntries(EVENTS.map(item => [item.code, item]))
export const SERVICE_BY_CODE = Object.fromEntries(SERVICES.map(item => [item.code, item]))

// PRD 3.2 / 4.8 / 4.9 / 4.12 的分组归属，用于级联隐藏。
export const MORE_GROUPS = {
  watch: ['video_quality', 'mic_switch', 'speaker_volume'],
  picture: ['night_vision', 'image_flip'],
  device: ['viewer_count', 'wifi_rssi', 'sd_status']
}

// 默认写入类型：属性按平台约定走遥测下发，服务走命令下发；模型里能查到真实类型时以模型为准。
export const DEFAULT_WRITE_KINDS = { property: 'telemetry', service: 'command' }
