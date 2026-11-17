// 宠物面板的展示格式化：统一「无回报显示 --、未知枚举显示未知」（PRD 5.1）。
import { COMFORT_RANGE } from '../model/tsl.js'

export const EMPTY_TEXT = '--'

export function isMissing(value) {
  return value === undefined || value === null || value === ''
}

export function numberText(value, digits = 0) {
  if (isMissing(value)) return EMPTY_TEXT
  const num = Number(value)
  if (!Number.isFinite(num)) return EMPTY_TEXT
  return num.toFixed(digits)
}

/** 枚举文案：未知值显示「未知」，不默认选中任何一项（PRD 4.4/4.6/验收）。 */
export function enumText(t, enumKey, value) {
  if (isMissing(value)) return EMPTY_TEXT
  const key = `pages.pet.enums.${enumKey}.${value}`
  const text = t(key)
  return text === key ? t('pages.pet.enums.unknown') : text
}

/** 温度舒适度标签（PRD 4.4）。 */
export function temperatureTagKey(value, range = COMFORT_RANGE) {
  if (isMissing(value)) return ''
  const num = Number(value)
  if (!Number.isFinite(num)) return ''
  if (num > range.max) return 'pages.pet.env.hot'
  if (num < range.min) return 'pages.pet.env.cold'
  return 'pages.pet.env.comfort'
}

/** Wi-Fi 信号强度分档，用于叠层图标与设备状态行。 */
export function wifiLevel(rssi) {
  if (isMissing(rssi)) return ''
  const value = Number(rssi)
  if (!Number.isFinite(value)) return ''
  if (value >= -55) return 'strong'
  if (value >= -70) return 'fair'
  return 'weak'
}

/** 观看时长：从开始播放起按 mm:ss 计时。 */
export function durationText(startedAt, now = Date.now()) {
  if (!startedAt) return '00:00'
  const total = Math.max(0, Math.floor((now - startedAt) / 1000))
  const minutes = String(Math.floor(total / 60)).padStart(2, '0')
  const seconds = String(total % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

/** 活跃度圆环：内联 SVG data-uri，避免新增静态资源。 */
export function ringSource(percent, color = '#ff8a3d') {
  const value = Math.max(0, Math.min(100, Number(percent) || 0))
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const dash = (circumference * value) / 100
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<circle cx="32" cy="32" r="${radius}" fill="none" stroke="#f0f2f5" stroke-width="6"/>` +
    `<circle cx="32" cy="32" r="${radius}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${dash} ${circumference}" transform="rotate(-90 32 32)"/>` +
    `</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}
