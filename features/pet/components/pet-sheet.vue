<template>
  <view v-if="visible" class="pet-sheet-mask" @click="close">
    <view class="pet-sheet" @click.stop>
      <view class="pet-sheet-head">
        <text class="pet-sheet-cancel" @click="close">取消</text>
        <text class="pet-sheet-title">{{ title }}</text>
        <text class="pet-sheet-confirm" :class="{ 'is-disabled': !changed }" @click="confirm">确定</text>
      </view>
      <view class="pet-sheet-body">
        <button v-for="item in options" :key="item.value" class="pet-sheet-option"
          :class="{ 'pet-sheet-option--active': temp === item.value }" hover-class="pet-sheet-pressed"
          @click="temp = item.value">
          <text>{{ item.label }}</text>
          <text v-if="temp === item.value" class="pet-sheet-tick">✓</text>
        </button>
      </view>
    </view>
  </view>
</template>

<script>
// 单选浮层：只更新临时值，关闭 / 遮罩 / 返回都丢弃临时值（PRD 4.8、4.9）。
export default {
  name: 'PetSheet',
  props: {
    visible: { type: Boolean, default: false },
    title: { type: String, default: '' },
    options: { type: Array, default: () => [] },
    modelValue: { default: undefined }
  },
  emits: ['close', 'confirm'],
  data() {
    return { temp: undefined }
  },
  computed: {
    changed() {
      return this.temp !== undefined && this.temp !== this.modelValue
    }
  },
  watch: {
    visible(value) {
      if (value) this.temp = this.modelValue
    }
  },
  methods: {
    close() {
      this.temp = undefined
      this.$emit('close')
    },
    confirm() {
      if (!this.changed) return
      this.$emit('confirm', this.temp)
      this.temp = undefined
    }
  }
}
</script>

<style scoped>
.pet-sheet-mask { position: fixed; left: 0; right: 0; top: 0; bottom: 0; z-index: 90; background: rgba(0, 0, 0, .4); display: flex; align-items: flex-end; }
.pet-sheet { width: 100%; border-radius: 16px 16px 0 0; background: #ffffff; padding-bottom: env(safe-area-inset-bottom); }
.pet-sheet-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #f0f2f5; }
.pet-sheet-title { flex: 1; text-align: center; font-size: 15px; font-weight: 600; color: #1f2733; }
.pet-sheet-cancel { font-size: 14px; color: #8b96a6; }
.pet-sheet-confirm { font-size: 14px; color: #ff8a3d; }
.pet-sheet-confirm.is-disabled { color: #c9cfd8; }
.pet-sheet-body { max-height: 50vh; overflow-y: auto; padding: 4px 0 8px; }
.pet-sheet-option { display: flex; align-items: center; justify-content: space-between; margin: 0; padding: 0 20px; border: 0; border-radius: 0; background: #ffffff; color: #1f2733; font-size: 15px; line-height: 48px; text-align: left; }
.pet-sheet-option::after { border: 0; }
.pet-sheet-option--active { color: #ff8a3d; }
.pet-sheet-tick { font-size: 15px; }
.pet-sheet-pressed { background: #f7f8fa; }
</style>
