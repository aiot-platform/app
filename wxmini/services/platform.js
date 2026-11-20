// 平台能力数据源（宠物档案、店铺与营业时段、日报、店员留言、动态时间线、相册）。
//
// 数据来源分两种：
//   1. 已登录（持有 C 端 access_token）：走 C 端宠物接口 /api/v1/c/pets/:device_id/*，本文件负责把
//      后端 snake_case 字段映射成页面一直使用的结构，页面无需改动。
//   2. 演示模式（无令牌）：沿用内置示例数据，保证一进小程序就能看到完整面板。
//
// 时间线与相册的「新增」目前仍是本地存储：后端 C 端仅提供只读列表接口，等写入接口就绪后再切换。
import { nowStr, timeText } from '../utils/format.js'
import {
  isCLoggedIn,
  cGetProfile,
  cGetDailyReport,
  cGetStaffNotes,
  cGetTimeline,
  cGetAlbum
} from './c-api.js'

const TIMELINE_KEY = 'pet_timeline_mock'
const ALBUM_KEY = 'pet_album_mock'
const BADGE_KEY = 'pet_album_badge'

function readStore(key) {
  try {
    const value = wx.getStorageSync(key)
    return Array.isArray(value) ? value : []
  } catch (error) {
    console.warn('[pet] 本地数据读取失败', error)
    return []
  }
}

function writeStore(key, list) {
  try { wx.setStorageSync(key, list.slice(0, 60)) } catch (error) { console.warn('[pet] 本地数据写入失败', error) }
}

function isDemoMode() {
  try {
    // 登录页可显式切换演示模式；未登录同样按演示处理。
    if (String(wx.getStorageSync('pet_demo_mode') || '') === '1') return true
    return !isCLoggedIn()
  } catch (error) { return true }
}

// 演示数据（原型同一套示例）
const DEMO_PROFILE = {
  pet: { name: '奶糕', breed: '金毛', age: '2岁', avatar: '', boardingDays: 3 },
  shop: { name: '暖暖宠物之家', openTime: '08:00', closeTime: '21:00' }
}
const DEMO_REPORT = { eatCount: 2, sleepHours: 5.5, playMinutes: 48, drinkCount: 6 }
const DEMO_NOTES = [{
  id: 'note-1',
  staffName: '店员小林',
  content: '奶糕今天特别乖，中午把狗粮吃得干干净净，下午和我玩了接球，现在在窝里睡得很香～',
  time: '10 分钟前'
}]
const DEMO_TIMELINE = [
  { id: 'tl-1', type: 'eat', text: '奶糕吃完了早餐，干饭很香', time: '09:10' },
  { id: 'tl-2', type: 'play', text: '和店员小林玩接球 20 分钟', time: '10:30' },
  { id: 'tl-3', type: 'sleep', text: '午睡开始', time: '11:40' },
  { id: 'tl-4', type: 'care', text: '完成梳毛护理，毛毛蓬松啦', time: '13:20' }
]

// —— 后端 snake_case → 页面结构 映射 ——
function mapProfile(data) {
  const pet = data && data.pet ? data.pet : {}
  const shop = data && data.shop ? data.shop : {}
  return {
    pet: {
      name: pet.name || '',
      breed: pet.breed || '',
      age: pet.age || '',
      avatar: pet.avatar || '',
      boardingDays: Number(pet.boarding_days != null ? pet.boarding_days : (pet.boardingDays || 0))
    },
    shop: {
      name: shop.name || '',
      openTime: shop.open_time || shop.openTime || '',
      closeTime: shop.close_time || shop.closeTime || ''
    }
  }
}

function mapReport(data) {
  const minutes = Number(data && data.sleep_minutes != null ? data.sleep_minutes : 0)
  const hours = data && data.sleep_hours != null ? Number(data.sleep_hours) : Math.round((minutes / 60) * 10) / 10
  return {
    eatCount: Number(data && data.eat_count != null ? data.eat_count : 0),
    sleepHours: hours,
    playMinutes: Number(data && data.play_minutes != null ? data.play_minutes : 0),
    drinkCount: Number(data && data.drink_count != null ? data.drink_count : 0)
  }
}

function mapNote(item) {
  return {
    id: item && item.id,
    staffName: (item && (item.staff_name || item.staffName)) || '',
    content: (item && item.content) || '',
    time: (item && item.time) || timeText(item && item.create_at)
  }
}

function mapTimeline(item) {
  return {
    id: item && item.id,
    type: (item && item.type) || '',
    text: (item && (item.text || item.title)) || '',
    time: (item && item.time) || timeText(item && item.create_at)
  }
}

function mapAlbum(item) {
  return {
    id: item && item.id,
    src: (item && (item.src || item.url)) || '',
    time: (item && item.time) || timeText(item && item.create_at)
  }
}

/** 宠物档案与店铺信息。 */
export async function loadProfile(deviceId) {
  if (isDemoMode()) return DEMO_PROFILE
  return mapProfile(await cGetProfile(deviceId))
}

/** 今日日报（pet_activity 不存在时调用方隐藏日报卡）。 */
export async function loadDailyReport(deviceId) {
  if (isDemoMode()) return DEMO_REPORT
  return mapReport(await cGetDailyReport(deviceId))
}

/** 店员留言；无留言返回空数组，调用方隐藏卡片。 */
export async function loadStaffNotes(deviceId) {
  if (isDemoMode()) return DEMO_NOTES
  const list = await cGetStaffNotes(deviceId)
  return (Array.isArray(list) ? list : []).map(mapNote)
}

/** 时间线：返回「最旧在前」的顺序，页面再 reverse 展示最新在前。 */
export async function loadTimeline(deviceId) {
  const local = readStore(TIMELINE_KEY)
  if (isDemoMode()) return [...DEMO_TIMELINE, ...local]
  const list = await cGetTimeline(deviceId)
  // 后端按 created_at DESC 返回（最新在前），此处反转为最旧在前，与页面 reverse 约定一致。
  const remote = (Array.isArray(list) ? list.map(mapTimeline) : []).reverse()
  return [...remote, ...local]
}

/** 本地新增动态（后端 C 端暂无写入接口，先落本地存储）。 */
export async function appendTimeline(entry) {
  const local = readStore(TIMELINE_KEY)
  const record = { id: `tl-local-${Date.now()}`, time: nowStr(), ...entry }
  writeStore(TIMELINE_KEY, [...local, record])
  return record
}

/** 相册：返回「最新在前」的顺序。 */
export async function loadAlbum(deviceId) {
  const local = readStore(ALBUM_KEY)
  if (isDemoMode()) return local
  const list = await cGetAlbum(deviceId)
  return [...local, ...(Array.isArray(list) ? list.map(mapAlbum) : [])]
}

export async function appendAlbumPhoto(photo) {
  const list = readStore(ALBUM_KEY)
  const record = { id: `photo-${Date.now()}`, time: nowStr(), ...photo }
  writeStore(ALBUM_KEY, [record, ...list])
  return record
}

export function clearAlbumBadge() {
  try { wx.setStorageSync(BADGE_KEY, 0) } catch (error) { console.warn('[pet] 角标清零失败', error) }
}

export function bumpAlbumBadge() {
  try {
    const next = Number(wx.getStorageSync(BADGE_KEY) || 0) + 1
    wx.setStorageSync(BADGE_KEY, next)
    return next
  } catch (error) {
    console.warn('[pet] 角标累加失败', error)
    return 0
  }
}

export function readAlbumBadge() {
  try { return Number(wx.getStorageSync(BADGE_KEY) || 0) } catch (error) { return 0 }
}
