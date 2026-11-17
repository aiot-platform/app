<template>
  <view class="pet-timeline">
    <view v-if="showReport" class="pet-block">
      <text class="pet-block-title">{{ $t('pages.pet.timeline.reportTitle') }}</text>
      <view class="pet-report">
        <view class="pet-report-item"><text class="pet-report-value">{{ reportText(report.eatCount, 0) }}</text><text class="pet-report-label">{{ $t('pages.pet.timeline.eat') }}</text></view>
        <view class="pet-report-item"><text class="pet-report-value">{{ reportText(report.sleepMinutes, 0) }}</text><text class="pet-report-label">{{ $t('pages.pet.timeline.sleep') }}</text></view>
        <view class="pet-report-item"><text class="pet-report-value">{{ reportText(report.playMinutes, 0) }}</text><text class="pet-report-label">{{ $t('pages.pet.timeline.play') }}</text></view>
        <view class="pet-report-item"><text class="pet-report-value">{{ reportText(report.drinkCount, 0) }}</text><text class="pet-report-label">{{ $t('pages.pet.timeline.drink') }}</text></view>
      </view>
    </view>

    <view v-if="notes.length" class="pet-block">
      <text class="pet-block-title">{{ $t('pages.pet.timeline.notesTitle') }}</text>
      <view v-for="note in notes" :key="note.id" class="pet-note">
        <text class="pet-note-head">{{ note.staffName }} · {{ timeText(note.createAt) }}</text>
        <text class="pet-note-body">{{ note.content }}</text>
      </view>
    </view>

    <view class="pet-block">
      <text class="pet-block-title">{{ $t('pages.pet.timeline.timelineTitle') }}</text>
      <view v-if="!timeline.length" class="pet-empty">{{ $t('pages.pet.timeline.empty') }}</view>
      <view v-for="item in timeline" :key="item.id" class="pet-timeline-item">
        <text class="pet-timeline-dot" :class="'pet-timeline-dot--' + item.type" />
        <view class="pet-timeline-text">
          <text class="pet-timeline-title">{{ item.title }}</text>
          <text class="pet-timeline-time">{{ timeText(item.createAt) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
// 动态页：今日日报（依赖 pet_activity）+ 店员留言 + 今日时间线（PRD 4.11）。
export default {
  name: 'PetTimelineTab',
  props: {
    report: { type: Object, default: () => ({}) },
    notes: { type: Array, default: () => [] },
    timeline: { type: Array, default: () => [] },
    hasActivity: { type: Boolean, default: false }
  },
  computed: {
    showReport() { return this.hasActivity }
  },
  methods: {
    reportText(value, digits) {
      if (value === undefined || value === null || value === '') return '--'
      const num = Number(value)
      return Number.isFinite(num) ? num.toFixed(digits) : '--'
    },
    timeText(value) {
      if (!value) return ''
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return ''
      const pad = num => String(num).padStart(2, '0')
      return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
  }
}
</script>

<style scoped>
.pet-timeline { padding: 14px 16px 20px; }
.pet-block { margin-bottom: 14px; padding: 14px; border-radius: 16px; background: #ffffff; }
.pet-block-title { display: block; margin-bottom: 10px; color: #1f2733; font-size: 14px; font-weight: 600; }
.pet-report { display: flex; }
.pet-report-item { flex: 1; display: flex; flex-direction: column; align-items: center; }
.pet-report-value { color: #ff8a3d; font-size: 18px; font-weight: 600; }
.pet-report-label { margin-top: 4px; color: #8b96a6; font-size: 11px; }
.pet-note { padding: 10px 0; border-bottom: 1px solid #f5f6f8; }
.pet-note-head { display: block; color: #8b96a6; font-size: 11px; }
.pet-note-body { display: block; margin-top: 4px; color: #1f2733; font-size: 13px; line-height: 20px; }
.pet-empty { padding: 18px 0; color: #8b96a6; font-size: 12px; text-align: center; }
.pet-timeline-item { display: flex; padding: 8px 0; }
.pet-timeline-dot { flex-shrink: 0; width: 8px; height: 8px; margin: 6px 10px 0 0; border-radius: 4px; background: #8b96a6; }
.pet-timeline-dot--eat { background: #ff8a3d; }
.pet-timeline-dot--play { background: #4a8f3c; }
.pet-timeline-dot--sleep { background: #1677ff; }
.pet-timeline-dot--care { background: #a855f7; }
.pet-timeline-dot--treat { background: #ff4d4f; }
.pet-timeline-text { flex: 1; min-width: 0; }
.pet-timeline-title { display: block; color: #1f2733; font-size: 13px; }
.pet-timeline-time { display: block; margin-top: 2px; color: #8b96a6; font-size: 11px; }
</style>
