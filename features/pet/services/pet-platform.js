// 平台能力数据源（PRD 2.5 / 4.11 / 4.5）：宠物档案、店铺与营业时段、日报、店员留言、时间线、相册。
// 首版按约定用本地 mock 跑通 UI，字段名与演示数据与微信小程序端（分支 pet-wxmini）保持一致；
// 接口就绪后只需替换本文件实现，调用方不用改。
//
// 待平台提供的接口约定（后端补齐后删除 mock 分支即可）：
//   GET  /api/v1/pet/profile?device_id=            → { pet:{name,breed,age,avatar,boarding_days}, shop:{name,open_time,close_time} }
//   GET  /api/v1/pet/daily-report?device_id=&date= → { eat_count,sleep_hours,play_minutes,drink_count }
//   GET  /api/v1/pet/staff-notes?device_id=        → [{ id,content,staff_name,create_at }]
//   GET  /api/v1/pet/timeline?device_id=&limit=    → [{ id,type(eat|play|sleep|care|treat),title,time }]
//   POST /api/v1/pet/timeline  { device_id, type, title }
//   GET  /api/v1/pet/album?device_id=              → [{ id,url,time }]
//   POST /api/v1/pet/album     { device_id, url, time }
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

/** 宠物档案与店铺信息；档案缺失时调用方只显示设备名与在线标签（PRD 4.2）。 */
export async function loadProfile() {
  return {
    pet: { name: '奶糕', breed: '金毛', age: '2岁', avatar: '', boardingDays: 3 },
    shop: { name: '暖暖宠物之家', openTime: '08:00', closeTime: '21:00' }
  }
}

/** 今日日报；pet_activity 不存在时调用方隐藏日报卡（PRD 4.11）。 */
export async function loadDailyReport() {
  return { eatCount: 2, sleepHours: 5.5, playMinutes: 48, drinkCount: 6 }
}

/** 店员留言；无留言返回空数组，调用方隐藏卡片。 */
export async function loadStaffNotes() {
  return [{
    id: 'note-1',
    staffName: '店员小林',
    content: '奶糕今天特别乖，中午把狗粮吃得干干净净，下午和我玩了接球，现在在窝里睡得很香～',
    time: '10 分钟前'
  }]
}

/** 时间线（正序存储，页面倒序展示；PRD 4.6）。 */
export async function loadTimeline() {
  const local = readStore(TIMELINE_KEY)
  const seeded = [
    { id: 'tl-1', type: 'eat', text: '奶糕吃完了早餐，干饭很香', time: '09:10' },
    { id: 'tl-2', type: 'play', text: '和店员小林玩接球 20 分钟', time: '10:30' },
    { id: 'tl-3', type: 'sleep', text: '午睡开始', time: '11:40' },
    { id: 'tl-4', type: 'care', text: '完成梳毛护理，毛毛蓬松啦', time: '13:20' }
  ]
  return [...seeded, ...local]
}

export async function appendTimeline(entry) {
  const local = readStore(TIMELINE_KEY)
  const record = { id: `tl-local-${Date.now()}`, time: nowStr(), ...entry }
  writeStore(TIMELINE_KEY, [...local, record])
  return record
}

/** 相册：抓拍成功后写入一条记录（PRD 4.5）。 */
export async function loadAlbum() {
  return readStore(ALBUM_KEY)
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
