<template>
  <view class="c-page">
    <view class="c-title">{{ $t('pages.cend.bind.title') }}</view>
    <view class="c-subtitle">{{ $t('pages.cend.bind.subtitle') }}</view>

    <button class="c-btn primary" :disabled="loading" @tap="doScan">{{ $t('pages.cend.bind.scan') }}</button>

    <view class="c-divider"><text>{{ $t('pages.cend.bind.manualDivider') }}</text></view>

    <view class="c-field">
      <text class="c-field-label">{{ $t('pages.cend.bind.code') }}</text>
      <input class="c-input" type="text" :placeholder="$t('pages.cend.bind.codePlaceholder')"
        placeholder-class="c-placeholder" v-model="code" :disabled="loading" @confirm="doBind" />
    </view>
    <button class="c-btn" :loading="loading" :disabled="loading" @tap="doBind">{{ $t('pages.cend.bind.submit') }}</button>

    <text class="c-foot-link" @tap="goBack">{{ $t('pages.cend.bind.back') }}</text>
  </view>
</template>

<script>
import { cBindDevice } from '@/api/modules/c-end.js'

export default {
  data() {
    return {
      code: '',
      loading: false
    }
  },
  methods: {
    doScan() {
      if (this.loading) return
      uni.scanCode({
        onlyFromCamera: false,
        success: res => {
          const extracted = this.extractCode(res?.result || '')
          if (!extracted) {
            this.toast(this.$t('pages.cend.bind.scanEmpty'))
            return
          }
          this.code = extracted
          this.doBind()
        },
        fail: () => {
          // 微信开发者工具与部分平台不支持摄像头扫码，提示改用手输。
          this.toast(this.$t('pages.cend.bind.scanFailed'))
        }
      })
    },
    // 绑定码可能是裸码，也可能是形如 https://xxx/bind?code=ABCD 的二维码内容。
    extractCode(raw) {
      const text = String(raw || '').trim()
      if (!text) return ''
      const matched = text.match(/[?&]code=([^&#]+)/i)
      if (matched && matched[1]) {
        try { return decodeURIComponent(matched[1]) } catch { return matched[1] }
      }
      if (/^https?:\/\//i.test(text)) {
        const seg = text.replace(/\/+$/, '').split('/').pop() || ''
        return seg.split('?')[0]
      }
      return text
    },
    async doBind() {
      if (this.loading) return
      const value = String(this.code || '').trim()
      if (!value) {
        this.toast(this.$t('pages.cend.bind.codeRequired'))
        return
      }
      this.loading = true
      try {
        await cBindDevice(value)
        uni.showToast({ title: this.$t('pages.cend.bind.success'), icon: 'success' })
        setTimeout(() => uni.reLaunch({ url: '/pages/c/pets/index' }), 600)
      } catch (error) {
        this.toast(error?.message || this.$t('pages.cend.bind.failed'))
      } finally {
        this.loading = false
      }
    },
    goBack() {
      uni.navigateBack({ delta: 1, fail: () => uni.reLaunch({ url: '/pages/c/pets/index' }) })
    },
    toast(message) {
      uni.showToast({ title: message, icon: 'none' })
    }
  }
}
</script>

<style>
.c-page { display: flex; flex-direction: column; min-height: 100vh; padding: 80rpx 44rpx 60rpx; box-sizing: border-box; background: #f7f8fc; }
.c-title { font-size: 44rpx; font-weight: 700; color: #101828; }
.c-subtitle { margin-top: 12rpx; font-size: 26rpx; color: #8b93aa; line-height: 1.6; }
.c-btn { width: 100%; height: 92rpx; line-height: 92rpx; margin-top: 48rpx; border: 0; border-radius: 14rpx; font-size: 30rpx; background: #ffffff; color: #1677ff; box-shadow: 0 4rpx 16rpx rgba(26,39,75,.05); }
.c-btn::after { border: 0; }
.c-btn.primary { background: linear-gradient(90deg, #1877ff 0%, #2586ff 52%, #1675f7 100%); color: #ffffff; }
.c-btn[disabled] { opacity: .6; }
.c-divider { display: flex; align-items: center; justify-content: center; margin: 56rpx 0 32rpx; font-size: 24rpx; color: #a2aab8; }
.c-divider text { padding: 0 20rpx; }
.c-field { margin-bottom: 8rpx; }
.c-field-label { display: block; margin-bottom: 12rpx; font-size: 24rpx; color: #8a92a8; }
.c-input { width: 100%; height: 92rpx; padding: 0 28rpx; box-sizing: border-box; border-radius: 14rpx; background: #ffffff; font-size: 30rpx; letter-spacing: 2rpx; color: #111a2c; }
.c-placeholder { color: #929ab0; }
.c-foot-link { display: block; margin-top: 40rpx; text-align: center; font-size: 26rpx; color: #8b93aa; }
</style>
