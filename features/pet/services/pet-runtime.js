// 宠物面板的数据运行时：读设备模型 → 读当前回报 → 订阅实时 → 下发属性 / 调用服务 → 读设备事件。
// 沿用设备详情页的数据通道（telemetry/attribute 当前值 + telemetry 实时 WS + online WS），
// 并把「属性=遥测」的平台映射（PRD 2.2）收敛在这里，UI 只认物模型 code。
import { requestDeviceApi } from '@/api/modules/device-overview.js'
import { extractDeviceFields, normalizeDeviceValues, rowsOf } from '@/utils/thingsvis-device-schema.js'
import { DEFAULT_WRITE_KINDS, SERVICE_BY_CODE } from '../model/tsl.js'

const SERVICE_TIMEOUT = 10000
const WRITE_TIMEOUT = 5000
const EVENT_ACTIVE_WINDOW = 30 * 60 * 1000

export function createPetRuntime({ deviceId, onValues, onOnline, onEvents, onState }) {
  let stopped = false
  let fields = []
  let latest = {}
  let online = null
  // 保留各类型模型原始行，供能力层读取枚举选项（画质/夜视等被裁剪时只展示保留项）。
  let models = { telemetry: [], attributes: [], events: [], commands: [] }
  const sockets = new Set()
  const timers = new Set()
  const token = uni.getStorageSync('access_token')
  const emitValues = values => { if (!stopped && Object.keys(values).length) onValues?.({ ...values }) }
  const emitState = (status, message = '') => { if (!stopped) onState?.({ status, message }) }
  const api = async (path, data, method) => {
    if (stopped) throw new Error('页面已关闭')
    const value = await requestDeviceApi(path, data, method)
    if (stopped) throw new Error('页面已关闭')
    return value
  }
  const merge = values => {
    const next = { ...values }
    fields.forEach(field => { if (next[field.id] === undefined && next[field.name] !== undefined) next[field.id] = next[field.name] })
    latest = { ...latest, ...next }
    emitValues(next)
  }

  async function loadModel() {
    const device = await api(`device/detail/${encodeURIComponent(deviceId)}`)
    merge({ is_online: device?.is_online })
    online = typeof device?.is_online === 'number' ? device.is_online === 1 : null
    onOnline?.(online)
    const templateId = device?.device_config?.device_template_id
    if (!templateId) return { device, fields: [] }
    const kinds = ['telemetry', 'attributes', 'events', 'commands']
    const results = await Promise.all(kinds.map(kind => api(`device/model/${kind}`, { page: 1, page_size: 1000, device_template_id: templateId })))
    models = Object.fromEntries(kinds.map((kind, index) => [kind, rowsOf(results[index])]))
    fields = extractDeviceFields(models)
    return { device, fields }
  }

  async function readCurrent() {
    const hasAttribute = fields.some(field => field.dataType === 'attribute')
    const results = await Promise.all([
      api(`telemetry/datas/current/${encodeURIComponent(deviceId)}`),
      hasAttribute ? api(`attribute/datas/${encodeURIComponent(deviceId)}`) : Promise.resolve([])
    ])
    merge(Object.assign({}, ...results.map(normalizeDeviceValues)))
  }

  // 事件（PRD 2.3/4.10）：取窗口内每个 code 的最新一条作为「活动中」，无恢复事件靠窗口自然过期。
  async function readEvents() {
    if (stopped) return []
    let rows
    try {
      rows = rowsOf(await api('event/datas', { device_id: deviceId, page: 1, page_size: 50 }))
    } catch (error) {
      console.warn('[pet] 设备事件读取失败', error)
      return []
    }
    const active = new Map()
    rows.forEach(row => {
      const code = row.key || row.identifier || row.data_identifier || row.name
      if (!code) return
      const time = Date.parse(row.create_at || row.time || row.trigger_time || '')
      if (Number.isFinite(time) && Date.now() - time > EVENT_ACTIVE_WINDOW) return
      const data = row.value ?? row.data ?? row.output_data ?? {}
      const parsed = typeof data === 'string' ? safeParse(data) : data
      const level = String(row.alarm_level || row.level || '').toUpperCase()
      if (!active.has(code)) active.set(code, { code, level, data: parsed || {}, time: Number.isFinite(time) ? time : Date.now() })
    })
    return [...active.values()]
  }

  async function refreshEvents() {
    const events = await readEvents()
    if (!stopped) onEvents?.(events)
    return events
  }

  function connect(path, statusOnly = false) {
    if (stopped) return
    let heartbeat
    let reconnecting = false
    const socket = uni.connectSocket({ url: `${String(uni.getStorageSync('serverAddress') || '').replace(/^http/, 'ws')}/api/v1/${path}`, complete() {} })
    sockets.add(socket)
    const reconnect = (alreadyClosed = false) => {
      if (reconnecting || stopped) return
      reconnecting = true
      clearInterval(heartbeat)
      timers.delete(heartbeat)
      sockets.delete(socket)
      if (!alreadyClosed) socket.close({ code: 1000 })
      const timer = setTimeout(() => { timers.delete(timer); connect(path, statusOnly) }, 3000)
      timers.add(timer)
    }
    socket.onOpen(() => {
      if (stopped) { socket.close({ code: 1000 }); return }
      socket.send({ data: JSON.stringify({ device_id: deviceId, token }), fail: reconnect })
      heartbeat = setInterval(() => socket.send({ data: 'ping', fail: reconnect }), 8000)
      timers.add(heartbeat)
    })
    socket.onMessage(event => {
      if (stopped || event.data === 'ping' || event.data === 'pong') return
      try {
        const value = JSON.parse(event.data)
        if (statusOnly) {
          if (typeof value.is_online === 'number') {
            online = value.is_online === 1
            merge({ is_online: value.is_online })
            onOnline?.(online)
          }
          return
        }
        merge(normalizeDeviceValues(value))
      } catch { emitState('warning', '收到无法解析的实时数据') }
    })
    socket.onError(() => reconnect())
    socket.onClose(() => reconnect(true))
  }

  async function start() {
    if (!token) throw new Error('登录状态已失效，请重新登录')
    emitState('loading')
    const context = await loadModel()
    await readCurrent().catch(error => emitState('warning', error.message))
    connect('telemetry/datas/current/ws')
    connect('device/online/status/ws', true)
    await refreshEvents().catch(() => {})
    const alarmTimer = setInterval(() => refreshEvents().catch(() => {}), 30000)
    timers.add(alarmTimer)
    emitState('ready')
    return context
  }

  function writeKind(code) {
    const kind = fields.find(field => field.id === code)?.dataType
    if (kind === 'telemetry' || kind === 'attribute' || kind === 'command') return kind
    return DEFAULT_WRITE_KINDS.property
  }

  // RW 属性下发（PRD 5.3）：最终真值以设备回报为准，这里只负责提交并解析回执。
  function writeProperty(code, value) {
    const kind = writeKind(code)
    return api(`${kind}/datas/pub`, { device_id: deviceId, value: JSON.stringify({ [code]: value }) }, 'POST')
  }

  // 服务调用（PRD 2.4）：命令下发；result 有回执就用回执，没有则由设备回报驱动。
  async function callService(code, input) {
    const kind = fields.find(field => field.id === code)?.dataType === 'command' ? 'command' : DEFAULT_WRITE_KINDS.service
    const response = await api(`${kind}/datas/pub`, { device_id: deviceId, identify: code, value: JSON.stringify(input || {}) }, 'POST')
    const service = SERVICE_BY_CODE[code]
    const payload = response && typeof response === 'object' ? response : {}
    const result = payload[service?.resultKey] ?? payload.result ?? payload.data?.[service?.resultKey] ?? payload.data?.result
    return result === undefined || result === null ? null : Number(result)
  }

  /** 等待属性回报满足条件；超时抛出超时错误。用于 start_live 后确认 av_status 进入推流中。 */
  function waitForValue(code, accept, timeout = SERVICE_TIMEOUT) {
    if (accept(latest[code])) return Promise.resolve(latest[code])
    return new Promise((resolve, reject) => {
      const started = Date.now()
      const timer = setInterval(() => {
        if (stopped) { clearInterval(timer); timers.delete(timer); reject(new Error('页面已关闭')); return }
        if (accept(latest[code])) { clearInterval(timer); timers.delete(timer); resolve(latest[code]); return }
        if (Date.now() - started >= timeout) {
          clearInterval(timer)
          timers.delete(timer)
          const error = new Error('等待设备回报超时')
          error.code = 'TIMEOUT'
          reject(error)
        }
      }, 500)
      timers.add(timer)
    })
  }

  function stop() {
    stopped = true
    timers.forEach(timer => { clearTimeout(timer); clearInterval(timer) })
    timers.clear()
    sockets.forEach(socket => socket.close({ code: 1000 }))
    sockets.clear()
  }

  return {
    start, stop, readCurrent, refreshEvents, writeProperty, callService, waitForValue,
    get values() { return latest },
    get fields() { return fields },
    get models() { return models },
    get online() { return online },
    timeout: { service: SERVICE_TIMEOUT, write: WRITE_TIMEOUT }
  }
}

function safeParse(text) {
  try { return JSON.parse(text) } catch { return null }
}
