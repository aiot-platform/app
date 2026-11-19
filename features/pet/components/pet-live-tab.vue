<template>
  <view class="pet-live">
    <pet-alert-bar v-if="alert" :alert="alert" :count-text="alert.count > 1 ? `（共 ${alert.count} 条）` : ''" @dismiss="$emit('dismiss-alert')" />

    <view class="pet-profile">
      <image v-if="profile?.pet?.avatar" class="pet-profile-avatar" :src="profile.pet.avatar" mode="aspectFill" />
      <view v-else class="pet-profile-avatar pet-profile-avatar--fallback"><text>{{ petInitial }}</text></view>
      <view class="pet-profile-main">
        <view class="pet-profile-line">
          <text class="pet-profile-name">{{ title }}</text>
          <text class="pet-profile-status" :class="{ 'pet-profile-status--offline': !isOnline }">{{ isOnline ? '在线' : '离线' }}</text>
        </view>
        <text v-if="subtitle" class="pet-profile-sub">{{ subtitle }}</text>
      </view>
    </view>

    <pet-player :container-id="containerId" :status="status" :cover="cover" :started-at="startedAt"
      :viewer-text="viewerText" :wifi-text="wifiText" :activity-text="bubbleText" :webview-url="webviewUrl"
      :muted="muted" :talking="talking" :fullscreen="fullscreen" :demo="demo" :show-intercom="capabilities.hasProperty('mic_switch')"
      :mic-show="capabilities.hasProperty('mic_switch')" :mic-on="micOn" :quality="qualityDisplay"
      @start="startLive" @retry="startLive" @stop="stopLive" @toggle-mute="toggleMute" @toggle-talk="toggleTalk"
      @open-quality="openQuality" @fullscreen="fullscreen = !fullscreen" />

    <!-- 项圈：Wi-Fi 近场报给边缘网关，随网关统一送云 -->
    <view v-if="showCollar" class="pet-collar">
      <view class="pet-collar-head">
        <text class="pet-collar-title">{{ title }}的项圈</text>
        <text v-if="capabilities.hasProperty('collar_online')" class="pet-collar-status" :class="{ 'pet-collar-status--off': !collarOnline }">{{ collarOnline ? '在线' : '离线' }}</text>
      </view>
      <view class="pet-collar-grid">
        <view v-if="capabilities.hasProperty('pet_body_temperature')" class="pet-collar-item">
          <text class="pet-collar-label">体温</text>
          <text class="pet-collar-value">{{ collarTemp }}</text>
        </view>
        <view v-if="capabilities.hasProperty('pet_heart_rate')" class="pet-collar-item">
          <text class="pet-collar-label">心率</text>
          <text class="pet-collar-value">{{ collarHeart }}</text>
        </view>
        <view v-if="capabilities.hasProperty('collar_battery')" class="pet-collar-item">
          <text class="pet-collar-label">电量</text>
          <text class="pet-collar-value">{{ collarBattery }}</text>
        </view>
      </view>
    </view>

    <view v-if="showStatusCard" class="pet-card">
      <view v-if="capabilities.hasProperty('pet_activity')" class="pet-card-activity">
        <text class="pet-card-icon">{{ activityIcon }}</text>
        <view class="pet-card-activity-text">
          <text class="pet-card-title">{{ activityText }}</text>
          <text v-if="!isOnline" class="pet-card-note">设备离线，显示最后一次状态</text>
        </view>
      </view>
      <view v-if="capabilities.hasProperty('activity_level')" class="pet-card-ring">
        <image class="pet-card-ring-image" :src="ringImage" mode="aspectFit" />
        <text class="pet-card-ring-value">{{ activityText2 }}</text>
      </view>
    </view>

    <view v-if="showEnvRow" class="pet-env">
      <view v-if="capabilities.hasProperty('env_temperature')" class="pet-env-item">
        <text class="pet-env-label">舍内温度</text>
        <text class="pet-env-value">{{ temperatureText }}</text>
        <text v-if="temperatureTag" class="pet-env-tag">{{ temperatureTag }}</text>
      </view>
      <view v-if="capabilities.hasProperty('env_humidity')" class="pet-env-item">
        <text class="pet-env-label">舍内湿度</text>
        <text class="pet-env-value">{{ humidityText }}</text>
      </view>
    </view>

    <view v-if="showQuickActions" class="pet-quick">
      <button v-if="capabilities.hasService('snapshot')" class="pet-quick-item" :disabled="status !== 'live' || !isOnline"
        hover-class="pet-quick-pressed" @click="takeSnapshot">
        <text class="pet-quick-title">抓拍</text>
      </button>
      <button v-if="capabilities.hasService('dispense_treat')" class="pet-quick-item" :disabled="!isOnline || treating || treatExhausted"
        hover-class="pet-quick-pressed" @click="dispenseTreat">
        <text class="pet-quick-title">{{ treating ? '投喂中…' : '投喂零食' }}</text>
        <text v-if="treatHint" class="pet-quick-sub">{{ treatHint }}</text>
      </button>
      <button class="pet-quick-item" :disabled="status !== 'live' || !isOnline"
        hover-class="pet-quick-pressed" @click="toggleTalk">
        <text class="pet-quick-title">{{ talking ? '结束对讲' : '和它说话' }}</text>
      </button>
    </view>

    <pet-sheet :visible="qualitySheet" title="选择画质" :options="qualityOptions"
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
import { enumText, numberText, ringSource, temperatureTag, wifiText } from '../utils/pet-format.js'

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
      errorText: '',
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
    title() { return this.profile?.pet?.name || '宠物' },
    petInitial() { return String(this.title).slice(0, 1) },
    subtitle() {
      const parts = []
      const pet = this.profile?.pet
      if (pet?.breed || pet?.age) parts.push([pet.breed, pet.age].filter(Boolean).join(' · '))
      const shop = this.profile?.shop
      if (shop?.name) parts.push(shop.name)
      if (pet?.boardingDays) parts.push(`寄养第 ${pet.boardingDays} 天`)
      return parts.join(' · ')
    },
    cover() {
      const pet = this.title
      if (!this.isOnline) return { text: `设备离线，暂时看不到${pet}`, hint: '', action: '实时流', disabled: true }
      if (!this.shopOpen) return { text: '店铺休息时段，暂不开放实时画面', hint: this.restHint, action: '实时流', disabled: true }
      if (this.status === 'connecting') return { text: `正在连接${this.profile?.shop?.name || ''}的摄像头…`, hint: '', action: '实时流', disabled: true }
      if (this.errorText) return { text: this.errorText, hint: '', action: '重试', disabled: false, retry: true }
      if (this.avStatus === 3) return { text: '设备推流异常，暂时无法播放', hint: '', action: '重试', disabled: false, retry: true }
      if (this.avStatus === 1 || this.avStatus === 2) return { text: '摄像头正在推流，点击观看', hint: '', action: '实时流', disabled: false }
      return { text: `看看${pet}在店里的样子`, hint: '', action: '实时流', disabled: false }
    },
    restHint() {
      const shop = this.profile?.shop
      return shop?.openTime && shop?.closeTime ? `开放时间 ${shop.openTime}–${shop.closeTime}` : ''
    },
    viewerText() {
      if (!this.capabilities.hasProperty('viewer_count')) return ''
      const count = this.number(this.values.viewer_count)
      return count === null ? '--' : `${count} 人在看`
    },
    wifiText() {
      if (!this.capabilities.hasProperty('wifi_rssi')) return ''
      return wifiText(this.values.wifi_rssi)
    },
    micOn() {
      if (!this.capabilities.hasProperty('mic_switch')) return false
      const value = this.values.mic_switch
      return value === 1 || value === true
    },
    activityText() {
      if (!this.capabilities.hasProperty('pet_activity')) return ''
      return enumText('petActivity', this.petActivity)
    },
    bubbleText() {
      if (!this.capabilities.hasProperty('pet_activity') || this.avStatus === 0) return ''
      const activity = enumText('petActivity', this.petActivity)
      // 未检测到宠物时直接给结论，不套「宠物名 + 状态」的句式（PRD 4.3）。
      return this.petActivity === 0 ? activity : `${this.title}${activity}`
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
    showCollar() {
      return this.capabilities.hasProperty('pet_body_temperature') || this.capabilities.hasProperty('pet_heart_rate') ||
        this.capabilities.hasProperty('collar_battery') || this.capabilities.hasProperty('collar_online')
    },
    collarOnline() { return this.number(this.values.collar_online) === 1 },
    collarTemp() {
      const value = this.number(this.values.pet_body_temperature)
      return value === null ? '--' : `${numberText(value, 1)}℃`
    },
    collarHeart() {
      const value = this.number(this.values.pet_heart_rate)
      return value === null ? '--' : `${numberText(value, 0)} bpm`
    },
    collarBattery() {
      const value = this.number(this.values.collar_battery)
      return value === null ? '--' : `${numberText(value, 0)}%`
    },
    temperatureText() {
      const value = this.number(this.values.env_temperature)
      return value === null ? '--' : `${numberText(value, 1)}℃`
    },
    humidityText() {
      const value = this.number(this.values.env_humidity)
      return value === null ? '--' : `${numberText(value, 0)}%`
    },
    temperatureTag() { return temperatureTag(this.values.env_temperature, this.comfortRange) },
    treatLeft() { return this.number(this.values.treat_left) },
    treatExhausted() { return this.treatLeft !== null && this.treatLeft <= 0 },
    treatHint() {
      if (this.treatLeft === null) return ''
      return this.treatLeft <= 0 ? '今日已投完' : `今日还可 ${this.treatLeft} 次`
    },
    qualityValue() { return this.number(this.values.video_quality) },
    qualityOptions() {
      return this.capabilities.enumValues('video_quality').map(value => ({ value, label: enumText('videoQuality', value) }))
    },
    qualityDisplay() {
      if (!this.capabilities.hasProperty('video_quality')) return { openable: false, label: '' }
      // 仅剩一项时不弹层，只提示当前支持项（PRD 4.8 / 验收）。
      return { openable: this.qualityOptions.length > 1, label: enumText('videoQuality', this.qualityValue) }
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
      this.errorText = ''
      this.status = 'connecting'
      try {
        const session = this.ensureSession()
        if (!session.supported) throw new Error('当前运行环境不支持实时音视频')
        const result = await this.callWithTimeout(
          this.runtime.callService('start_live', { quality: this.qualityValue || 3 }), this.runtime.timeout.service
        )
        if (result === 1) throw this.fail('设备忙，请稍后重试')
        if (result === 2) throw this.fail('观看人数已满（上限 4 人）')
        if (result === 3) throw this.fail('摄像头无信号')
        // 以设备回报为准：av_status 进入推流中/对讲中才展示画面（PRD 4.1）。
        await this.runtime.waitForValue('av_status', value => Number(value) === 1 || Number(value) === 2, this.runtime.timeout.service)
        if (this.demo) await session.join()
        else await session.join(await fetchRtcAuth(this.deviceId))
        this.startedAt = Date.now()
        this.status = 'live'
      } catch (error) {
        this.status = 'idle'
        this.errorText = error?.message || (error?.code === 'TIMEOUT' ? '连接超时，请检查网络后重试' : '实时流连接失败，请重试')
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
    fail(message) {
      const error = new Error(message)
      error.messageKey = message
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
        toast('设置失败，已恢复设备当前值')
        return
      }
      // 旧回包不覆盖新操作：只在设备回报与本次提交不一致时由 runtime 的 values 自然纠正。
      if (previous !== value) toast('已提交，等待设备回报')
    },
    async takeSnapshot() {
      if (this.status !== 'live' || !this.isOnline) {
        toast('先点实时流，再抓拍哦')
        return
      }
      try {
        const result = await this.callWithTimeout(this.runtime.callService('snapshot', {}), this.runtime.timeout.service)
        if (result === 1) { toast('先点实时流，再抓拍哦'); return }
        if (result === 2) { toast('抓拍失败，请稍后重试'); return }
        toast('已抓拍，保存到相册')
        this.$emit('snapshot-saved')
      } catch (error) {
        toast('抓拍失败，请稍后重试')
      }
    },
    async dispenseTreat() {
      if (this.treating || !this.isOnline) return
      this.treating = true
      try {
        const result = await this.callWithTimeout(this.runtime.callService('dispense_treat', {}), this.runtime.timeout.service)
        if (result === 1) toast('今日零食已投喂完')
        else if (result === 2 || result === 3) toast('设备忙，请稍后再试')
        else {
          toast(`${this.title}收到零食啦～`)
          this.$emit('treat-done')
        }
      } catch (error) {
        toast('投喂失败，请稍后再试')
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
.pet-collar { margin: 10px 16px 0; padding: 12px 14px; border-radius: 16px; background: #ffffff; }
.pet-collar-head { display: flex; align-items: center; justify-content: space-between; }
.pet-collar-title { color: #1f2733; font-size: 13px; font-weight: 600; }
.pet-collar-status { padding: 1px 8px; border-radius: 9px; background: #eef6ff; color: #1677ff; font-size: 11px; line-height: 18px; }
.pet-collar-status--off { background: #f2f3f5; color: #8b96a6; }
.pet-collar-grid { display: flex; margin-top: 10px; }
.pet-collar-item { flex: 1; display: flex; flex-direction: column; }
.pet-collar-label { color: #8b96a6; font-size: 11px; }
.pet-collar-value { margin-top: 4px; color: #1f2733; font-size: 16px; font-weight: 600; }
.pet-quick { display: flex; margin: 12px 16px 0; }
.pet-quick-item { flex: 1; margin: 0 10px 0 0; padding: 10px 8px; border: 0; border-radius: 14px; background: #ffffff; display: flex; flex-direction: column; align-items: center; }
.pet-quick-item::after { border: 0; }
.pet-quick-item[disabled] { opacity: .5; }
.pet-quick-title { color: #1f2733; font-size: 13px; }
.pet-quick-sub { margin-top: 2px; color: #8b96a6; font-size: 10px; }
.pet-quick-pressed { opacity: .7; }
</style>
