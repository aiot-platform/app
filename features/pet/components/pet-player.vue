<template>
  <view class="pet-player">
    <!-- App 端用内嵌 H5 承载同一套 RTC 代码 -->
    <web-view v-if="webviewUrl" class="pet-player-webview" :src="webviewUrl" />
    <view v-else :id="containerId" class="pet-player-stage" :class="{ 'pet-player-stage--idle': status !== 'live', 'pet-player-stage--fullscreen': fullscreen }">
      <view v-if="demo && status === 'live'" class="pet-player-demo"><text class="pet-player-demo-icon">🐕</text></view>
      <view class="pet-player-cover">
        <text class="pet-player-cover-title">{{ cover.text }}</text>
        <text v-if="cover.hint" class="pet-player-cover-hint">{{ cover.hint }}</text>
        <button class="pet-player-cover-button" :disabled="cover.disabled" hover-class="pet-player-pressed" @click="primaryAction">
          {{ cover.action }}
        </button>
      </view>

      <template v-if="status === 'live'">
        <view class="pet-player-top">
          <view class="pet-player-live"><text class="pet-player-dot" />LIVE<text class="pet-player-duration">{{ duration }}</text></view>
          <view class="pet-player-meta">
            <text v-if="viewerText">{{ viewerText }}</text>
            <text v-if="wifiText">Wi-Fi {{ wifiText }}</text>
          </view>
        </view>
        <view v-if="activityText" class="pet-player-bubble"><text>{{ activityText }}</text></view>
        <view class="pet-player-bar">
          <button class="pet-player-action" hover-class="pet-player-pressed" @click="$emit('toggle-mute')">{{ muted ? '取消静音' : '静音' }}</button>
          <view v-if="showLevels" class="pet-player-levels">
            <text v-for="(level, index) in levels" :key="index" class="pet-player-level" :style="{ height: level + 'px' }" />
          </view>
          <text v-else-if="micShow" class="pet-player-note">店内收音已关</text>
          <button v-if="quality.openable" class="pet-player-action" hover-class="pet-player-pressed" @click="$emit('open-quality')">{{ quality.label }}</button>
          <text v-else-if="quality.label" class="pet-player-action pet-player-action--static">{{ quality.label }}</text>
          <button v-if="showIntercom" class="pet-player-action" :class="{ 'pet-player-action--on': talking }" hover-class="pet-player-pressed" @click="$emit('toggle-talk')">对讲</button>
          <button class="pet-player-action" hover-class="pet-player-pressed" @click="$emit('fullscreen')">{{ fullscreen ? '退出全屏' : '全屏' }}</button>
          <button class="pet-player-action pet-player-action--stop" hover-class="pet-player-pressed" @click="$emit('stop')">停止</button>
        </view>
      </template>
    </view>
  </view>
</template>

<script>
import { durationText } from '../utils/pet-format.js'
// 播放器：封面态 / 连接中 / 播放中三态，叠层与底栏按能力与回报动态显示（PRD 4.1）。
export default {
  name: 'PetPlayer',
  props: {
    containerId: { type: String, required: true },
    status: { type: String, default: 'idle' },
    cover: { type: Object, default: () => ({ text: '', hint: '', action: '', disabled: false }) },
    startedAt: { type: Number, default: 0 },
    viewerText: { type: String, default: '' },
    wifiText: { type: String, default: '' },
    activityText: { type: String, default: '' },
    webviewUrl: { type: String, default: '' },
    muted: { type: Boolean, default: false },
    talking: { type: Boolean, default: false },
    showIntercom: { type: Boolean, default: false },
    micShow: { type: Boolean, default: false },
    micOn: { type: Boolean, default: false },
    fullscreen: { type: Boolean, default: false },
    demo: { type: Boolean, default: false },
    quality: { type: Object, default: () => ({ openable: false, label: '' }) }
  },
  emits: ['start', 'retry', 'stop', 'toggle-mute', 'toggle-talk', 'open-quality', 'fullscreen'],
  data() {
    return { now: Date.now(), ticker: null, levels: [6, 10, 4, 12, 7] }
  },
  computed: {
    duration() {
      return durationText(this.startedAt, this.now)
    },
    // 店内收音开启且未被客户端静音时，展示拾音电平（数据来自设备回报，这里只做视觉节奏）。
    showLevels() {
      return this.micShow && this.micOn && !this.muted
    }
  },
  watch: {
    status(value) {
      if (value === 'live') this.startTicker()
      else this.stopTicker()
    }
  },
  mounted() {
    if (this.status === 'live') this.startTicker()
  },
  beforeUnmount() {
    this.stopTicker()
  },
  methods: {
    primaryAction() {
      if (this.cover.disabled) return
      this.$emit(this.cover.retry ? 'retry' : 'start')
    },
    startTicker() {
      this.stopTicker()
      this.now = Date.now()
      this.levels = this.levels.map(() => 3 + Math.round(Math.random() * 13))
      this.ticker = setInterval(() => {
        this.now = Date.now()
        this.levels = this.levels.map(() => 3 + Math.round(Math.random() * 13))
      }, 1000)
    },
    stopTicker() {
      if (this.ticker) clearInterval(this.ticker)
      this.ticker = null
    }
  }
}
</script>

<style scoped>
.pet-player { position: relative; margin: 12px 16px 0; border-radius: 16px; overflow: hidden; background: #101318; }
.pet-player-webview { width: 100%; height: 260px; }
.pet-player-stage { position: relative; width: 100%; height: 260px; }
/* 全屏：把画面铺满当前页面，底栏保持可点（H5/App 通用，App 侧不申请原生全屏以复用同一套布局）。 */
.pet-player-stage--fullscreen { position: fixed; left: 0; top: 0; right: 0; bottom: 0; width: auto; height: auto; margin: 0; border-radius: 0; z-index: 99; }
/* 演示模式没有真实画面，给一个占位视觉，避免纯黑让人误判为播放失败。 */
.pet-player-demo { position: absolute; left: 0; right: 0; top: 0; bottom: 0; display: flex; align-items: center; justify-content: center; background: linear-gradient(160deg, #2b3440, #101318); }
.pet-player-demo-icon { font-size: 56px; }
.pet-player-cover { position: absolute; left: 0; right: 0; top: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 24px; text-align: center; }
.pet-player-cover-title { color: #f5f7fa; font-size: 15px; font-weight: 600; }
.pet-player-cover-hint { margin-top: 8px; color: rgba(245, 247, 250, .7); font-size: 12px; line-height: 18px; }
.pet-player-cover-button { margin-top: 14px; padding: 0 22px; height: 36px; border: 0; border-radius: 18px; background: #ff8a3d; color: #ffffff; font-size: 14px; line-height: 36px; }
.pet-player-cover-button[disabled] { background: #4a5058; color: rgba(255, 255, 255, .5); }
.pet-player-top { position: absolute; left: 12px; right: 12px; top: 12px; display: flex; align-items: center; justify-content: space-between; }
.pet-player-live { display: flex; align-items: center; padding: 3px 8px; border-radius: 10px; background: rgba(0, 0, 0, .45); color: #ffffff; font-size: 11px; }
.pet-player-dot { width: 6px; height: 6px; margin-right: 4px; border-radius: 3px; background: #ff4d4f; }
.pet-player-duration { margin-left: 6px; }
.pet-player-meta { display: flex; color: #ffffff; font-size: 11px; }
.pet-player-meta text { margin-left: 8px; padding: 3px 8px; border-radius: 10px; background: rgba(0, 0, 0, .45); }
.pet-player-bubble { position: absolute; left: 12px; bottom: 58px; padding: 5px 10px; border-radius: 12px; background: rgba(255, 138, 61, .9); color: #ffffff; font-size: 12px; }
.pet-player-bar { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: space-around; padding: 6px 4px; background: linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, .6)); }
.pet-player-action { margin: 0; padding: 0 8px; min-width: 0; border: 0; border-radius: 12px; background: transparent; color: #ffffff; font-size: 12px; line-height: 28px; }
.pet-player-action::after { border: 0; }
.pet-player-action--on { background: rgba(255, 138, 61, .85); }
.pet-player-action--stop { color: #ffb3b3; }
.pet-player-action--static { opacity: .85; }
.pet-player-levels { display: flex; gap: 2px; align-items: flex-end; height: 16px; margin: 0 4px; }
.pet-player-level { display: block; width: 3px; border-radius: 2px; background: #ffd9b8; }
.pet-player-note { margin: 0 6px; color: rgba(255, 255, 255, .9); font-size: 11px; }
.pet-player-pressed { opacity: .6; }
</style>
