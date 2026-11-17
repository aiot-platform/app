// 平台能力数据源（PRD 2.5 / 4.11 / 4.5）：宠物档案、店铺与营业时段、日报、店员留言、时间线、相册。
// 首版按约定用本地 mock 跑通 UI；接口就绪后只需替换本文件实现，调用方不用改。
//
// 待平台提供的接口约定（后端补齐后删除 mock 分支即可）：
//   GET  /api/v1/pet/profile?device_id=            → { pet:{name,breed,age,avatar,boarding_days}, shop:{name,open_time,close_time} }
//   GET  /api/v1/pet/daily-report?device_id=&date= → { eat_count,sleep_minutes,play_minutes,drink_count }
//   GET  /api/v1/pet/staff-notes?device_id=        → [{ id,content,staff_name,create_at }]
//   GET  /api/v1/pet/timeline?device_id=&limit=    → [{ id,type(eat|play|sleep|care|treat),title,create_at }]
//   POST /api/v1/pet/timeline  { device_id, type, title }
//   GET  /api/v1/pet/album?device_id=              → [{ id,url,create_at }]
//   POST /api/v1/pet/album     { device_id, url, create_at }
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

/** 宠物档案与店铺信息；档案缺失时调用方只显示设备名与在线标签（PRD 4.2）。 */
export async function loadProfile() {
  return {
    pet: { name: '豆豆', breed: '柯基', age: '2 岁', avatar: '', boardingDays: 3 },
    shop: { name: '暖橙宠物生活馆', openTime: '08:00', closeTime: '21:00' }
  }
}

/** 今日日报；pet_activity 不存在时调用方隐藏日报卡（PRD 4.11）。 */
export async function loadDailyReport() {
  return { eatCount: 3, sleepMinutes: 268, playMinutes: 45, drinkCount: 4 }
}

/** 店员留言；无留言返回空数组，调用方隐藏卡片。 */
export async function loadStaffNotes() {
  return [
    { id: 'note-1', staffName: '小雨', content: '上午带它晒了 20 分钟太阳，精神很好。', createAt: minutesAgo(150) },
    { id: 'note-2', staffName: '阿凯', content: '午饭吃完了，下午有点困，一直在窝里睡。', createAt: minutesAgo(80) }
  ]
}

/** 时间线（倒序），本地新增的投喂记录合并展示（PRD 4.6）。 */
export async function loadTimeline() {
  const local = readStore(TIMELINE_KEY)
  const seeded = [
    { id: 'tl-1', type: 'eat', title: '吃了一份午餐', createAt: minutesAgo(180) },
    { id: 'tl-2', type: 'play', title: '在活动区和球玩了 15 分钟', createAt: minutesAgo(120) },
    { id: 'tl-3', type: 'sleep', title: '午睡 1 小时', createAt: minutesAgo(70) },
    { id: 'tl-4', type: 'care', title: '店员梳理了毛发', createAt: minutesAgo(35) }
  ]
  return [...local, ...seeded].sort((a, b) => new Date(b.createAt) - new Date(a.createAt))
}

export async function appendTimeline(entry) {
  const local = readStore(TIMELINE_KEY)
  const record = { id: `tl-local-${Date.now()}`, createAt: new Date().toISOString(), ...entry }
  writeStore(TIMELINE_KEY, [record, ...local])
  return record
}

/** 相册：抓拍成功后写入一条记录（PRD 4.5）。 */
export async function loadAlbum() {
  return readStore(ALBUM_KEY)
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
