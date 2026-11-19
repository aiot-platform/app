// 平台能力数据源（PRD 2.5 / 4.11 / 4.5）：宠物档案、店铺与营业时段、日报、店员留言、时间线、相册。
//
// 数据来源分两种：
//   1. 已登录（持有 C 端 access_token）：走 C 端宠物接口 /api/v1/c/pets/:device_id/*，本文件负责把
//      后端 snake_case 字段映射成调用方一直使用的结构，消费方无需改动。
//   2. 演示模式（无令牌，即 pet/index.vue 的 ?demo=1 或无登录态）：沿用内置示例数据，保证 H5 可预览。
//
// 时间线与相册的「新增」目前仍是本地存储：后端 C 端仅提供只读列表接口，等写入接口就绪后再切换。
import {
  isCLoggedIn,
  cGetProfile,
  cGetDailyReport,
  cGetStaffNotes,
  cGetTimeline,
  cGetAlbum
} from '@/api/modules/c-end.js'

const TIMELINE_KEY = 'pet_timeline_mock'
const ALBUM_KEY = 'pet_album_mock'
const BADGE_KEY = 'pet_album_badge'

function readStore(key) {
  try {
    const value = uni.getStorageSync(key)
    return Array.isArray(value) ? value : []
  } catch (error) {
    console.warn('[pet] 本地数据读取失败', error)
    return []
  }
}

function writeStore(key, list) {
  try {
    uni.setStorageSync(key, list.slice(0, 60))
  } catch (error) {
    console.warn('[pet] 本地数据写入失败', error)
  }
}

function nowStr() {
  const date = new Date()
  const pad = num => String(num).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** ISO / 秒级时间戳 → MM-DD HH:mm；无法解析时原样返回。 */
function remoteTime(value) {
  if (!value) return ''
  const date = new Date(typeof value === 'number' && value < 1e11 ? value * 1000 : value)
  if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : ''
  const pad = num => String(num).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function isDemoMode() {
  try { return !isCLoggedIn() } catch { return true }
}

// 演示数据（未登录时预览面板用）
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

// —— 后端 snake_case → 前端结构映射 ——
function mapProfile(data) {
  const pet = data?.pet || {}
  const shop = data?.shop || {}
  return {
    pet: {
      name: pet.name || '',
      breed: pet.breed || '',
      age: pet.age || '',
      avatar: pet.avatar || '',
      boardingDays: Number(pet.boarding_days ?? pet.boardingDays ?? 0)
    },
    shop: {
      name: shop.name || '',
      openTime: shop.open_time || shop.openTime || '',
      closeTime: shop.close_time || shop.closeTime || ''
    }
  }
}

function mapReport(data) {
  let sleepHours = Number(data?.sleep_hours ?? data?.sleepHours ?? 0)
  if (!sleepHours && data?.sleep_minutes != null) sleepHours = Number(data.sleep_minutes) / 60
  return {
    eatCount: Number(data?.eat_count ?? data?.eatCount ?? 0),
    sleepHours,
    playMinutes: Number(data?.play_minutes ?? data?.playMinutes ?? 0),
    drinkCount: Number(data?.drink_count ?? data?.drinkCount ?? 0)
  }
}

function mapNote(item) {
  return {
    id: item?.id,
    staffName: item?.staff_name ?? item?.staffName ?? '',
    content: item?.content || '',
    time: remoteTime(item?.create_at ?? item?.time)
  }
}

function mapTimeline(item) {
  return {
    id: item?.id,
    type: item?.type || '',
    text: item?.title ?? item?.text ?? '',
    time: remoteTime(item?.create_at ?? item?.time)
  }
}

function mapAlbum(item) {
  return {
    id: item?.id,
    src: item?.url ?? item?.src ?? '',
    time: remoteTime(item?.create_at ?? item?.time)
  }
}

/** 宠物档案与店铺信息；档案缺失时调用方只显示设备名与在线标签（PRD 4.2）。 */
export async function loadProfile(deviceId) {
  if (isDemoMode()) return DEMO_PROFILE
  return mapProfile(await cGetProfile(deviceId))
}

/** 今日日报；pet_activity 不存在时调用方隐藏日报卡（PRD 4.11）。 */
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

/** 时间线（正序存储，页面倒序展示；PRD 4.6）。 */
export async function loadTimeline(deviceId) {
  const local = readStore(TIMELINE_KEY)
  if (isDemoMode()) return [...DEMO_TIMELINE, ...local]
  const list = await cGetTimeline(deviceId)
  // 后端按时间倒序返回，本页按正序存储、倒序展示，先反转成正序。
  const remote = (Array.isArray(list) ? list.map(mapTimeline) : []).reverse()
  return [...remote, ...local]
}

export async function appendTimeline(entry) {
  const local = readStore(TIMELINE_KEY)
  const record = { id: `tl-local-${Date.now()}`, time: nowStr(), ...entry }
  writeStore(TIMELINE_KEY, [...local, record])
  return record
}

/** 相册：抓拍成功后写入一条记录（PRD 4.5）。 */
export async function loadAlbum(deviceId) {
  const local = readStore(ALBUM_KEY)
  if (isDemoMode()) return local
  const list = await cGetAlbum(deviceId)
  // 相册最新在前：本地新增在前，后端本身按时间倒序返回。
  return [...local, ...(Array.isArray(list) ? list.map(mapAlbum) : [])]
}

export async function appendAlbumPhoto(photo) {
  const list = readStore(ALBUM_KEY)
  const record = { id: `photo-${Date.now()}`, time: nowStr(), ...photo }
  writeStore(ALBUM_KEY, [record, ...list])
  return record
}

export function clearAlbumBadge() {
  try { uni.setStorageSync(BADGE_KEY, 0) } catch (error) { console.warn('[pet] 角标清零失败', error) }
}

export function bumpAlbumBadge() {
  try {
    const next = Number(uni.getStorageSync(BADGE_KEY) || 0) + 1
    uni.setStorageSync(BADGE_KEY, next)
    return next
  } catch (error) {
    console.warn('[pet] 角标累加失败', error)
    return 0
  }
}
