// 平台能力数据源（PRD 2.5 / 4.11 / 4.5）：宠物档案、店铺与营业时段、日报、店员留言、时间线、相册。
//
// 数据来源分两种：
//   1. 已登录（持有 C 端 access_token）：走 C 端宠物接口 /api/v1/c/pets/:device_id/*，本文件负责把
//      后端 snake_case 字段映射成调用方一直使用的 camelCase 结构，消费方无需改动。
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

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60000).toISOString()
}

function isDemoMode() {
  try { return !isCLoggedIn() } catch { return true }
}

function byTimeDesc(a, b) {
  return new Date(b.createAt || 0) - new Date(a.createAt || 0)
}

// 演示数据（接口就绪前预览面板用）
const DEMO_PROFILE = {
  pet: { name: '豆豆', breed: '柯基', age: '2 岁', avatar: '', boardingDays: 3 },
  shop: { name: '暖橙宠物生活馆', openTime: '08:00', closeTime: '21:00' }
}
const DEMO_REPORT = { eatCount: 3, sleepMinutes: 268, playMinutes: 45, drinkCount: 4 }
const DEMO_NOTES = [
  { id: 'note-1', staffName: '小雨', content: '上午带它晒了 20 分钟太阳，精神很好。', createAt: minutesAgo(150) },
  { id: 'note-2', staffName: '阿凯', content: '午饭吃完了，下午有点困，一直在窝里睡。', createAt: minutesAgo(80) }
]
const DEMO_TIMELINE = [
  { id: 'tl-1', type: 'eat', title: '吃了一份午餐', createAt: minutesAgo(180) },
  { id: 'tl-2', type: 'play', title: '在活动区和球玩了 15 分钟', createAt: minutesAgo(120) },
  { id: 'tl-3', type: 'sleep', title: '午睡 1 小时', createAt: minutesAgo(70) },
  { id: 'tl-4', type: 'care', title: '店员梳理了毛发', createAt: minutesAgo(35) }
]

// —— 后端 snake_case → 前端 camelCase 映射 ——
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
  return {
    eatCount: Number(data?.eat_count ?? data?.eatCount ?? 0),
    sleepMinutes: Number(data?.sleep_minutes ?? data?.sleepMinutes ?? 0),
    playMinutes: Number(data?.play_minutes ?? data?.playMinutes ?? 0),
    drinkCount: Number(data?.drink_count ?? data?.drinkCount ?? 0)
  }
}

function mapNote(item) {
  return {
    id: item?.id,
    staffName: item?.staff_name ?? item?.staffName ?? '',
    content: item?.content || '',
    createAt: item?.create_at ?? item?.time ?? ''
  }
}

function mapTimeline(item) {
  return {
    id: item?.id,
    type: item?.type || '',
    title: item?.title ?? item?.text ?? '',
    createAt: item?.create_at ?? item?.time ?? ''
  }
}

function mapAlbum(item) {
  return {
    id: item?.id,
    url: item?.url ?? item?.src ?? '',
    createAt: item?.create_at ?? item?.time ?? ''
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

/** 时间线（倒序），本地新增的投喂记录合并展示（PRD 4.6）。 */
export async function loadTimeline(deviceId) {
  const local = readStore(TIMELINE_KEY)
  if (isDemoMode()) return [...local, ...DEMO_TIMELINE].sort(byTimeDesc)
  const list = await cGetTimeline(deviceId)
  return [...local, ...(Array.isArray(list) ? list.map(mapTimeline) : [])].sort(byTimeDesc)
}

/** 本地新增动态（后端 C 端暂无写入接口，先落本地存储，保证投喂记录即时可见）。 */
export async function appendTimeline(entry) {
  const local = readStore(TIMELINE_KEY)
  const record = { id: `tl-local-${Date.now()}`, createAt: new Date().toISOString(), ...entry }
  writeStore(TIMELINE_KEY, [record, ...local])
  return record
}

/** 相册：抓拍成功后写入一条记录（PRD 4.5）。 */
export async function loadAlbum(deviceId) {
  const local = readStore(ALBUM_KEY)
  if (isDemoMode()) return local
  const list = await cGetAlbum(deviceId)
  return [...local, ...(Array.isArray(list) ? list.map(mapAlbum) : [])].sort(byTimeDesc)
}

export async function appendAlbumPhoto(photo) {
  const list = readStore(ALBUM_KEY)
  const record = { id: `photo-${Date.now()}`, createAt: new Date().toISOString(), ...photo }
  writeStore(ALBUM_KEY, [record, ...list])
  return record
}

export function clearAlbumBadge() {
  try { uni.setStorageSync('pet_album_badge', 0) } catch (error) { console.warn('[pet] 角标清零失败', error) }
}

export function bumpAlbumBadge() {
  try {
    const next = Number(uni.getStorageSync('pet_album_badge') || 0) + 1
    uni.setStorageSync('pet_album_badge', next)
    return next
  } catch (error) {
    console.warn('[pet] 角标累加失败', error)
    return 0
  }
}

export function readAlbumBadge() {
  try { return Number(uni.getStorageSync('pet_album_badge') || 0) } catch { return 0 }
}
