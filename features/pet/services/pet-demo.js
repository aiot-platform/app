// 演示运行时：不接真实设备也能跑通面板（H5 预览用，URL 加 ?demo=1 或未登录时自动启用）。
// 覆盖 pet-runtime 的同名接口，页面与组件无需感知差异；数值会缓慢漂移，便于观察绑定是否生效。
import { PROPERTIES, EVENTS, SERVICES } from '../model/tsl.js'

const SERVICE_TIMEOUT = 10000
const WRITE_TIMEOUT = 5000

const INITIAL_VALUES = {
  av_status: 0,
  video_quality: 3,
  mic_switch: 1,
  speaker_volume: 60,
  night_vision: 0,
  image_flip: 0,
  viewer_count: 0,
  wifi_rssi: -52,
  sd_status: 1,
  pet_activity: 3,
  activity_level: 72,
  env_temperature: 26.5,
  env_humidity: 55,
  treat_left: 2,
  collar_online: 1,
  collar_battery: 82,
  pet_body_temperature: 38.6,
  pet_heart_rate: 96,
  is_online: 1
}

export function createDemoRuntime({ onValues, onOnline, onEvents, onState }) {
  let stopped = false
  let latest = { ...INITIAL_VALUES }
  const timers = new Set()
  const emit = values => { if (!stopped) onValues?.({ ...values }) }
  const set = values => { latest = { ...latest, ...values }; emit(values) }

  // 用物模型直接造出模型行，能力层与真实设备走同一条判断路径（含枚举裁剪）。
  const propertyRows = PROPERTIES.map(item => ({
    key: item.code,
    name: item.code,
    specs: item.enumKey ? Object.fromEntries((item.values || []).map(value => [value, value])) : undefined
  }))
  const fields = [
    ...PROPERTIES.map(item => ({ id: item.code, name: item.code, type: item.dataType === 'bool' ? 'boolean' : item.dataType === 'enum' ? 'string' : 'number', dataType: 'telemetry', unit: item.unit })),
    ...EVENTS.map(item => ({ id: item.code, name: item.code, type: 'json', dataType: 'event' })),
    ...SERVICES.map(item => ({ id: item.code, name: item.code, type: 'json', dataType: 'command' }))
  ]

  async function start() {
    onState?.({ status: 'loading' })
    await delay(300)
    onOnline?.(true)
    set({ ...INITIAL_VALUES })
    onEvents?.([])
    // 活跃度与温湿度缓慢变化，模拟真实回报；推流中观看人数会在 1~2 之间波动。
    const drift = setInterval(() => {
      const activity = clamp((latest.activity_level || 0) + rand(-6, 8), 0, 100)
      const temperature = clamp((Number(latest.env_temperature) || 26) + rand(-2, 2) / 10, 18, 34)
      const values = { activity_level: activity, env_temperature: Number(temperature.toFixed(1)) }
      if (latest.av_status === 1 || latest.av_status === 2) values.viewer_count = clamp((latest.viewer_count || 1) + rand(-1, 1), 1, 4)
      set(values)
    }, 5000)
    timers.add(drift)
    const heartbeat = setInterval(() => onEvents?.(latest.av_status === 3 ? demoEvent() : []), 15000)
    timers.add(heartbeat)
    onState?.({ status: 'ready' })
    return { demo: true, fields }
  }

  function waitForValue(code, accept, timeout = SERVICE_TIMEOUT) {
    if (accept(latest[code])) return Promise.resolve(latest[code])
    return new Promise((resolve, reject) => {
      const started = Date.now()
      const timer = setInterval(() => {
        if (stopped) { clearInterval(timer); timers.delete(timer); reject(new Error('页面已关闭')); return }
        if (accept(latest[code])) { clearInterval(timer); timers.delete(timer); resolve(latest[code]); return }
        if (Date.now() - started >= timeout) {
          clearInterval(timer); timers.delete(timer)
          const error = new Error('等待设备回报超时')
          error.code = 'TIMEOUT'
          reject(error)
        }
      }, 200)
      timers.add(timer)
    })
  }

  return {
    demo: true,
    async start() { return start() },
    stop() {
      stopped = true
      timers.forEach(timer => clearInterval(timer))
      timers.clear()
    },
    async readCurrent() { emit(latest) },
    async refreshEvents() { return [] },
    async writeProperty(code, value) {
      await delay(300)
      set({ [code]: value })
      return { code: 200 }
    },
    async callService(code, input) {
      await delay(code === 'start_live' ? 800 : 400)
      if (code === 'start_live') { set({ av_status: 1, viewer_count: 1 }); return 0 }
      if (code === 'stop_live') { set({ av_status: 0, viewer_count: 0 }); return 0 }
      if (code === 'snapshot') { return latest.av_status === 1 || latest.av_status === 2 ? 0 : 1 }
      if (code === 'dispense_treat') {
        const left = Number(latest.treat_left) || 0
        if (left <= 0) return 1
        set({ treat_left: left - 1 })
        return 0
      }
      logUnused(input)
      return 0
    },
    waitForValue,
    get values() { return latest },
    get fields() { return fields },
    get models() { return { telemetry: propertyRows, attributes: [], events: [], commands: [] } },
    get online() { return true },
    timeout: { service: SERVICE_TIMEOUT, write: WRITE_TIMEOUT }
  }
}

// 演示用的 RTC 会话：不加载真实 SDK，入会直接进入播放中，画面位置由页面放占位图。
export function createDemoRtcSession({ onState }) {
  return {
    mode: 'demo',
    needsWebview: false,
    supported: true,
    async join() { await delay(600); onState?.({ status: 'live' }) },
    async leave() {},
    setMuted() {},
    async startTalk() {},
    async stopTalk() {}
  }
}

function demoEvent() {
  return [{ code: 'env_abnormal', level: 'WARN', data: { abnormal_type: 0, value: 31.2 }, time: Date.now() }]
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function rand(min, max) {
  return Math.round(min + Math.random() * (max - min))
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function logUnused() {}
