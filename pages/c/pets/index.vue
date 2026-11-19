<template>
  <view class="c-page">
    <view class="c-head">
      <view class="c-head-copy">
        <text class="c-head-title">{{ $t('pages.cend.pets.title') }}</text>
        <text class="c-head-desc">{{ $t('pages.cend.pets.desc') }}</text>
      </view>
      <text class="c-head-action" @tap="goBind">{{ $t('pages.cend.pets.bind') }}</text>
    </view>

    <view v-if="loading" class="c-state">{{ $t('common.loading') }}</view>
    <view v-else-if="loadError" class="c-state">
      <text>{{ loadError }}</text>
      <text class="c-link" @tap="loadPets">{{ $t('common.ok') }}</text>
    </view>
    <view v-else-if="!pets.length" class="c-state">
      <text>{{ $t('pages.cend.pets.empty') }}</text>
      <text class="c-link" @tap="goBind">{{ $t('pages.cend.pets.bindNow') }}</text>
    </view>

    <view v-else class="c-list">
      <view v-for="item in pets" :key="item.deviceId" class="c-card" @tap="openPet(item)">
        <image class="c-avatar" :src="item.avatar || defaultAvatar" mode="aspectFill" />
        <view class="c-card-body">
          <text class="c-card-name">{{ item.petName || item.deviceName || item.deviceNumber }}</text>
          <text class="c-card-meta">{{ item.breed || $t('pages.cend.pets.unknownBreed') }}</text>
          <text v-if="item.shopName" class="c-card-shop">{{ item.shopName }}</text>
          <text v-if="item.boardingDays > 0" class="c-card-tag">{{ $t('pages.cend.pets.boarding', { days: item.boardingDays }) }}</text>
        </view>
        <text class="c-card-arrow">›</text>
      </view>
    </view>

    <text class="c-logout" @tap="doLogout">{{ $t('pages.cend.pets.logout') }}</text>
  </view>
</template>

<script>
import { cListPets, cUnbindDevice, isCLoggedIn, clearCAccessToken } from '@/api/modules/c-end.js'

export default {
  data() {
    return {
      pets: [],
      loading: true,
      loadError: '',
      defaultAvatar: ''
    }
  },
  onShow() {
    if (!isCLoggedIn()) {
      uni.reLaunch({ url: '/pages/c/login/index' })
      return
    }
    this.loadPets()
  },
  onPullDownRefresh() {
    this.loadPets().finally(() => uni.stopPullDownRefresh())
  },
  methods: {
    async loadPets() {
      this.loading = true
      this.loadError = ''
      try {
        const list = await cListPets()
        this.pets = (Array.isArray(list) ? list : []).map(item => ({
          deviceId: item.device_id || item.deviceId,
          deviceNumber: item.device_number || item.deviceNumber || '',
          deviceName: item.device_name || item.deviceName || '',
          petName: item.pet_name || item.petName || '',
          breed: item.breed || '',
          avatar: item.avatar || '',
          boardingDays: Number(item.boarding_days ?? item.boardingDays ?? 0),
          shopName: item.shop_name || item.shopName || ''
        }))
      } catch (error) {
        this.loadError = error?.message || this.$t('pages.cend.pets.loadFailed')
      } finally {
        this.loading = false
      }
    },
    openPet(item) {
      if (!item.deviceId) return
      uni.navigateTo({ url: `/pages/pet/index?device_id=${encodeURIComponent(item.deviceId)}` })
    },
    goBind() {
      uni.navigateTo({ url: '/pages/c/bind/index' })
    },
    doLogout() {
      uni.showModal({
        title: this.$t('pages.cend.pets.logout'),
        content: this.$t('pages.cend.pets.logoutConfirm'),
        success: res => {
          if (!res.confirm) return
          clearCAccessToken()
          uni.reLaunch({ url: '/pages/c/login/index' })
        }
      })
    }
  }
}
</script>

<style>
.c-page { min-height: 100vh; padding: 32rpx 32rpx 60rpx; box-sizing: border-box; background: #f4f6f8; }
.c-head { display: flex; align-items: flex-start; justify-content: space-between; padding: 16rpx 8rpx 28rpx; }
.c-head-copy { display: flex; flex-direction: column; }
.c-head-title { font-size: 40rpx; font-weight: 700; color: #101828; }
.c-head-desc { margin-top: 8rpx; font-size: 24rpx; color: #8b93aa; }
.c-head-action { flex: 0 0 auto; padding: 12rpx 24rpx; border-radius: 32rpx; background: #1677ff; color: #ffffff; font-size: 26rpx; }
.c-state { display: flex; flex-direction: column; align-items: center; gap: 20rpx; padding: 160rpx 0; font-size: 28rpx; color: #8b96a6; }
.c-list { display: flex; flex-direction: column; gap: 24rpx; }
.c-card { display: flex; align-items: center; padding: 28rpx; border-radius: 20rpx; background: #ffffff; box-shadow: 0 4rpx 16rpx rgba(26,39,75,.05); }
.c-avatar { width: 108rpx; height: 108rpx; border-radius: 20rpx; background: #e9edf2; }
.c-card-body { flex: 1; min-width: 0; display: flex; flex-direction: column; margin-left: 24rpx; }
.c-card-name { font-size: 32rpx; font-weight: 600; color: #101828; }
.c-card-meta { margin-top: 6rpx; font-size: 25rpx; color: #8b93aa; }
.c-card-shop { margin-top: 6rpx; font-size: 24rpx; color: #6b7688; }
.c-card-tag { align-self: flex-start; margin-top: 12rpx; padding: 4rpx 16rpx; border-radius: 20rpx; background: #fff4e8; color: #d46b08; font-size: 22rpx; }
.c-card-arrow { flex: 0 0 auto; margin-left: 12rpx; font-size: 44rpx; color: #c3cad6; line-height: 1; }
.c-logout { display: block; margin: 56rpx auto 0; text-align: center; font-size: 26rpx; color: #8b93aa; }
.c-link { color: #1677ff; font-weight: 500; }
</style>
