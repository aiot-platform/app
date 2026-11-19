// 宠物看护控制面板（首页容器）：装配设备数据（物模型）+ 平台能力 + 面板内导航。
// 交互与视觉对齐原型 pet-prd/音视频交互原型.html；数据链路复用 ThingsPanel 后端。
import { ICON, PAWS, ringSource } from '../../utils/icons.js'
import { buildCapabilities } from '../../utils/model.js'
import { RES, SPEC } from '../../utils/tsl.js'
import { enumLabel, number, numberText, tempInfo, durationText, wifiText, clamp, EMPTY } from '../../utils/format.js'
import { createPetRuntime } from '../../services/runtime.js'
import { createDemoRuntime, createDemoRtcSession } from '../../services/demo.js'
import { createRtcSession, fetchRtcAuth } from '../../services/rtc/index.js'
import {
  appendAlbumPhoto, appendTimeline, bumpAlbumBadge, clearAlbumBadge,
  loadAlbum, loadDailyReport, loadProfile, loadStaffNotes, loadTimeline
} from '../../services/platform.js'

// 宠物状态（AI 识别）的图标与配色，取自原型 ACT_STYLE。
const ACTIVITY_STYLE = {
  0: { icon: 'moodNone', bg: '#f3efec', color: '#a39690' },
  1: { icon: 'moodRest', bg: 'var(--sky)', color: '#4f9bff' },
  2: { icon: 'moodSleep', bg: '#ece9ff', color: '#7d6bff' },
  3: { icon: 'moodRun', bg: 'var(--mint)', color: '#25b283' },
  4: { icon: 'moodEat', bg: 'var(--sun)', color: '#e2a21c' },
  5: { icon: 'moodWater', bg: 'var(--sky)', color: '#3b8ef0' }
}
const UNKNOWN_STYLE = { icon: 'unk', bg: '#f3efec', color: '#a39690' }

// 动态时间线的节点配色（原型 TL_COLORS）。
const TL_COLORS = { eat: '#ffab7a', play: '#4cc9a0', sleep: '#7d9bff', care: '#ff8fb1', treat: '#ffc247', you: '#ff8a4c' }

const ALERT_LEVEL = { ERROR: 3, WARN: 2, INFO: 1 }
const TITLES = { home: '', feed: '宠物动态', album: '相册', more: '更多' }

const EMPTY_PENDING = {}

Page({
  data: {
    statusBar: 20,
    clock: '',
    tab: 'home',
    title: '',
    tabs: [],
    ic: { ...ICON, paws: PAWS },
    demo: true,
    rtcMode: 'demo',
    playerList: [],
    pusher: { url: '' },

    petName: '宠物',
    petTag: '',
    petMeta: '',
    online: false,
    shopName: '',

    alert: null,

    playing: false,
    connecting: false,
    full: false,
    clientMute: false,
    talking: false,
    err: '',
    poster: { kind: '', icon: ICON.posterCam, text: '', hint: '', showBtn: true, btnDisabled: false, btnIcon: ICON.playDeep, btn: '实时流', retry: false, spinning: false },
    dur: '00:00',
    videoStyle: '',
    levels: [6, 10, 4, 12, 7],

    viewersShow: false,
    viewers: '',
    wifiShow: false,
    wifi: '',
    moodShow: false,
    mood: { icon: ICON.unk, text: '' },
    micShow: false,
    micOn: false,
    qualityShow: false,
    qualityLabel: '',
    qualityRes: '',

    statusShow: false,
    act: { icon: ICON.unk, bg: '#f3efec', color: '#a39690', title: EMPTY, sub: '' },
    ringUrl: '',
    levelText: EMPTY,
    env: { temp: { show: false, value: EMPTY, tag: '', color: '' }, hum: { show: false, value: EMPTY } },

    quick: [],
    cap: { pet_activity: false, activity_level: false, env_temperature: false, env_humidity: false },

    report: [],
    notes: [],
    timeline: [],

    photos: [],
    photoViewer: null,

    more: {
      watch: { show: false, quality: { show: false, label: EMPTY }, mic: { show: false, on: false, pending: false }, volume: { show: false, text: EMPTY, canDec: false, canInc: false, pending: false } },
      picture: { show: false, night: { show: false, label: EMPTY }, flip: { show: false, on: false, pending: false } },
      device: { show: false, items: [] }
    },

    collar: { show: false, onlineShow: false, online: false, items: [] },

    sheet: { visible: false, title: '', options: [], active: undefined, canConfirm: false },
    toastShow: false,
    toastText: ''
  },

  onLoad(options = {}) {
    const app = getApp()
    this.deviceId = String(options.device_id || options.deviceId || '')
    if (options.token) wx.setStorageSync('access_token', String(options.token))
    if (options.server) wx.setStorageSync('serverAddress', String(options.server))
    // 演示模式：显式 ?demo=1，或未登录时自动启用（等价 H5 预览）。
    this.demo = String(options.demo || '') === '1' || !wx.getStorageSync('access_token')
    if (!this.deviceId) this.deviceId = 'demo-device'

    this.values = {}
    this.fields = []
    this.models = {}
    this.events = []
    this.profile = { pet: {}, shop: {} }
    this.platform = { report: {}, notes: [], timeline: [], album: [] }
    this.ui = {
      tab: 'home',
      online: null,
      playing: false,
      connecting: false,
      full: false,
      clientMute: false,
      talking: false,
      err: '',
      startedAt: 0,
      elapsed: 0,
      dismissed: {},
      alertCode: '',
      newPhotos: 0,
      pending: { ...EMPTY_PENDING },
      treating: false,
      forceAct: null,
      sheetCode: '',
      sheetDraft: undefined
    }
    this.session = null

    this.setData({
      statusBar: (app && app.globalData && app.globalData.statusBarHeight) || 20,
      demo: this.demo,
      rtcMode: this.demo ? 'demo' : 'wx'
    })
    this.startClock()
    this.boot()
  },

  onUnload() {
    this.stopTicker()
    if (this.clockTimer) clearInterval(this.clockTimer)
    if (this.forceActTimer) clearTimeout(this.forceActTimer)
    if (this.toastTimer) clearTimeout(this.toastTimer)
    if (this.runtime) this.runtime.stop()
    if (this.session) { try { this.session.leave() } catch (error) { /* 页面已卸载 */ } }
    this.runtime = null
    this.session = null
  },

  async boot() {
    if (this.runtime) this.runtime.stop()
    const handlers = {
      onValues: values => { this.values = { ...this.values, ...values }; this.refresh() },
      onOnline: online => { this.ui.online = online; this.refresh() },
      onEvents: events => { this.events = events || []; this.refresh() },
      onState: state => { if (state && state.status === 'error') console.warn('[pet]', state.message) }
    }
    this.runtime = this.demo
      ? createDemoRuntime(handlers)
      : createPetRuntime({ deviceId: this.deviceId, ...handlers })
    try {
      const context = await this.runtime.start()
      this.fields = (context && context.fields) || []
      this.models = this.runtime.models || {}
      this.ui.online = this.runtime.online
      await this.loadPlatform()
    } catch (error) {
      console.warn('[pet] 设备数据加载失败', error)
      this.toast((error && error.message) || '设备数据加载失败')
    }
    this.refresh()
  },

  async loadPlatform() {
    const [profile, report, notes, timeline, album] = await Promise.all([
      loadProfile(this.deviceId).catch(() => ({ pet: {}, shop: {} })),
      loadDailyReport(this.deviceId).catch(() => ({})),
      loadStaffNotes(this.deviceId).catch(() => []),
      loadTimeline(this.deviceId).catch(() => []),
      loadAlbum(this.deviceId).catch(() => [])
    ])
    this.profile = profile || { pet: {}, shop: {} }
    this.platform = { report: report || {}, notes: notes || [], timeline: timeline || [], album: album || [] }
  },

  // ================= 视图刷新 =================

  refresh() {
    const d = this.values || {}
    const pet = this.profile.pet || {}
    const shop = this.profile.shop || {}
    const caps = buildCapabilities(this.fields || [], d, this.models || {})
    this.caps = caps

    const online = this.ui.online === true
    const playing = this.ui.playing
    const connecting = this.ui.connecting
    const avStatus = number(d.av_status)
    const petName = pet.name || '宠物'
    const shopName = shop.name || ''
    const petTag = [pet.breed, pet.age].filter(Boolean).join(' · ')
    const petMeta = [shopName, pet.boardingDays ? '寄养第 ' + pet.boardingDays + ' 天' : ''].filter(Boolean).join(' · ')
    const hours = shop.openTime && shop.closeTime ? '开放时间 ' + shop.openTime + '–' + shop.closeTime : ''

    // ---- 播放器封面 ----
    const poster = { kind: '', icon: ICON.posterCam, text: '', hint: '', showBtn: true, btnDisabled: false, btnIcon: ICON.playDeep, btn: '实时流', retry: false, spinning: false }
    if (!online) {
      poster.kind = 'offline'
      poster.icon = ICON.posterOff
      poster.text = '设备离线，暂时看不到' + petName
      poster.btnDisabled = true
      poster.btnIcon = ICON.playSoft
    } else if (!this.shopOpen()) {
      poster.kind = 'closed'
      poster.icon = ICON.posterMoon
      poster.text = '店铺休息时段，暂不开放实时画面'
      poster.hint = hours
      poster.btnDisabled = true
      poster.btnIcon = ICON.playSoft
    } else if (connecting) {
      poster.spinning = true
      poster.showBtn = false
      poster.text = '正在连接' + shopName + '的摄像头…'
    } else if (this.ui.err || avStatus === 3) {
      poster.kind = 'err'
      poster.icon = ICON.posterWarn
      poster.text = this.ui.err || '设备推流异常，暂时无法播放'
      poster.btn = '重试'
      poster.retry = true
    } else {
      poster.text = avStatus === 1 ? '摄像头正在推流，点击观看' : '看看' + petName + '在店里的样子'
    }

    // ---- 播放中 HUD ----
    const viewersShow = caps.hasProperty('viewer_count')
    const wifiShow = caps.hasProperty('wifi_rssi')
    const moodShow = caps.hasProperty('pet_activity')
    const micShow = caps.hasProperty('mic_switch')
    const micOn = !!number(this.display('mic_switch'))
    const act = this.ui.forceAct !== null ? this.ui.forceAct : (caps.hasProperty('pet_activity') ? number(d.pet_activity) : null)
    const level = caps.hasProperty('activity_level') ? number(d.activity_level) : null
    const style = act !== null && ACTIVITY_STYLE[act] ? ACTIVITY_STYLE[act] : UNKNOWN_STYLE
    const actText = act === null ? EMPTY : enumLabel('pet_activity', act)
    const moodText = act === null ? EMPTY : (act === 0 ? enumLabel('pet_activity', 0) : petName + enumLabel('pet_activity', act))

    const qualityShow = caps.hasProperty('video_quality')
    const qualityValue = this.display('video_quality')

    // ---- 状态卡 ----
    const statusShow = caps.hasProperty('pet_activity') || caps.hasProperty('activity_level') ||
      caps.hasProperty('env_temperature') || caps.hasProperty('env_humidity')
    const [tempValue, tempTag, tempColor] = tempInfo(d.env_temperature)

    // ---- 快捷操作 ----
    const quick = []
    if (caps.hasService('snapshot')) {
      quick.push({ key: 'snapshot', icon: ICON.quickSnap, bg: 'var(--primary-soft)', color: 'var(--primary-deep)', label: '抓拍', sub: '', disabled: !playing, on: false })
    }
    if (caps.hasService('dispense_treat')) {
      const left = caps.hasProperty('treat_left') ? number(d.treat_left) : null
      const none = left !== null && left <= 0
      quick.push({
        key: 'treat', icon: ICON.quickBone, bg: 'var(--sun)', color: '#d89a10',
        label: this.ui.treating ? '投喂中…' : '投喂零食',
        sub: left === null ? '' : none ? '今日已投完' : '今日还可 ' + left + ' 次',
        disabled: !online || none || this.ui.treating, on: false
      })
    }
    quick.push({ key: 'talk', icon: ICON.quickMic, bg: 'var(--mint)', color: '#25b283', label: this.ui.talking ? '结束对讲' : '和它说话', sub: '', disabled: !playing, on: this.ui.talking })

    // ---- 更多页分组 ----
    const groups = caps.groups || { watch: [], picture: [], device: [] }
    const more = {
      watch: {
        show: groups.watch.length > 0,
        quality: { show: caps.hasProperty('video_quality'), label: this.ui.pending.video_quality !== undefined ? '提交中…' : enumLabel('video_quality', qualityValue) },
        mic: { show: caps.hasProperty('mic_switch'), on: micOn, pending: this.ui.pending.mic_switch !== undefined },
        volume: this.volumeView(caps, d)
      },
      picture: {
        show: groups.picture.length > 0,
        night: { show: caps.hasProperty('night_vision'), label: this.ui.pending.night_vision !== undefined ? '提交中…' : enumLabel('night_vision', this.display('night_vision')) },
        flip: { show: caps.hasProperty('image_flip'), on: number(this.display('image_flip')) === 1, pending: this.ui.pending.image_flip !== undefined }
      },
      device: { show: groups.device.length > 0, items: this.deviceItems(caps, d) }
    }

    // ---- 底部导航（入口随能力级联变化）----
    const tabs = [
      { key: 'home', label: '实时', icon: ICON.tabLive, iconOn: ICON.tabLiveOn },
      { key: 'feed', label: '动态', icon: ICON.tabFeed, iconOn: ICON.tabFeedOn }
    ]
    if (caps.hasAlbum) tabs.push({ key: 'album', label: '相册', icon: ICON.tabAlbum, iconOn: ICON.tabAlbumOn, badge: this.ui.newPhotos })
    if (caps.hasMore) tabs.push({ key: 'more', label: '更多', icon: ICON.tabMore, iconOn: ICON.tabMoreOn })
    if (!tabs.some(item => item.key === this.ui.tab)) this.ui.tab = 'home'

    // ---- 项圈（Wi-Fi 近场报给边缘网关，随网关统一送云）----
    const collarItems = []
    if (caps.hasProperty('pet_body_temperature')) {
      const temp = number(d.pet_body_temperature)
      collarItems.push({ k: '体温', v: temp === null ? EMPTY : numberText(temp, 1) + '℃' })
    }
    if (caps.hasProperty('pet_heart_rate')) {
      const heart = number(d.pet_heart_rate)
      collarItems.push({ k: '心率', v: heart === null ? EMPTY : numberText(heart, 0) + ' bpm' })
    }
    if (caps.hasProperty('collar_battery')) {
      const battery = number(d.collar_battery)
      collarItems.push({ k: '电量', v: battery === null ? EMPTY : numberText(battery, 0) + '%' })
    }
    const collar = {
      show: collarItems.length > 0 || caps.hasProperty('collar_online'),
      onlineShow: caps.hasProperty('collar_online'),
      online: number(d.collar_online) === 1,
      items: collarItems
    }

    const report = this.reportView(caps)
    const timeline = [...this.platform.timeline].reverse().map(item => ({
      id: item.id, time: item.time, text: item.text, color: TL_COLORS[item.type] || '#ffab7a'
    }))
    const photos = (this.platform.album || []).map(item => ({ id: item.id, src: item.src || item.url, time: item.time }))

    this.setData({
      clock: this.clockText(),
      tab: this.ui.tab,
      title: TITLES[this.ui.tab] || '',
      tabs,
      demo: this.demo,
      online,
      petName,
      petTag,
      petMeta,
      shopName,
      alert: this.alertView(petName),
      playing,
      connecting,
      full: this.ui.full,
      clientMute: this.ui.clientMute,
      talking: this.ui.talking,
      err: this.ui.err,
      poster,
      dur: durationText(this.ui.elapsed),
      videoStyle: this.videoStyle(caps),
      viewersShow: viewersShow && playing,
      viewers: numberText(d.viewer_count, 0) + ' 人在看',
      wifiShow: wifiShow && playing,
      wifi: wifiText(d.wifi_rssi),
      moodShow: moodShow && playing,
      mood: { icon: ICON[style.icon], text: moodText },
      micShow,
      micOn,
      qualityShow,
      qualityLabel: enumLabel('video_quality', qualityValue),
      qualityRes: ((RES[number(qualityValue)] || RES[3])[2]),
      statusShow,
      act: { icon: ICON[style.icon], bg: style.bg, color: style.color, title: actText, sub: !online ? '设备离线，显示最后一次状态' : playing ? '画面同步中' : '来自设备最新回报' },
      ringUrl: ringSource(level === null ? 0 : level),
      levelText: level === null ? EMPTY : level + '%',
      env: {
        temp: { show: caps.hasProperty('env_temperature'), value: tempValue, tag: tempTag, color: tempColor },
        hum: { show: caps.hasProperty('env_humidity'), value: numberText(d.env_humidity, 0) }
      },
      quick,
      cap: {
        pet_activity: caps.hasProperty('pet_activity'),
        activity_level: caps.hasProperty('activity_level'),
        env_temperature: caps.hasProperty('env_temperature'),
        env_humidity: caps.hasProperty('env_humidity')
      },
      report,
      notes: this.platform.notes || [],
      timeline,
      photos,
      more,
      collar
    })
  },

  volumeView(caps, d) {
    const show = caps.hasProperty('speaker_volume')
    const value = number(this.display('speaker_volume'))
    const spec = SPEC.speaker_volume
    return {
      show,
      text: value === null ? EMPTY : value + spec.unit,
      canDec: value !== null && value > spec.min,
      canInc: value !== null && value < spec.max,
      pending: this.ui.pending.speaker_volume !== undefined
    }
  },

  deviceItems(caps, d) {
    const items = []
    if (caps.hasProperty('viewer_count')) items.push({ k: '当前观看人数', v: numberText(d.viewer_count, 0) + ' 人' })
    if (caps.hasProperty('wifi_rssi')) items.push({ k: 'Wi-Fi 信号强度', v: wifiText(d.wifi_rssi) })
    if (caps.hasProperty('sd_status')) items.push({ k: '存储卡状态', v: enumLabel('sd_status', d.sd_status) })
    return items
  },

  reportView(caps) {
    if (!caps.hasProperty('pet_activity')) return []
    const report = this.platform.report || {}
    return [
      { k: '进食(次)', v: numberText(report.eatCount, 0) },
      { k: '睡眠(小时)', v: numberText(report.sleepHours, 1) },
      { k: '玩耍(分钟)', v: numberText(report.playMinutes, 0) },
      { k: '喝水(次)', v: numberText(report.drinkCount, 0) }
    ]
  },

  alertView(petName) {
    const active = (this.events || []).filter(item => item && item.code && !this.ui.dismissed[item.code])
    if (!active.length) return null
    active.sort((a, b) => (ALERT_LEVEL[b.level] || 0) - (ALERT_LEVEL[a.level] || 0))
    const top = active[0]
    const data = top.data || {}
    this.ui.alertCode = top.code
    if (top.code === 'stream_error') {
      return { cls: '', icon: ICON.alertDanger, closeIcon: ICON.closeDanger, text: '推流异常：' + enumLabel('stream_error', data.error_code === undefined ? 1 : data.error_code), count: active.length }
    }
    if (top.code === 'sd_card_error') {
      return { cls: 'warn', icon: ICON.alertWarn, closeIcon: ICON.closeWarn, text: '设备存储卡异常，不影响观看', count: active.length }
    }
    if (top.code === 'env_abnormal') {
      return { cls: 'warn', icon: ICON.alertWarn, closeIcon: ICON.closeWarn, text: '舍内温度异常（' + (data.value === undefined ? EMPTY : data.value) + '℃），店员已收到通知', count: active.length }
    }
    if (top.code === 'bark_alert') {
      return { cls: 'info', icon: ICON.alertInfo, closeIcon: ICON.closeInfo, text: petName + '在叫（约 ' + (data.volume_db || 72) + ' 分贝），店员正在关注', count: active.length }
    }
    return null
  },

  // 画面设置（夜视 / 翻转）只作用于演示占位画面；真实 live-player 由设备侧生效。
  videoStyle(caps) {
    const styles = []
    if (caps.hasProperty('image_flip') && number(this.display('image_flip')) === 1) styles.push('transform:rotate(180deg)')
    if (caps.hasProperty('night_vision') && number(this.display('night_vision')) === 1) styles.push('filter:grayscale(1) sepia(1) hue-rotate(65deg) saturate(2.4) brightness(1.1)')
    return styles.join(';')
  },

  display(code) {
    return this.ui.pending[code] !== undefined ? this.ui.pending[code] : this.values[code]
  },

  petName() {
    return (this.profile.pet && this.profile.pet.name) || '宠物'
  },

  shopOpen() {
    const shop = this.profile.shop || {}
    if (!shop.openTime || !shop.closeTime) return true
    const now = new Date()
    const minutes = now.getHours() * 60 + now.getMinutes()
    const toMinutes = text => {
      const parts = String(text).split(':')
      return Number(parts[0] || 0) * 60 + Number(parts[1] || 0)
    }
    return minutes >= toMinutes(shop.openTime) && minutes <= toMinutes(shop.closeTime)
  },

  clockText() {
    const now = new Date()
    return now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0')
  },

  // ================= 播放器 =================

  ensureSession() {
    if (!this.session) {
      const onState = state => { if (state && state.status === 'ended' && this.ui.playing) this.stopLive() }
      if (this.demo) {
        this.session = createDemoRtcSession({ onState })
      } else {
        const app = getApp()
        const AliRtcEngine = app && app.globalData ? app.globalData.AliRtcEngine : null
        this.session = createRtcSession({ page: this, AliRtcEngine, onState, onRemote: info => this.onRemote(info) })
      }
    }
    return this.session
  },

  onRemote(info) {
    if (!info || !Array.isArray(info.users)) return
    const playerList = info.users.map(user => ({
      userId: user.userId || user.user_id || user.uid,
      url: user.url || user.playUrl || user.streamUrl || ''
    })).filter(item => item.userId && item.url)
    if (playerList.length) this.setData({ playerList })
  },

  async startLive() {
    if (!this.ui.online) { this.toast('设备离线，无法查看实时流'); return }
    if (!this.shopOpen()) { this.toast('店铺休息时段，暂不开放实时画面'); return }
    if (this.ui.connecting || this.ui.playing) return
    this.ui.err = ''
    this.ui.connecting = true
    this.refresh()
    try {
      const session = this.ensureSession()
      if (!session.supported) throw this.fail('当前小程序未接入实时音视频 SDK')
      const result = await this.withTimeout(
        this.runtime.callService('start_live', { quality: number(this.display('video_quality')) || 3 }),
        this.runtime.timeout.service
      )
      if (result === 1) throw this.fail(enumLabel('start_live_result', 1) + '，请稍后重试')
      if (result === 2) throw this.fail(enumLabel('start_live_result', 2) + '（上限 ' + SPEC.viewer_count.max + ' 人）')
      if (result === 3) throw this.fail(enumLabel('start_live_result', 3))
      // 以设备回报为准：av_status 进入推流中 / 对讲中才展示画面。
      await this.runtime.waitForValue('av_status', value => Number(value) === 1 || Number(value) === 2, this.runtime.timeout.service)
      if (this.demo) await session.join()
      else await session.join(await fetchRtcAuth(this.deviceId))
      this.ui.connecting = false
      this.ui.playing = true
      this.ui.startedAt = Date.now()
      this.ui.elapsed = 0
      this.startTicker()
    } catch (error) {
      this.ui.connecting = false
      this.ui.playing = false
      this.ui.err = error && error.code === 'TIMEOUT'
        ? '连接超时，请检查网络后重试'
        : (error && error.message) || '实时流连接失败，请重试'
    }
    this.refresh()
  },

  async stopLive() {
    const wasLive = this.ui.playing
    this.ui.playing = false
    this.ui.full = false
    this.ui.talking = false
    this.ui.startedAt = 0
    this.ui.elapsed = 0
    this.stopTicker()
    await this.releaseSession()
    this.refresh()
    if (!wasLive) return
    try {
      await this.runtime.callService('stop_live', {})
    } catch (error) {
      console.warn('[pet] 停止实时流失败', error)
    }
  },

  async releaseSession() {
    const session = this.session
    this.session = null
    this.setData({ playerList: [], pusher: { url: '' } })
    if (session) { try { await session.leave() } catch (error) { console.warn('[pet] 退出实时频道失败', error) } }
  },

  toggleMute() {
    this.ui.clientMute = !this.ui.clientMute
    if (this.session) this.session.setMuted(this.ui.clientMute)
    this.refresh()
  },

  async toggleTalk() {
    if (!this.ui.playing || !this.ui.online) return
    const session = this.session
    if (!session) return
    const next = !this.ui.talking
    try {
      if (next) await session.startTalk()
      else await session.stopTalk()
      this.ui.talking = next
      // 演示模式没有真实回报，本地同步 av_status 以呈现「对讲中」。
      if (this.demo) this.values = { ...this.values, av_status: next ? 2 : 1 }
      this.toast(next ? '对讲已开启，店里的扬声器会播放你的声音' : '对讲已结束')
    } catch (error) {
      console.warn('[pet] 对讲切换失败', error)
    }
    this.refresh()
  },

  toggleFull() {
    if (!this.ui.playing) return
    this.ui.full = !this.ui.full
    this.refresh()
  },

  startTicker() {
    this.stopTicker()
    this.ticker = setInterval(() => {
      this.ui.elapsed += 1
      const levels = this.data.levels.map(() => 3 + Math.round(Math.random() * 13))
      this.setData({ dur: durationText(this.ui.elapsed), levels })
    }, 1000)
  },

  stopTicker() {
    if (this.ticker) clearInterval(this.ticker)
    this.ticker = null
  },

  startClock() {
    if (this.clockTimer) clearInterval(this.clockTimer)
    this.setData({ clock: this.clockText() })
    this.clockTimer = setInterval(() => this.setData({ clock: this.clockText() }), 10000)
  },

  // ================= 快捷操作 =================

  onQuick(event) {
    const key = event.currentTarget.dataset.key
    if (key === 'snapshot') this.takeSnapshot()
    else if (key === 'treat') this.dispenseTreat()
    else if (key === 'talk') this.toggleTalk()
  },

  async takeSnapshot() {
    if (!this.ui.playing) { this.toast('先点实时流，再抓拍哦'); return }
    try {
      const result = await this.withTimeout(this.runtime.callService('snapshot', {}), this.runtime.timeout.service)
      if (result === 1) { this.toast('先点实时流，再抓拍哦'); return }
      if (result === 2) { this.toast('抓拍失败，请稍后重试'); return }
      // 相册存储是平台能力（接口待定）：先用本地记录保证角标与网格闭环。
      await appendAlbumPhoto({ src: ICON.dog })
      this.ui.newPhotos = bumpAlbumBadge()
      this.platform.album = await loadAlbum()
      this.toast('已抓拍，保存到相册')
    } catch (error) {
      this.toast('抓拍失败，请稍后重试')
    }
    this.refresh()
  },

  async dispenseTreat() {
    if (!this.ui.online) { this.toast('设备离线，无法投喂'); return }
    const left = this.caps && this.caps.hasProperty('treat_left') ? number(this.values.treat_left) : null
    if (left !== null && left <= 0) { this.toast('今日零食已投喂完'); return }
    if (this.ui.treating) return
    this.ui.treating = true
    this.refresh()
    try {
      const result = await this.withTimeout(this.runtime.callService('dispense_treat', {}), this.runtime.timeout.service)
      if (result === 1) this.toast('今日零食已投喂完')
      else if (result === 2 || result === 3) this.toast('设备忙，请稍后再试')
      else {
        const petName = this.petName()
        await appendTimeline({ type: 'treat', text: '你给' + petName + '投喂了一份零食' })
        this.platform.timeline = await loadTimeline()
        this.ui.forceAct = 4
        if (this.forceActTimer) clearTimeout(this.forceActTimer)
        this.forceActTimer = setTimeout(() => { this.ui.forceAct = null; this.refresh() }, 4000)
        this.toast(petName + '收到零食啦～')
      }
    } catch (error) {
      this.toast('投喂失败，请稍后再试')
    }
    this.ui.treating = false
    this.refresh()
  },

  // ================= 更多页写入 =================

  toggleMic() {
    if (!this.ui.online) { this.toast('设备离线，无法操作'); return }
    const on = !!number(this.display('mic_switch'))
    this.commit('mic_switch', on ? 0 : 1)
  },

  toggleFlip() {
    if (!this.ui.online) { this.toast('设备离线，无法操作'); return }
    const on = number(this.display('image_flip')) === 1
    this.commit('image_flip', on ? 0 : 1)
  },

  decVolume() { this.stepVolume(-1) },
  incVolume() { this.stepVolume(1) },

  stepVolume(direction) {
    if (!this.ui.online) return
    const value = number(this.display('speaker_volume'))
    if (value === null) return
    const spec = SPEC.speaker_volume
    const next = clamp(value + direction * spec.step, spec.min, spec.max)
    if (next === value) return
    this.commit('speaker_volume', next)
  },

  // 提交态：写入期间展示待提交值，成功后短暂保留以避免回报到达前闪烁。
  async commit(code, value) {
    if (!this.ui.online) { this.toast('设备离线，无法操作'); return }
    if (this.ui.pending[code] !== undefined) return
    this.ui.pending[code] = value
    this.refresh()
    try {
      await this.withTimeout(this.runtime.writeProperty(code, value), this.runtime.timeout.write)
      setTimeout(() => {
        if (this.ui.pending[code] === value) { delete this.ui.pending[code]; this.refresh() }
      }, 1500)
      return
    } catch (error) {
      this.toast('设置失败，已恢复设备当前值')
    }
    delete this.ui.pending[code]
    this.refresh()
  },

  // ================= 浮层（单选） =================

  openQuality() {
    if (!this.ui.online) { this.toast('设备离线，无法操作'); return }
    const options = this.caps ? this.caps.enumValues('video_quality') : []
    if (options.length < 2) { this.toast('当前仅支持「' + enumLabel('video_quality', options[0]) + '」'); return }
    this.openSheet('video_quality', '选择画质', options, value => (RES[value] || [])[2] || '')
  },

  openNight() {
    if (!this.ui.online) { this.toast('设备离线，无法操作'); return }
    this.openSheet('night_vision', '夜视模式', [0, 1, 2], null)
  },

  openSheet(code, title, options, sub) {
    this.ui.sheetCode = code
    this.ui.sheetDraft = this.values[code]
    this.setData({
      sheet: {
        visible: true,
        title,
        options: options.map(value => ({ value, label: enumLabel(code, value), sub: sub ? sub(value) : '' })),
        active: this.ui.sheetDraft,
        canConfirm: false
      }
    })
  },

  pickOption(event) {
    const value = Number(event.currentTarget.dataset.value)
    this.ui.sheetDraft = value
    this.setData({
      'sheet.active': value,
      'sheet.canConfirm': value !== number(this.values[this.ui.sheetCode])
    })
  },

  confirmOption() {
    const code = this.ui.sheetCode
    const value = this.ui.sheetDraft
    this.closeSheet()
    if (value === undefined || value === number(this.values[code])) return
    this.commit(code, value)
  },

  closeSheet() {
    this.ui.sheetCode = ''
    this.ui.sheetDraft = undefined
    this.setData({ sheet: { visible: false, title: '', options: [], active: undefined, canConfirm: false } })
  },

  // ================= 导航 =================

  go(event) {
    const key = event.currentTarget.dataset.key
    this.closeSheet()
    if (key === 'album') { clearAlbumBadge(); this.ui.newPhotos = 0 }
    this.ui.tab = key
    this.refresh()
  },

  onBack() {
    if (this.data.sheet.visible) { this.closeSheet(); return }
    if (this.ui.tab !== 'home') { this.ui.tab = 'home'; this.refresh() }
  },

  onSettings() {
    this.toast('设备设置（平台通用页面）')
  },

  onPosterBtn() {
    this.startLive()
  },

  dismissAlert() {
    // 关闭只隐藏提示，不代表清除设备事件。
    if (this.ui.alertCode) this.ui.dismissed[this.ui.alertCode] = true
    this.refresh()
  },

  openPhoto(event) {
    const index = Number(event.currentTarget.dataset.index)
    const photo = (this.platform.album || [])[index]
    if (photo) this.setData({ photoViewer: { src: photo.src || photo.url, time: photo.time } })
  },

  closePhoto() {
    this.setData({ photoViewer: null })
  },

  // ================= 工具 =================

  toast(text) {
    if (!text) return
    this.setData({ toastText: text, toastShow: true })
    if (this.toastTimer) clearTimeout(this.toastTimer)
    this.toastTimer = setTimeout(() => this.setData({ toastShow: false }), 1900)
  },

  fail(message) {
    const error = new Error(message)
    error.messageKey = message
    return error
  },

  withTimeout(promise, timeout) {
    return Promise.race([
      promise,
      new Promise((resolve, reject) => setTimeout(() => {
        const error = new Error('调用超时')
        error.code = 'TIMEOUT'
        reject(error)
      }, timeout))
    ])
  }
})
