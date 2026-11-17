<template>
  <view v-if="alert" class="pet-alert" :class="'pet-alert--' + levelClass" role="alert">
    <text class="pet-alert-text">{{ alert.text }}</text>
    <text v-if="alert.count > 1" class="pet-alert-count">{{ countText }}</text>
    <text class="pet-alert-close" @click="$emit('dismiss')">✕</text>
  </view>
</template>

<script>
// 首页告警条：ERROR 红 / WARN 橙 / INFO 蓝，多条同时存在时展示优先级最高的一条并标注总数（PRD 4.10）。
export default {
  name: 'PetAlertBar',
  props: {
    alert: { type: Object, default: null },
    countText: { type: String, default: '' }
  },
  emits: ['dismiss'],
  computed: {
    levelClass() {
      const level = String(this.alert?.level || '').toLowerCase()
      return level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info'
    }
  }
}
</script>

<style scoped>
.pet-alert { display: flex; align-items: center; margin: 10px 16px 0; padding: 10px 12px; border-radius: 12px; font-size: 12px; line-height: 18px; }
.pet-alert--error { background: #fff1f0; color: #cf1322; }
.pet-alert--warn { background: #fff7e6; color: #d46b08; }
.pet-alert--info { background: #eef6ff; color: #1677ff; }
.pet-alert-text { flex: 1; }
.pet-alert-count { margin-left: 8px; opacity: .8; }
.pet-alert-close { margin-left: 10px; padding: 0 2px; font-size: 12px; }
</style>
