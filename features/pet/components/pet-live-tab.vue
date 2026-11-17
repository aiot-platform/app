<template>
  <view class="pet-live">
    <pet-alert-bar v-if="alert" :alert="alert" :count-text="$t('pages.pet.alert.count', { count: alert.count })" @dismiss="$emit('dismiss-alert')" />

    <view class="pet-profile">
      <image v-if="profile?.pet?.avatar" class="pet-profile-avatar" :src="profile.pet.avatar" mode="aspectFill" />
      <view v-else class="pet-profile-avatar pet-profile-avatar--fallback"><text>{{ petInitial }}</text></view>
      <view class="pet-profile-main">
        <view class="pet-profile-line">
          <text class="pet-profile-name">{{ title }}</text>
          <text class="pet-profile-status" :class="{ 'pet-profile-status--offline': !isOnline }">{{ isOnline ? $t('pages.pet.profile.online') : $t('pages.pet.profile.offline') }}</text>
        </view>
        <text v-if="subtitle" class="pet-profile-sub">{{ subtitle }}</text>
      </view>
    </view>

    <pet-player :container-id="containerId" :status="status" :cover="cover" :started-at="startedAt"
      :viewer-text="viewerText" :wifi-text="wifiText" :activity-text="bubbleText" :webview-url="webviewUrl"
      :muted="muted" :talking="talking" :fullscreen="fullscreen" :demo="demo" :show-intercom="capabilities.hasProperty('mic_switch')"
      :show-snapshot="capabilities.hasService('snapshot')" :quality="qualityDisplay"
      @start="startLive" @retry="startLive" @stop="stopLive" @toggle-mute="toggleMute" @toggle-talk="toggleTalk"
      @open-quality="openQuality" @snapshot="takeSnapshot" @fullscreen="fullscreen = !fullscreen" />

    <view v-if="showStatusCard" class="pet-card">
      <view v-if="capabilities.hasProperty('pet_activity')" class="pet-card-activity">
        <text class="pet-card-icon">{{ activityIcon }}</text>
        <view class="pet-card-activity-text">
          <text class="pet-card-title">{{ activityText }}</text>
          <text v-if="!isOnline" class="pet-card-note">{{ $t('pages.pet.status.offlineNote') }}</text>
        </view>
      </view>
      <view v-if="capabilities.hasProperty('activity_level')" class="pet-card-ring">
        <image class="pet-card-ring-image" :src="ringImage" mode="aspectFit" />
        <text class="pet-card-ring-value">{{ activityText2 }}</text>
      </view>
    </view>

    <view v-if="showEnvRow" class="pet-env">
      <view v-if="capabilities.hasProperty('env_temperature')" class="pet-env-item">
        <text class="pet-env-label">{{ $t('pages.pet.props.envTemperature') }}</text>
        <text class="pet-env-value">{{ temperatureText }}</text>
        <text v-if="temperatureTag" class="pet-env-tag">{{ $t(temperatureTag) }}</text>
      </view>
      <view v-if="capabilities.hasProperty('env_humidity')" class="pet-env-item">
        <text class="pet-env-label">{{ $t('pages.pet.props.envHumidity') }}</text>
        <text class="pet-env-value">{{ humidityText }}</text>
      </view>
    </view>

    <view v-if="showQuickActions" class="pet-quick">
      <button v-if="capabilities.hasService('snapshot')" class="pet-quick-item" :disabled="status !== 'live' || !isOnline"
        hover-class="pet-quick-pressed" @click="takeSnapshot">
        <text class="pet-quick-title">{{ $t('pages.pet.quick.snapshot') }}</text>
        <text class="pet-quick-sub">{{ $t('pages.pet.quick.snapshotHint') }}</text>
      </button>
      <button v-if="capabilities.hasService('dispense_treat')" class="pet-quick-item" :disabled="!isOnline || treating || treatExhausted"
        hover-class="pet-quick-pressed" @click="dispenseTreat">
        <text class="pet-quick-title">{{ treating ? $t('pages.pet.quick.treating') : $t('pages.pet.quick.treat') }}</text>
        <text v-if="treatHint" class="pet-quick-sub">{{ treatHint }}</text>
      </button>
      <button class="pet-quick-item" :disabled="status !== 'live' || !isOnline"
        hover-class="pet-quick-pressed" @click="toggleTalk">
        <text class="pet-quick-title">{{ $t('pages.pet.quick.talk') }}</text>
        <text class="pet-quick-sub">{{ talking ? $t('pages.pet.quick.talking') : $t('pages.pet.quick.talkHint') }}</text>
      </button>
    </view>

    <pet-sheet :visible="qualitySheet" :title="$t('pages.pet.props.videoQuality')" :options="qualityOptions"
      :model-value="qualityValue" @close="qualitySheet = false" @confirm="applyQuality" />
  </view>
</template>

<script>
import PetAlertBar from './pet-alert-bar.vue'
import PetPlayer from './pet-player.vue'
import PetSheet from './pet-sheet.vue'
import { createRtcSession, buildEmbedUrl } from '../services/rtc/index.js'
import { fetchRtcAuth } from '../services/rtc/token.js'
import { createDemoRtcSession } from '../services/pet-demo.js'
import { COMFORT_RANGE } from '../model/tsl.js'
import { enumText, numberText, ringSource, temperatureTagKey, wifiLevel } from '../utils/pet-format.js'

const ACTIVITY_ICONS = { 0: '🔍', 1: '🛋️', 2: '😴', 3: '🎾', 4: '🍚', 5: '💧' }

export default {
  name: 'PetLiveTab',
  components: { PetAlertBar, PetPlayer, PetSheet },
  props: {
    deviceId: { type: String, required: true },
    runtime: { type: Object, required: true },
    values: { type: Object, default: () => ({}) },
    online: { type: Boolean, default: null },
    capabilities: { type: Object, required: true },
    profile: { type: Object, default: () => ({}) },
    shopOpen: { type: Boolean, default: true },
    alert: { type: Object, default: null },
    // 演示模式：不接真实设备与真实 RTC，用于 H5 预览。
    demo: { type: Boolean, default: false }
  },
  emits: ['dismiss-alert', 'snapshot-saved', 'treat-done'],
  data() {
    return {
      containerId: `pet-player-${Math.random().toString(36).slice(2, 9)}`,
      status: 'idle',
      errorKey: '',
      muted: false,
      talking: false,
      treating: false,
      fullscreen: false,
      startedAt: 0,
      qualitySheet: false,
      session: null,
      webviewUrl: '',
      comfortRange: COMFORT_RANGE
    }
  },
  computed: {
    avStatus() { return this.number(this.values.av_status) },
    petActivity() { return this.number(this.values.pet_activity) },
    activityLevel() { return this.number(this.values.activity_level) },
    isOnline() { return this.online === true },
    title() { return this.profile?.pet?.name || this.$t('pages.pet.profile.fallbackName') },
    petInitial() { return String(this.title).slice(0, 1) },
    subtitle() {
      const parts = []
      const pet = this.profile?.pet
      if (pet?.breed || pet?.age) parts.push([pet.breed, pet.age].filter(Boolean).join(' · '))
      const shop = this.profile?.shop
      if (shop?.name) parts.push(shop.name)
      if (pet?.boardingDays) parts.push(this.$t('pages.pet.profile.boarding', { days: pet.boardingDays }))
      return parts.join(' · ')
    },
    cover() {
      const pet = this.title
      if (!this.isOnline) return { text: this.$t('pages.pet.live.offline', { pet }), hint: '', action: this.$t('pages.pet.live.start'), disabled: true }
      if (!this.shopOpen) return { text: this.$t('pages.pet.live.resting'), hint: this.restHint, action: this.$t('pages.pet.live.start'), disabled: true }
      if (this.status === 'connecting') return { text: this.$t('pages.pet.live.connecting', { shop: this.profile?.shop?.name || '' }), hint: '', action: this.$t('pages.pet.live.start'), disabled: true }
      if (this.errorKey) return { text: this.$t(this.errorKey), hint: '', action: this.$t('pages.pet.live.retry'), disabled: false, retry: true }
      if (this.avStatus === 3) return { text: this.$t('pages.pet.live.abnormal'), hint: '', action: this.$t('pages.pet.live.retry'), disabled: false, retry: true }
      if (this.avStatus === 1 || this.avStatus === 2) return { text: this.$t('pages.pet.live.streaming', { pet }), hint: '', action: this.$t('pages.pet.live.watch'), disabled: false }
      return { text: this.$t('pages.pet.live.cover', { pet }), hint: '', action: this.$t('pages.pet.live.start'), disabled: false }
    },
    restHint() {
      const shop = this.profile?.shop
      return shop?.openTime && shop?.closeTime ? this.$t('pages.pet.live.restHint', { open: shop.openTime, close: shop.closeTime }) : ''
    },
    viewerText() {
      if (!this.capabilities.hasProperty('viewer_count')) return ''
      const count = this.number(this.values.viewer_count)
      return count === null ? this.$t('pages.pet.player.viewersEmpty') : this.$t('pages.pet.player.viewers', { count })
    },
    wifiText() {
      if (!this.capabilities.hasProperty('wifi_rssi')) return ''
      const level = wifiLevel(this.values.wifi_rssi)
      return level ? this.$t(`pages.pet.player.wifi.${level}`) : this.$t('pages.pet.player.wifiEmpty')
    },
    activityText() {
      if (!this.capabilities.hasProperty('pet_activity')) return ''
      const activity = enumText(this.$t.bind(this), 'petActivity', this.petActivity)
      // 未检测到宠物时直接给结论，不套「正在…」的句式（PRD 4.3）。
      if (this.petActivity === 0) return activity
      return this.$t('pages.pet.status.activity', { activity })
    },
    bubbleText() {
      if (!this.capabilities.hasProperty('pet_activity') || this.avStatus === 0) return ''
      return enumText(this.$t.bind(this), 'petActivity', this.petActivity)
    },
    activityIcon() {
      return ACTIVITY_ICONS[this.petActivity] || '❔'
    },
    activityText2() {
      const value = this.activityLevel
      return value === null ? '--' : `${value}%`
    },
    ringImage() { return ringSource(this.activityLevel === null ? 0 : this.activityLevel) },
    showStatusCard() {
      const hasActivity = this.capabilities.hasProperty('pet_activity') || this.capabilities.hasProperty('activity_level')
      const hasEnv = this.capabilities.hasProperty('env_temperature') || this.capabilities.hasProperty('env_humidity')
      return hasActivity || hasEnv
    },
    showEnvRow() {
      return this.capabilities.hasProperty('env_temperature') || this.capabilities.hasProperty('env_humidity')
    },
    temperatureText() {
      const value = this.number(this.values.env_temperature)
      return value === null ? '--' : `${numberText(value, 1)}${this.$t('pages.pet.env.temperatureUnit')}`
    },
    humidityText() {
      const value = this.number(this.values.env_humidity)
      return value === null ? '--' : `${numberText(value, 0)}${this.$t('pages.pet.env.humidityUnit')}`
    },
    temperatureTag() { return temperatureTagKey(this.values.env_temperature, this.comfortRange) },
    treatLeft() { return this.number(this.values.treat_left) },
    treatExhausted() { return this.treatLeft !== null && this.treatLeft <= 0 },
    treatHint() {
      if (this.treatLeft === null) return ''
      return this.treatLeft <= 0 ? this.$t('pages.pet.quick.treatEmpty') : this.$t('pages.pet.quick.treatLeft', { count: this.treatLeft })
    },
    qualityValue() { return this.number(this.values.video_quality) },
    qualityOptions() {
      return this.capabilities.enumValues('video_quality').map(value => ({ value, label: enumText(this.$t.bind(this), 'videoQuality', value) }))
    },
    qualityDisplay() {
      if (!this.capabilities.hasProperty('video_quality')) return { openable: false, label: '' }
      const label = enumText(this.$t.bind(this), 'videoQuality', this.qualityValue)
      // 仅剩一项时不弹层，只提示当前支持项（PRD 4.8 / 验收）。
      return { openable: this.qualityOptions.length > 1, label }
    },
    showQuickActions() {
      return this.capabilities.hasService('snapshot') || this.capabilities.hasService('dispense_treat') ||
        this.capabilities.hasProperty('mic_switch') || this.capabilities.hasService('start_live')
    }
  },
  watch: {
    avStatus(value) {
      // 播放中设备侧状态变化立即停止，不保留最后一帧（PRD 4.1）。
      if (this.status === 'live' && value !== 1 && value !== 2) this.stopLive()
    },
    isOnline(value) {
      if (value === false && this.status !== 'idle') this.stopLive()
    },
    shopOpen(value) {
      if (value === false && this.status !== 'idle') this.stopLive()
    }
  },
  beforeUnmount() {
    this.releaseSession()
  },
  methods: {
    number(value) {
      if (value === undefined || value === null || value === '') return null
      const num = Number(value)
      return Number.isFinite(num) ? num : null
    },
    noop() {},
    ensureSession() {
      if (!this.session) {
        if (this.demo) {
          this.session = createDemoRtcSession({ onState: state => { if (state?.status === 'ended' && this.status === 'live') this.stopLive() } })
          return this.session
        }
        this.session = createRtcSession({
          deviceId: this.deviceId,
          containerId: this.containerId,
          token: uni.getStorageSync('access_token'),
          onState: state => { if (state?.status === 'ended' && this.status === 'live') this.stopLive() }
        })
        if (this.session.needsWebview) {
          this.webviewUrl = buildEmbedUrl({ deviceId: this.deviceId, token: uni.getStorageSync('access_token') })
        }
      }
      return this.session
    },
    async startLive() {
      if (!this.isOnline || !this.shopOpen || this.status === 'connecting') return
      this.errorKey = ''
      this.status = 'connecting'
      try {
        const session = this.ensureSession()
        if (!session.supported) throw new Error('当前运行环境不支持实时音视频')
        const result = await this.callWithTimeout(
          this.runtime.callService('start_live', { quality: this.qualityValue || 3 }), this.runtime.timeout.service
        )
        if (result === 1) throw this.fail('pages.pet.live.errDeviceBusy')
        if (result === 2) throw this.fail('pages.pet.live.errViewerFull')
        if (result === 3) throw this.fail('pages.pet.live.errNoSignal')
        // 以设备回报为准：av_status 进入推流中/对讲中才展示画面（PRD 4.1）。
        await this.runtime.waitForValue('av_status', value => Number(value) === 1 || Number(value) === 2, this.runtime.timeout.service)
        if (this.demo) await session.join()
        else await session.join(await fetchRtcAuth(this.deviceId))
        this.startedAt = Date.now()
        this.status = 'live'
      } catch (error) {
        this.status = 'idle'
        this.errorKey = error?.messageKey || (error?.code === 'TIMEOUT' ? 'pages.pet.live.errTimeout' : 'pages.pet.live.errRtc')
      }
    },
    async stopLive() {
      const wasLive = this.status === 'live'
      this.status = 'idle'
      this.startedAt = 0
      this.talking = false
      await this.releaseSession().catch(() => {})
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
      this.webviewUrl = ''
      if (session) await session.leave()
    },
    fail(messageKey) {
      const error = new Error(messageKey)
      error.messageKey = messageKey
      return error
    },
    callWithTimeout(promise, timeout) {
      return Promise.race([
        promise,
        new Promise((resolve, reject) => setTimeout(() => {
          const error = new Error('调用超时')
          error.code = 'TIMEOUT'
          reject(error)
        }, timeout))
      ])
    },
    toggleMute() {
      this.muted = !this.muted
      this.session?.setMuted(this.muted)
    },
    async toggleTalk() {
      if (this.status !== 'live' || !this.isOnline) return
      const next = !this.talking
      try {
        if (next) await this.session?.startTalk()
        else await this.session?.stopTalk()
        this.talking = next
      } catch (error) {
        this.fail()
        console.warn('[pet] 对讲切换失败', error)
      }
    },
    openQuality() {
      if (!this.qualityDisplay.openable) return
      this.qualitySheet = true
    },
    async applyQuality(value) {
      this.qualitySheet = false
      const previous = this.qualityValue
      try {
        await this.callWithTimeout(this.runtime.writeProperty('video_quality', value), this.runtime.timeout.write)
      } catch (error) {
        toast(this.$t('pages.pet.setting.failed'))
        return
      }
      // 旧回包不覆盖新操作：只在设备回报与本次提交不一致时由 runtime 的 values 自然纠正。
      if (previous !== value) toast(this.$t('pages.pet.setting.submitted'))
    },
    async takeSnapshot() {
      if (this.status !== 'live' || !this.isOnline) {
        toast(this.$t('pages.pet.quick.snapshotNeedLive'))
        return
      }
      try {
        const result = await this.callWithTimeout(this.runtime.callService('snapshot', {}), this.runtime.timeout.service)
        if (result === 1) { toast(this.$t('pages.pet.quick.snapshotNeedLive')); return }
        if (result === 2) { toast(this.$t('pages.pet.quick.snapshotFailed')); return }
        toast(this.$t('pages.pet.quick.snapshotSaved'))
        this.$emit('snapshot-saved')
      } catch (error) {
        toast(this.$t('pages.pet.quick.snapshotFailed'))
      }
    },
    async dispenseTreat() {
      if (this.treating || !this.isOnline) return
      this.treating = true
      try {
        const result = await this.callWithTimeout(this.runtime.callService('dispense_treat', {}), this.runtime.timeout.service)
        if (result === 1) toast(this.$t('pages.pet.quick.treatEmpty'))
        else if (result === 2) toast(this.$t('pages.pet.deviceBusy'))
        else if (result === 3) toast(this.$t('pages.pet.quick.treatNoStock'))
        else {
          toast(this.$t('pages.pet.quick.treatDone', { pet: this.title }))
          this.$emit('treat-done')
        }
      } catch (error) {
        toast(this.$t('pages.pet.setting.failed'))
      } finally {
        this.treating = false
      }
    }
  }
}

function toast(title) {
  if (title) uni.showToast({ title, icon: 'none' })
}
</script>

<style scoped>
.pet-live { padding-bottom: 16px; }
.pet-profile { display: flex; align-items: center; padding: 14px 16px 0; }
.pet-profile-avatar { width: 52px; height: 52px; border-radius: 26px; background: #ffe6d2; }
.pet-profile-avatar--fallback { display: flex; align-items: center; justify-content: center; color: #ff8a3d; font-size: 20px; font-weight: 600; }
.pet-profile-main { flex: 1; min-width: 0; margin-left: 12px; }
.pet-profile-line { display: flex; align-items: center; }
.pet-profile-name { font-size: 18px; font-weight: 600; color: #1f2733; }
.pet-profile-status { margin-left: 8px; padding: 1px 8px; border-radius: 9px; background: #eef6ff; color: #1677ff; font-size: 11px; line-height: 18px; }
.pet-profile-status--offline { background: #f2f3f5; color: #8b96a6; }
.pet-profile-sub { display: block; margin-top: 4px; color: #8b96a6; font-size: 12px; }
.pet-card { display: flex; align-items: center; margin: 12px 16px 0; padding: 12px 14px; border-radius: 16px; background: #ffffff; }
.pet-card-activity { flex: 1; display: flex; align-items: center; min-width: 0; }
.pet-card-icon { width: 36px; height: 36px; border-radius: 18px; background: #fff3e8; font-size: 18px; line-height: 36px; text-align: center; }
.pet-card-activity-text { margin-left: 10px; min-width: 0; }
.pet-card-title { display: block; color: #1f2733; font-size: 14px; }
.pet-card-note { display: block; margin-top: 2px; color: #8b96a6; font-size: 11px; }
.pet-card-ring { position: relative; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; }
.pet-card-ring-image { position: absolute; left: 0; top: 0; width: 64px; height: 64px; }
.pet-card-ring-value { position: relative; color: #ff8a3d; font-size: 13px; font-weight: 600; }
.pet-env { display: flex; margin: 10px 16px 0; }
.pet-env-item { flex: 1; margin-right: 10px; padding: 10px 12px; border-radius: 14px; background: #ffffff; }
.pet-env-label { display: block; color: #8b96a6; font-size: 11px; }
.pet-env-value { display: block; margin-top: 4px; color: #1f2733; font-size: 17px; font-weight: 600; }
.pet-env-tag { display: inline-block; margin-top: 4px; padding: 0 6px; border-radius: 8px; background: #f3f8ef; color: #4a8f3c; font-size: 10px; line-height: 16px; }
.pet-quick { display: flex; margin: 12px 16px 0; }
.pet-quick-item { flex: 1; margin: 0 10px 0 0; padding: 10px 8px; border: 0; border-radius: 14px; background: #ffffff; display: flex; flex-direction: column; align-items: center; }
.pet-quick-item::after { border: 0; }
.pet-quick-item[disabled] { opacity: .5; }
.pet-quick-title { color: #1f2733; font-size: 13px; }
.pet-quick-sub { margin-top: 2px; color: #8b96a6; font-size: 10px; }
.pet-quick-pressed { opacity: .7; }
</style>
