<template>
  <view class="pet-album">
    <view v-if="!photos.length" class="pet-album-empty">
      <text class="pet-album-empty-title">还没有照片</text>
      <text class="pet-album-empty-hint">观看实时流时点“抓拍”，留住{{ petName }}的可爱瞬间</text>
    </view>
    <view v-else class="pet-album-grid">
      <view v-for="photo in photos" :key="photo.id" class="pet-album-cell" @click="preview = photo">
        <image class="pet-album-image" :src="photo.src" mode="aspectFill" />
        <text class="pet-album-time">{{ photo.time }}</text>
      </view>
    </view>

    <view v-if="preview" class="pet-album-viewer" @click="preview = null">
      <image class="pet-album-viewer-image" :src="preview.src" mode="aspectFit" />
      <text class="pet-album-viewer-time">{{ preview.time }}</text>
    </view>
  </view>
</template>

<script>
// 相册页：双列网格 + 大图浮层 + 空态（PRD 4.5）。
export default {
  name: 'PetAlbumTab',
  props: {
    photos: { type: Array, default: () => [] },
    petName: { type: String, default: '宠物' }
  },
  data() {
    return { preview: null }
  }
}
</script>

<style scoped>
.pet-album { padding: 14px 16px 20px; }
.pet-album-empty { display: flex; flex-direction: column; align-items: center; padding: 60px 30px; border-radius: 16px; background: #ffffff; }
.pet-album-empty-title { color: #1f2733; font-size: 14px; }
.pet-album-empty-hint { margin-top: 8px; color: #8b96a6; font-size: 12px; line-height: 18px; text-align: center; }
.pet-album-grid { display: flex; flex-wrap: wrap; }
.pet-album-cell { width: 48%; margin: 0 4% 10px 0; border-radius: 14px; overflow: hidden; background: #ffffff; }
.pet-album-image { width: 100%; height: 150px; background: #f2f3f5; }
.pet-album-time { display: block; padding: 6px 8px; color: #8b96a6; font-size: 11px; }
.pet-album-viewer { position: fixed; left: 0; right: 0; top: 0; bottom: 0; z-index: 95; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0, 0, 0, .88); }
.pet-album-viewer-image { width: 92%; height: 70%; }
.pet-album-viewer-time { margin-top: 14px; color: rgba(255, 255, 255, .8); font-size: 12px; }
</style>
