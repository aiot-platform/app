<template>
  <view class="c-page">
    <view class="c-title">{{ $t('pages.cend.register.title') }}</view>
    <view class="c-subtitle">{{ $t('pages.cend.register.subtitle') }}</view>

    <view class="c-form">
      <view class="c-field">
        <text class="c-field-label">{{ $t('pages.cend.form.phone') }}</text>
        <input class="c-input" type="number" maxlength="11" :placeholder="$t('pages.cend.form.phonePlaceholder')"
          placeholder-class="c-placeholder" v-model="phone" :disabled="loading" />
      </view>
      <view class="c-field">
        <text class="c-field-label">{{ $t('pages.cend.form.password') }}</text>
        <input class="c-input" :password="!passwordVisible" :placeholder="$t('pages.cend.form.passwordHint')"
          placeholder-class="c-placeholder" v-model="password" :disabled="loading" />
      </view>
      <view class="c-field">
        <text class="c-field-label">{{ $t('pages.cend.form.confirmPassword') }}</text>
        <input class="c-input" :password="!passwordVisible" :placeholder="$t('pages.cend.form.confirmPasswordPlaceholder')"
          placeholder-class="c-placeholder" v-model="confirmPassword" :disabled="loading" />
      </view>
      <view class="c-field">
        <text class="c-field-label">{{ $t('pages.cend.form.nickname') }}</text>
        <input class="c-input" type="text" maxlength="30" :placeholder="$t('pages.cend.form.nicknamePlaceholder')"
          placeholder-class="c-placeholder" v-model="nickname" :disabled="loading" />
      </view>
    </view>

    <button class="c-btn primary" :loading="loading" :disabled="loading" @tap="doRegister">
      {{ $t('pages.cend.register.submit') }}
    </button>

    <view class="c-foot">
      <text>{{ $t('pages.cend.register.haveAccount') }}</text>
      <text class="c-link" @tap="goLogin">{{ $t('pages.cend.register.login') }}</text>
    </view>
  </view>
</template>

<script>
import { cRegister, cLogin, saveCAccessToken } from '@/api/modules/c-end.js'

export default {
  data() {
    return {
      phone: '',
      password: '',
      confirmPassword: '',
      nickname: '',
      passwordVisible: false,
      loading: false
    }
  },
  methods: {
    validate() {
      if (!this.phone || !/^\d{6,20}$/.test(this.phone)) {
        this.toast(this.$t('pages.cend.login.phoneInvalid'))
        return false
      }
      if (!this.password || this.password.length < 6) {
        this.toast(this.$t('pages.cend.register.passwordTooShort'))
        return false
      }
      if (this.password !== this.confirmPassword) {
        this.toast(this.$t('pages.cend.register.passwordMismatch'))
        return false
      }
      return true
    },
    async doRegister() {
      if (this.loading || !this.validate()) return
      this.loading = true
      try {
        await cRegister({ phone: this.phone, password: this.password, nickname: this.nickname })
        // 注册接口不返回令牌，注册成功后直接登录进入宠物列表，减少一次手动操作。
        const data = await cLogin({ phone: this.phone, password: this.password })
        saveCAccessToken(data && data.token)
        try { uni.setStorageSync('c_phone', this.phone) } catch { /* 忽略存储异常 */ }
        uni.showToast({ title: this.$t('pages.cend.register.success'), icon: 'success' })
        setTimeout(() => uni.reLaunch({ url: '/pages/c/pets/index' }), 400)
      } catch (error) {
        this.toast(error?.message || this.$t('pages.cend.register.failed'))
      } finally {
        this.loading = false
      }
    },
    goLogin() {
      uni.navigateBack({ delta: 1 })
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
.c-subtitle { margin-top: 12rpx; font-size: 26rpx; color: #8b93aa; }
.c-form { margin-top: 56rpx; }
.c-field { margin-bottom: 28rpx; }
.c-field-label { display: block; margin-bottom: 12rpx; font-size: 24rpx; color: #8a92a8; }
.c-input { width: 100%; height: 92rpx; padding: 0 28rpx; box-sizing: border-box; border-radius: 14rpx; background: #ffffff; font-size: 28rpx; color: #111a2c; }
.c-placeholder { color: #929ab0; }
.c-btn { width: 100%; height: 92rpx; line-height: 92rpx; margin-top: 48rpx; border: 0; border-radius: 14rpx; font-size: 30rpx; }
.c-btn::after { border: 0; }
.c-btn.primary { background: linear-gradient(90deg, #1877ff 0%, #2586ff 52%, #1675f7 100%); color: #ffffff; }
.c-btn.primary[disabled] { opacity: .6; }
.c-foot { display: flex; align-items: center; justify-content: center; gap: 10rpx; margin-top: 44rpx; font-size: 25rpx; color: #9299ad; }
.c-link { color: #1677ff; font-weight: 500; }
</style>
