<template>
  <view class="pet-page">
    <template v-if="!embed">
      <view class="pet-topbar">
        <button class="pet-topbar-btn" :style="{ visibility: activeTab === 'live' ? 'hidden' : 'visible' }" hover-class="pet-page-pressed" @click="goBack">‹</button>
        <text class="pet-topbar-title">{{ navTitle }}</text>
        <button class="pet-topbar-btn" :style="{ visibility: activeTab === 'live' ? 'visible' : 'hidden' }" hover-class="pet-page-pressed" @click="onSettings">⋯</button>
      </view>
    </template>

    <view v-if="loading" class="pet-page-state">正在加载宠物看护…</view>
    <view v-else-if="loadError" class="pet-page-state">
      <text>{{ loadError }}</text>
      <button class="pet-page-retry" hover-class="pet-page-pressed" @click="boot">重试</button>
    </view>
    <template v-else>
      <view v-if="demo" class="pet-demo-badge">演示数据：未连接真实设备与实时通道，仅用于界面预览</view>
      <scroll-view class="pet-page-scroll" scroll-y>
        <pet-live-tab v-show="activeTab === 'live'" :device-id="deviceId" :runtime="runtime" :values="values"
          :online="online" :capabilities="capabilities" :profile="profile" :shop-open="shopOpen" :alert="alert" :demo="demo"
          @dismiss-alert="dismissAlert" @snapshot-saved="onSnapshotSaved" @treat-done="onTreatDone" />
        <pet-timeline-tab v-if="activeTab === 'timeline'" :report="report" :notes="notes" :timeline="timeline"
          :has-activity="capabilities.hasProperty('pet_activity')" />
        <pet-album-tab v-if="activeTab === 'album'" :photos="album" :pet-name="petName" />
        <pet-more-tab v-if="activeTab === 'more'" :runtime="runtime" :values="values" :online="online" :capabilities="capabilities" />
      </scroll-view>
      <!-- App 端内嵌播放时由原生外壳负责返回，不再显示面板内导航（PRD 3.2 的入口裁减规则在 H5/App 一致生效） -->
      <pet-nav v-if="!embed" :items="navItems" :active="activeTab" @change="switchTab" />
    </template>
  </view>
</template>

<script>
import PetNav from '@/features/pet/components/pet-nav.vue'
import PetLiveTab from '@/features/pet/components/pet-live-tab.vue'
import PetTimelineTab from '@/features/pet/components/pet-timeline-tab.vue'
import PetAlbumTab from '@/features/pet/components/pet-album-tab.vue'
import PetMoreTab from '@/features/pet/components/pet-more-tab.vue'
import { createPetRuntime } from '@/features/pet/services/pet-runtime.js'
import { createDemoRuntime } from '@/features/pet/services/pet-demo.js'
import { buildCapabilities } from '@/features/pet/model/capabilities.js'
import { ENUMS } from '@/features/pet/model/tsl.js'
import { appendAlbumPhoto, appendTimeline, bumpAlbumBadge, clearAlbumBadge, loadAlbum, loadDailyReport, loadProfile, loadStaffNotes, loadTimeline } from '@/features/pet/services/pet-platform.js'

// 面板标题：首页不显示标题，其余页签与底部入口一致。
const TAB_TITLES = { live: '', timeline: '宠物动态', album: '相册', more: '更多' }

// 宠物看护面板容器：装配设备数据（物模型）+ 平台能力（本地 mock，接口待平台提供）+ 面板内导航。
export default {
  components: { PetNav, PetLiveTab, PetTimelineTab, PetAlbumTab, PetMoreTab },
  data() {
    return {
      deviceId: '',
      embed: false,
      // 演示模式：显式 ?demo=1，或未登录时自动启用，保证 H5 里一进就能看到完整面板。
      demo: false,
      loading: true,
      loadError: '',
      activeTab: 'live',
      runtime: null,
      values: {},
      online: null,
      fields: [],
      profile: {},
      report: {},
      notes: [],
      timeline: [],
      album: [],
      badge: 0,
      events: [],
      alertDismissed: false
    }
  },
  computed: {
    capabilities() {
      return buildCapabilities(this.fields, this.values, this.runtime?.models || {})
    },
    shopOpen() {
      const shop = this.profile?.shop
      if (!shop?.openTime || !shop?.closeTime) return true
      const now = new Date()
      const minutes = now.getHours() * 60 + now.getMinutes()
      const toMinutes = text => {
        const [hour, minute] = String(text).split(':')
        return Number(hour || 0) * 60 + Number(minute || 0)
      }
      return minutes >= toMinutes(shop.openTime) && minutes <= toMinutes(shop.closeTime)
    },
    navTitle() { return TAB_TITLES[this.activeTab] || '' },
    petName() { return this.profile?.pet?.name || '宠物' },
    navItems() {
      const items = [
        { key: 'live', label: '实时' },
        { key: 'timeline', label: '动态' }
      ]
      if (this.capabilities.hasAlbum) items.push({ key: 'album', label: '相册', badge: this.badge })
      if (this.capabilities.hasMore) items.push({ key: 'more', label: '更多' })
      return items
    },
    alert() {
      if (this.alertDismissed || !this.events.length) return null
      const priority = { ERROR: 3, WARN: 2, INFO: 1 }
      const sorted = [...this.events].sort((a, b) => (priority[b.level] || 0) - (priority[a.level] || 0))
      const top = sorted[0]
      return { level: top.level, text: this.alertText(top), count: sorted.length }
    }
  },
  watch: {
    navItems(items) {
      // 当前页因能力移除失效时自动回首页（PRD 3.2）。
      if (!items.some(item => item.key === this.activeTab)) this.activeTab = 'live'
    }
  },
  onLoad(options = {}) {
    this.deviceId = String(options.device_id || options.deviceId || '')
    this.embed = String(options.embed || '') === '1'
    this.demo = String(options.demo || '') === '1' || !uni.getStorageSync('access_token')
    // App 内嵌播放时，H5 上下文用自己的存储保存平台 token，与设备详情页的内嵌约定一致。
    if (this.embed && options.token) {
      try { uni.setStorageSync('access_token', String(options.token)) } catch (error) { console.warn('[pet] 内嵌登录态写入失败', error) }
    }
    if (!this.deviceId) this.deviceId = this.demo ? 'demo-device' : ''
    if (!this.deviceId) {
      this.loading = false
      this.loadError = '缺少设备信息，请从设备列表进入'
      return
    }
    this.boot()
  },
  onUnload() {
    this.runtime?.stop()
    this.runtime = null
  },
  onBackPress() {
    if (this.activeTab !== 'live') {
      this.switchTab('live')
      return true
    }
    return false
  },
  methods: {
    async boot() {
      this.loading = true
      this.loadError = ''
      try {
        this.runtime?.stop()
        const handlers = {
          deviceId: this.deviceId,
          onValues: values => { this.values = { ...this.values, ...values } },
          onOnline: online => { this.online = online },
          onEvents: events => { this.events = events },
          onState: state => {
            if (state.status === 'error' && !this.runtime?.fields?.length) this.loadError = state.message || '宠物看护数据加载失败'
          }
        }
        this.runtime = this.demo ? createDemoRuntime(handlers) : createPetRuntime(handlers)
        const context = await this.runtime.start()
        this.fields = context?.fields || []
        this.online = this.runtime.online
        await this.loadPlatformData()
      } catch (error) {
        this.loadError = error?.message || '宠物看护数据加载失败'
      } finally {
        this.loading = false
      }
    },
    async loadPlatformData() {
      const [profile, report, notes, timeline, album] = await Promise.all([
        loadProfile(this.deviceId).catch(() => ({})),
        loadDailyReport(this.deviceId).catch(() => ({})),
        loadStaffNotes(this.deviceId).catch(() => []),
        loadTimeline(this.deviceId).catch(() => []),
        loadAlbum(this.deviceId).catch(() => [])
      ])
      this.profile = profile
      this.report = report
      this.notes = notes
      this.timeline = timeline
      this.album = album
    },
    switchTab(key) {
      this.activeTab = key
      if (key === 'album') {
        clearAlbumBadge()
        this.badge = 0
      }
    },
    goBack() {
      if (this.activeTab !== 'live') this.switchTab('live')
    },
    onSettings() {
      uni.showToast({ title: '设备设置（平台通用页面）', icon: 'none' })
    },
    dismissAlert() {
      // 关闭只隐藏提示，不代表清除设备事件（PRD 4.10）。
      this.alertDismissed = true
    },
    alertText(event) {
      const data = event.data || {}
      if (event.code === 'stream_error') {
        const code = data.error_code === undefined ? 1 : data.error_code
        return `推流异常：${ENUMS.errorCode[code] || ENUMS.unknown}`
      }
      if (event.code === 'sd_card_error') return '设备存储卡异常，不影响观看'
      if (event.code === 'bark_alert') {
        const db = Number(data.volume_db)
        return Number.isFinite(db) ? `${this.petName}在叫（约 ${db} 分贝），店员正在关注` : `${this.petName}在叫，店员正在关注`
      }
      if (event.code === 'env_abnormal') {
        const value = data.value === undefined ? '--' : data.value
        return `舍内温度异常（${value}℃），店员已收到通知`
      }
      if (event.code === 'collar_low_battery') {
        const battery = data.battery === undefined ? '--' : data.battery
        return `项圈电量偏低（${battery}%），请提醒店员充电`
      }
      if (event.code === 'collar_offline') return '项圈已离线，暂时收不到项圈数据'
      if (event.code === 'pet_health_abnormal') {
        const type = ENUMS.healthType[data.type] || ENUMS.unknown
        const unit = data.type === 2 || data.type === 3 ? ' bpm' : '℃'
        const value = data.value === undefined ? '--' : data.value
        return `${this.petName}${type}（${value}${unit}），店员已收到通知`
      }
      return '设备出现异常'
    },
    async onSnapshotSaved() {
      // 相册存储是平台能力（接口待定）：先用本地 mock 记录，保证角标与网格闭环（PRD 4.5）。
      await appendAlbumPhoto({ src: snapshotPlaceholder() })
      this.badge = bumpAlbumBadge()
      this.album = await loadAlbum(this.deviceId)
    },
    async onTreatDone() {
      await appendTimeline({ type: 'treat', text: `你给${this.petName}投喂了一份零食` })
      this.timeline = await loadTimeline(this.deviceId)
    }
  }
}

// 抓拍照片由平台相册提供；接口就绪前用内联占位图避免出现坏图。
function snapshotPlaceholder() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">' +
    '<rect width="120" height="120" fill="#e9edf2"/>' +
    '<rect x="34" y="44" width="52" height="36" rx="8" fill="#8b96a6"/>' +
    '<circle cx="60" cy="62" r="11" fill="#e9edf2"/>' +
    '<rect x="50" y="36" width="20" height="10" rx="3" fill="#8b96a6"/></svg>'
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}
</script>

<style scoped>
.pet-page { display: flex; flex-direction: column; height: 100vh; padding-top: var(--status-bar-height); box-sizing: border-box; background: #f4f6f8; }
.pet-topbar { flex-shrink: 0; position: relative; display: flex; align-items: center; justify-content: space-between; height: 44px; padding: 0 8px; background: #f4f6f8; }
.pet-topbar-title { position: absolute; left: 0; right: 0; text-align: center; font-size: 16px; font-weight: 600; color: #1f2733; }
.pet-topbar-btn { position: relative; z-index: 2; width: 40px; height: 40px; margin: 0; padding: 0; border: 0; border-radius: 20px; background: transparent; color: #1f2733; font-size: 20px; line-height: 40px; text-align: center; }
.pet-topbar-btn::after { border: 0; }
.pet-page-scroll { flex: 1; min-height: 0; }
.pet-demo-badge { padding: 6px 16px; background: #fff4e8; color: #d46b08; font-size: 11px; }
.pet-page-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; color: #8b96a6; font-size: 13px; }
.pet-page-retry { margin-top: 14px; padding: 0 20px; height: 34px; border: 0; border-radius: 17px; background: #ff8a3d; color: #ffffff; font-size: 13px; line-height: 34px; }
.pet-page-pressed { opacity: .7; }
</style>
