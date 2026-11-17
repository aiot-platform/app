// 宠物面板的数据运行时（小程序版）：读设备模型 → 读当前回报 → 订阅实时 → 下发属性 / 调用服务 → 读设备事件。
// 与 uni-app 版 features/pet/services/pet-runtime.js 接口一致，仅把 uni.* 换成 wx.*。
import { request, accessToken, wsBase } from './request.js'
import { DEFAULT_WRITE_KINDS, SERVICE_BY_CODE } from '../utils/tsl.js'

const SERVICE_TIMEOUT = 10000
const WRITE_TIMEOUT = 5000
const EVENT_ACTIVE_WINDOW = 30 * 60 * 1000

function rowsOf(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value && value.list)) return value.list
  if (Array.isArray(value && value.data)) return value.data
  return []
}

function normalizeValues(value) {
  if (Array.isArray(value)) {
    return Object.fromEntries(value.filter(item => item && (item.key || item.label)).map(item => [item.key || item.label, item.value]))
  }
  if (!value || typeof value !== 'object') return {}
  if (value.data !== undefined) return normalizeValues(value.data)
  if (value.payload !== undefined) return normalizeValues(value.payload)
  return Object.fromEntries(Object.entries(value.fields || value).filter(([key]) => key !== 'systime'))
}

function extractFields(models) {
  const kinds = { telemetry: 'telemetry', attributes: 'attribute', events: 'event', commands: 'command' }
  return Object.keys(kinds).flatMap(key => rowsOf(models[key]).map(item => {
    const id = item.key || item.data_identifier || item.identifier || item.id
    const rawType = String(item.data_type || item.type || '').toLowerCase()
    const type = /int|float|double|number/.test(rawType) ? 'number' : /bool/.test(rawType) ? 'boolean' : /json|object|array/.test(rawType) ? 'json' : 'string'
    return { id, name: item.name || item.data_name || item.label || id, type, dataType: kinds[key], unit: item.unit }
  }).filter(field => typeof field.id === 'string' && field.id))
}

function safeParse(text) {
  try { return JSON.parse(text) } catch (error) { return null }
}

export function createPetRuntime({ deviceId, onValues, onOnline, onEvents, onState }) {
  let stopped = false
  let fields = []
  let latest = {}
  let online = null
  let models = { telemetry: [], attributes: [], events: [], commands: [] }
  const sockets = new Set()
  const timers = new Set()
  const token = accessToken()

  const emitValues = values => { if (!stopped && Object.keys(values).length) onValues && onValues({ ...values }) }
  const emitState = (status, message = '') => { if (!stopped) onState && onState({ status, message }) }

  async function api(path, data, method) {
    if (stopped) throw new Error('页面已关闭')
    const value = await request(path, data, method)
    if (stopped) throw new Error('页面已关闭')
    return value
  }

  function merge(values) {
    const next = { ...values }
    fields.forEach(field => { if (next[field.id] === undefined && next[field.name] !== undefined) next[field.id] = next[field.name] })
    latest = { ...latest, ...next }
    emitValues(next)
  }

  async function loadModel() {
    const device = await api(`device/detail/${encodeURIComponent(deviceId)}`)
    merge({ is_online: device && device.is_online })
    online = device && typeof device.is_online === 'number' ? device.is_online === 1 : null
    onOnline && onOnline(online)
    const templateId = device && device.device_config && device.device_config.device_template_id
    if (!templateId) return { device, fields: [] }
    const kinds = ['telemetry', 'attributes', 'events', 'commands']
    const results = await Promise.all(kinds.map(kind => api(`device/model/${kind}`, { page: 1, page_size: 1000, device_template_id: templateId })))
    models = Object.fromEntries(kinds.map((kind, index) => [kind, rowsOf(results[index])]))
    fields = extractFields(models)
    return { device, fields }
  }

  async function readCurrent() {
    const hasAttribute = fields.some(field => field.dataType === 'attribute')
    const results = await Promise.all([
      api(`telemetry/datas/current/${encodeURIComponent(deviceId)}`),
      hasAttribute ? api(`attribute/datas/${encodeURIComponent(deviceId)}`) : Promise.resolve([])
    ])
    merge(Object.assign({}, ...results.map(normalizeValues)))
  }

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
      const raw = row.value !== undefined ? row.value : row.data !== undefined ? row.data : row.output_data
      const parsed = typeof raw === 'string' ? safeParse(raw) : raw
      const level = String(row.alarm_level || row.level || '').toUpperCase()
      if (!active.has(code)) active.set(code, { code, level, data: parsed || {}, time: Number.isFinite(time) ? time : Date.now() })
    })
    return [...active.values()]
  }

  async function refreshEvents() {
    const events = await readEvents()
    if (!stopped) onEvents && onEvents(events)
    return events
  }

  function connect(path, statusOnly = false) {
    if (stopped) return
    let heartbeat
    let reconnecting = false
    const socket = wx.connectSocket({ url: `${wsBase()}/api/v1/${path}`, complete() {} })
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
            onOnline && onOnline(online)
          }
          return
        }
        merge(normalizeValues(value))
      } catch (error) {
        emitState('warning', '收到无法解析的实时数据')
      }
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
    const kind = (fields.find(field => field.id === code) || {}).dataType
    if (kind === 'telemetry' || kind === 'attribute' || kind === 'command') return kind
    return DEFAULT_WRITE_KINDS.property
  }

  function writeProperty(code, value) {
    return api(`${writeKind(code)}/datas/pub`, { device_id: deviceId, value: JSON.stringify({ [code]: value }) }, 'POST')
  }

  async function callService(code, input) {
    const isCommand = (fields.find(field => field.id === code) || {}).dataType === 'command'
    const kind = isCommand ? 'command' : DEFAULT_WRITE_KINDS.service
    const response = await api(`${kind}/datas/pub`, { device_id: deviceId, identify: code, value: JSON.stringify(input || {}) }, 'POST')
    const service = SERVICE_BY_CODE[code]
    const payload = response && typeof response === 'object' ? response : {}
    const result = payload[service && service.resultKey] !== undefined ? payload[service.resultKey]
      : payload.result !== undefined ? payload.result
        : payload.data && payload.data[service && service.resultKey] !== undefined ? payload.data[service.resultKey]
          : payload.data && payload.data.result
    return result === undefined || result === null ? null : Number(result)
  }

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
