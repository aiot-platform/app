<template>
  <view class="pet-nav" role="tablist">
    <button v-for="item in items" :key="item.key" class="pet-nav-item" :class="{ 'pet-nav-item--active': item.key === active }"
      :aria-selected="item.key === active" :style="{ color: item.key === active ? activeColor : inactiveColor }"
      hover-class="pet-nav-pressed" @click="$emit('change', item.key)">
      <text class="pet-nav-badge" v-if="item.badge">{{ item.badge > 99 ? '99+' : item.badge }}</text>
      <text class="pet-nav-label">{{ $t(item.labelKey) }}</text>
    </button>
  </view>
</template>

<script>
// 面板内的底部导航：入口数量随能力级联变化，剩余入口等宽排布（PRD 3.2）。
export default {
  name: 'PetNav',
  props: {
    items: { type: Array, default: () => [] },
    active: { type: String, default: 'live' },
    activeColor: { type: String, default: '#ff8a3d' },
    inactiveColor: { type: String, default: '#8b96a6' }
  }
}
</script>

<style scoped>
.pet-nav { flex-shrink: 0; display: flex; height: calc(52px + env(safe-area-inset-bottom)); padding-bottom: env(safe-area-inset-bottom); box-sizing: border-box; border-top: 1px solid rgba(127, 140, 160, .16); background: #ffffff; }
.pet-nav-item { flex: 1; min-width: 0; margin: 0; padding: 0; border: 0; border-radius: 0; background: transparent; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 12px; line-height: 1.4; }
.pet-nav-item::after { border: 0; }
.pet-nav-item--active { font-weight: 600; }
.pet-nav-badge { position: absolute; margin-top: -26px; margin-left: 26px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; background: #ff4d4f; color: #fff; font-size: 10px; line-height: 16px; text-align: center; }
.pet-nav-pressed { opacity: .6; }
</style>
