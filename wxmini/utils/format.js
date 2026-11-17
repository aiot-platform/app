// 展示格式化：统一「无回报显示 --、未知枚举显示未知」，与原型 renderHome / renderMore 的取值口径一致。
import { ENUMS, SPEC } from './tsl.js'

export const EMPTY = '--'

export function isMissing(value) {
  return value === undefined || value === null || value === ''
}

export function number(value) {
  if (isMissing(value)) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function numberText(value, digits = 0) {
  const parsed = number(value)
  return parsed === null ? EMPTY : parsed.toFixed(digits)
}

/** 枚举文案；未知值返回「未知」，不默认选中任何一项。 */
export function enumLabel(enumKey, value) {
  if (isMissing(value)) return EMPTY
  const table = ENUMS[enumKey]
  return table && table[value] !== undefined ? table[value] : '未知'
}

/** Wi-Fi 信号强度（原型 rssiText）。 */
export function wifiText(rssi, noData = false) {
  if (noData || isMissing(rssi)) return EMPTY
  const parsed = number(rssi)
  return parsed === null ? EMPTY : parsed + ' dBm'
}

/** 舍内温度：[数值, 舒适标签, 颜色]（原型 tempInfo）。 */
export function tempInfo(value, noData = false) {
  if (noData || isMissing(value)) return [EMPTY, '', '']
  const parsed = number(value)
  if (parsed === null) return [EMPTY, '', '']
  if (parsed > SPEC.temp.hi) return [parsed.toFixed(1), '偏热', '#e5683a']
  if (parsed < SPEC.temp.lo) return [parsed.toFixed(1), '偏冷', '#3b8ef0']
  return [parsed.toFixed(1), '舒适', '#25b283']
}

export function pad(value) {
  return String(value).padStart(2, '0')
}

/** 当前时间 HH:mm。 */
export function nowStr() {
  const date = new Date()
  return pad(date.getHours()) + ':' + pad(date.getMinutes())
}

/** ISO / 时间戳 → MM-DD HH:mm。 */
export function timeText(value) {
  if (!value) return ''
  const date = new Date(typeof value === 'number' && value < 1e11 ? value * 1000 : value)
  if (Number.isNaN(date.getTime())) return ''
  return pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes())
}

/** 播放时长 mm:ss。 */
export function durationText(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  return pad(Math.floor(total / 60)) + ':' + pad(total % 60)
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
