<template>
  <view class="pet-more">
    <view v-if="hasWatchGroup" class="pet-more-block">
      <text class="pet-more-title">观看设置</text>
      <view v-if="has('video_quality')" class="pet-more-row" @click="openQuality">
        <text class="pet-more-label">画质</text>
        <text class="pet-more-value" :class="{ 'pet-more-value--muted': !online }">{{ qualityLabel }}</text>
      </view>
      <view v-if="has('mic_switch')" class="pet-more-row">
        <view class="pet-more-row-main">
          <text class="pet-more-label">店内收音</text>
          <text class="pet-more-sub">{{ micOn ? '观看时可听到店里的声音' : '已关闭，仅有画面' }}</text>
        </view>
        <switch :checked="micOn" :disabled="!online || pending === 'mic_switch'" color="#ff8a3d" @change="onMicChange" />
      </view>
      <view v-if="has('speaker_volume')" class="pet-more-row">
        <view class="pet-more-row-main">
          <text class="pet-more-label">对讲音量</text>
          <text class="pet-more-sub">店里扬声器播放你的声音</text>
        </view>
        <view class="pet-more-stepper">
          <button class="pet-more-step" :disabled="!online || !canDecrease || pending === 'speaker_volume'" hover-class="pet-more-pressed" @click="stepVolume(-1)">−</button>
          <text class="pet-more-volume">{{ volumeText }}</text>
          <button class="pet-more-step" :disabled="!online || !canIncrease || pending === 'speaker_volume'" hover-class="pet-more-pressed" @click="stepVolume(1)">＋</button>
        </view>
      </view>
    </view>

    <view v-if="hasPictureGroup" class="pet-more-block">
      <text class="pet-more-title">画面设置</text>
      <view v-if="has('night_vision')" class="pet-more-row" @click="openNight">
        <text class="pet-more-label">夜视模式</text>
        <text class="pet-more-value" :class="{ 'pet-more-value--muted': !online }">{{ nightLabel }}</text>
      </view>
      <view v-if="has('image_flip')" class="pet-more-row">
        <text class="pet-more-label">画面翻转 180°</text>
        <switch :checked="flipOn" :disabled="!online || pending === 'image_flip'" color="#ff8a3d" @change="onFlipChange" />
      </view>
    </view>

    <view v-if="hasDeviceGroup" class="pet-more-block">
      <text class="pet-more-title">设备状态</text>
      <view v-if="has('viewer_count')" class="pet-more-row">
        <text class="pet-more-label">当前观看人数</text>
        <text class="pet-more-value">{{ viewerText }}</text>
      </view>
      <view v-if="has('wifi_rssi')" class="pet-more-row">
        <text class="pet-more-label">Wi-Fi 信号强度</text>
        <text class="pet-more-value">{{ wifi }}</text>
      </view>
      <view v-if="has('sd_status')" class="pet-more-row">
        <text class="pet-more-label">存储卡状态</text>
        <text class="pet-more-value">{{ sdText }}</text>
      </view>
      <view v-if="has('collar_online')" class="pet-more-row">
        <text class="pet-more-label">项圈在线状态</text>
        <text class="pet-more-value">{{ collarOnlineText }}</text>
      </view>
      <view v-if="has('collar_battery')" class="pet-more-row">
        <text class="pet-more-label">项圈电量</text>
        <text class="pet-more-value">{{ collarBatteryText }}</text>
      </view>
    </view>

    <pet-sheet :visible="qualitySheet" title="选择画质" :options="qualityOptions"
      :model-value="qualityValue" @close="qualitySheet = false" @confirm="applyQuality" />
    <pet-sheet :visible="nightSheet" title="夜视模式" :options="nightOptions"
      :model-value="nightValue" @close="nightSheet = false" @confirm="applyNight" />
  </view>
</template>

<script>
import PetSheet from './pet-sheet.vue'
import { enumText, numberText, wifiText } from '../utils/pet-format.js'

const WRITE_TIMEOUT = 5000

// 更多页：观看设置 / 画面设置 / 设备状态；提交态禁用、超时回退到设备原值（PRD 4.8、4.9、4.12、5.3）。
export default {
  name: 'PetMoreTab',
  components: { PetSheet },
  props: {
    runtime: { type: Object, required: true },
    values: { type: Object, default: () => ({}) },
    online: { type: Boolean, default: null },
    capabilities: { type: Object, required: true }
  },
  data() {
    return { pending: '', qualitySheet: false, nightSheet: false }
  },
  computed: {
    watchGroup() { return this.capabilities.groups?.watch || [] },
    pictureGroup() { return this.capabilities.groups?.picture || [] },
    deviceGroup() { return this.capabilities.groups?.device || [] },
    hasWatchGroup() { return this.watchGroup.length > 0 },
    hasPictureGroup() { return this.pictureGroup.length > 0 },
    hasDeviceGroup() { return this.deviceGroup.length > 0 },
    qualityValue() { return this.num(this.values.video_quality) },
    nightValue() { return this.num(this.values.night_vision) },
    qualityOptions() { return this.options('videoQuality', 'video_quality') },
    nightOptions() { return this.options('nightVision', 'night_vision') },
    qualityLabel() { return enumText('videoQuality', this.qualityValue) },
    nightLabel() { return enumText('nightVision', this.nightValue) },
    micOn() { return this.values.mic_switch === 1 || this.values.mic_switch === true },
    flipOn() { return this.num(this.values.image_flip) === 1 },
    volume() { return this.num(this.values.speaker_volume) },
    volumeText() { return this.volume === null ? '--' : `${numberText(this.volume, 0)}%` },
    canDecrease() { return this.volume !== null && this.volume > 0 },
    canIncrease() { return this.volume !== null && this.volume < 100 },
    viewerText() {
      const value = this.num(this.values.viewer_count)
      return value === null ? '--' : `${numberText(value, 0)} 人`
    },
    wifi() { return wifiText(this.values.wifi_rssi) },
    sdText() { return enumText('sdStatus', this.num(this.values.sd_status)) },
    collarBatteryText() {
      const value = this.num(this.values.collar_battery)
      return value === null ? '--' : `${numberText(value, 0)}%`
    },
    collarOnlineText() {
      const value = this.num(this.values.collar_online)
      return value === null ? '--' : value === 1 ? '在线' : '离线'
    }
  },
  methods: {
    has(code) { return this.capabilities.hasProperty(code) },
    num(value) {
      if (value === undefined || value === null || value === '') return null
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    },
    options(enumKey, code) {
      return this.capabilities.enumValues(code).map(value => ({ value, label: enumText(enumKey, value) }))
    },
    openQuality() {
      if (!this.online) return toast('设备离线，无法操作')
      if (this.qualityOptions.length <= 1) { toast(this.qualityLabel); return }
      this.qualitySheet = true
    },
    openNight() {
      if (!this.online) return toast('设备离线，无法操作')
      this.nightSheet = true
    },
    applyQuality(value) {
      this.qualitySheet = false
      this.submit('video_quality', value)
    },
    applyNight(value) {
      this.nightSheet = false
      this.submit('night_vision', value)
    },
    onMicChange(event) {
      const next = event.detail.value ? 1 : 0
      this.submit('mic_switch', next)
    },
    onFlipChange(event) {
      const next = event.detail.value ? 1 : 0
      this.submit('image_flip', next)
    },
    stepVolume(direction) {
      if (this.volume === null) return
      const next = Math.min(100, Math.max(0, this.volume + direction * 10))
      if (next === this.volume) return
      this.submit('speaker_volume', next)
    },
    async submit(code, value) {
      if (this.pending || !this.online) return
      this.pending = code
      try {
        await Promise.race([
          this.runtime.writeProperty(code, value),
          new Promise((resolve, reject) => setTimeout(() => reject(new Error('设置超时')), WRITE_TIMEOUT))
        ])
      } catch (error) {
        // 展示值始终来自设备回报，失败即自然回到设备当前值（PRD 4.8）。
        toast('设置失败，已恢复设备当前值')
      } finally {
        this.pending = ''
      }
    }
  }
}

function toast(title) {
  if (title) uni.showToast({ title, icon: 'none' })
}
</script>

<style scoped>
.pet-more { padding: 14px 16px 20px; }
.pet-more-block { margin-bottom: 14px; padding: 4px 14px; border-radius: 16px; background: #ffffff; }
.pet-more-title { display: block; padding: 12px 0 6px; color: #8b96a6; font-size: 11px; }
.pet-more-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-top: 1px solid #f5f6f8; }
.pet-more-row-main { flex: 1; min-width: 0; }
.pet-more-label { color: #1f2733; font-size: 14px; }
.pet-more-sub { display: block; margin-top: 2px; color: #8b96a6; font-size: 11px; }
.pet-more-value { color: #1f2733; font-size: 14px; }
.pet-more-value--muted { color: #c9cfd8; }
.pet-more-stepper { display: flex; align-items: center; }
.pet-more-step { margin: 0 8px; width: 32px; height: 32px; padding: 0; border: 1px solid #e6e8eb; border-radius: 16px; background: #ffffff; color: #1f2733; font-size: 16px; line-height: 30px; }
.pet-more-step::after { border: 0; }
.pet-more-step[disabled] { color: #c9cfd8; }
.pet-more-volume { min-width: 52px; color: #1f2733; font-size: 14px; text-align: center; }
.pet-more-pressed { opacity: .6; }
</style>
