<template>
  <view class="c-page">
    <view class="c-brand">
      <image class="c-brand-logo" src="/static/icon/app-mark.png" mode="aspectFit" />
      <text class="c-brand-name">{{ $t('pages.cend.appName') }}</text>
      <text class="c-brand-slogan">{{ $t('pages.cend.login.slogan') }}</text>
    </view>

    <view class="c-mode">
      <view class="c-mode-text">
        <text class="c-mode-title">{{ $t('pages.cend.login.demoMode') }}</text>
        <text class="c-mode-desc">{{ $t('pages.cend.login.demoModeDesc') }}</text>
      </view>
      <switch :checked="demoMode" color="#1677ff" :disabled="loading" @change="onModeChange" />
    </view>

    <view v-if="!demoMode" class="c-form">
      <view class="c-field">
        <text class="c-field-label">{{ $t('pages.cend.form.phone') }}</text>
        <input class="c-input" type="number" maxlength="11" :placeholder="$t('pages.cend.form.phonePlaceholder')"
          placeholder-class="c-placeholder" v-model="phone" :disabled="loading" />
      </view>
      <view class="c-field">
        <text class="c-field-label">{{ $t('pages.cend.form.password') }}</text>
        <input class="c-input" :password="!passwordVisible" :placeholder="$t('pages.cend.form.passwordPlaceholder')"
          placeholder-class="c-placeholder" v-model="password" :disabled="loading" />
      </view>
    </view>

    <view v-if="!demoMode" class="c-server">
      <text class="c-server-label">{{ $t('pages.cend.form.server') }}</text>
      <input class="c-server-input" type="text" v-model="server" confirm-type="done"
        @blur="saveServer" @confirm="saveServer" :disabled="loading" />
    </view>

    <button class="c-btn primary" :loading="loading" :disabled="loading" @tap="onPrimary">
      {{ demoMode ? $t('pages.cend.login.enterDemo') : $t('pages.cend.login.submit') }}
    </button>

    <view v-if="!demoMode" class="c-foot">
      <text>{{ $t('pages.cend.login.noAccount') }}</text>
      <text class="c-link" @tap="goRegister">{{ $t('pages.cend.login.register') }}</text>
    </view>
  </view>
</template>

<script>
import { cLogin, saveCAccessToken, getServerAddress, saveServerAddress } from '@/api/modules/c-end.js'

// 演示模式标记：与 pet 面板、pet-platform 服务共用，保证一键切换后数据源一致。
const DEMO_FLAG_KEY = 'pet_demo_mode'

function readDemoFlag() {
  try { return String(uni.getStorageSync(DEMO_FLAG_KEY) || '') === '1' } catch { return false }
}

function writeDemoFlag(on) {
  try {
    if (on) uni.setStorageSync(DEMO_FLAG_KEY, '1')
    else uni.removeStorageSync(DEMO_FLAG_KEY)
  } catch { /* 存储不可用时忽略 */ }
}

export default {
  data() {
    return {
      phone: '',
      password: '',
      passwordVisible: false,
      server: '',
      loading: false,
      demoMode: false
    }
  },
  onShow() {
    this.server = getServerAddress()
    this.demoMode = readDemoFlag()
    try { this.phone = String(uni.getStorageSync('c_phone') || '') } catch { this.phone = '' }
    this.password = ''
  },
  methods: {
    saveServer() {
      const value = String(this.server || '').trim()
      if (value) saveServerAddress(value)
      this.server = getServerAddress()
    },
    validate() {
      if (!this.phone || !/^\d{6,20}$/.test(this.phone)) {
        this.toast(this.$t('pages.cend.login.phoneInvalid'))
        return false
      }
      if (!this.password) {
        this.toast(this.$t('pages.cend.login.passwordRequired'))
        return false
      }
      return true
    },
    async doLogin() {
      if (this.loading || !this.validate()) return
      this.loading = true
      try {
        this.saveServer()
        const data = await cLogin({ phone: this.phone, password: this.password })
        saveCAccessToken(data && data.token)
        writeDemoFlag(false)
        try { uni.setStorageSync('c_phone', this.phone) } catch { /* 忽略存储异常 */ }
        uni.reLaunch({ url: '/pages/c/pets/index' })
      } catch (error) {
        this.toast(error?.message || this.$t('pages.cend.login.failed'))
      } finally {
        this.loading = false
      }
    },
    goRegister() {
      uni.navigateTo({ url: '/pages/c/register/index' })
    },
    onModeChange(event) {
      this.demoMode = !!(event && event.detail && event.detail.value)
      writeDemoFlag(this.demoMode)
      if (this.demoMode) this.password = ''
    },
    onPrimary() {
      if (this.demoMode) this.enterDemo()
      else this.doLogin()
    },
    enterDemo() {
      writeDemoFlag(true)
      uni.reLaunch({ url: '/pages/pet/index?demo=1' })
    },
    toast(message) {
      uni.showToast({ title: message, icon: 'none' })
    }
  }
}
</script>

<style>
.c-page { display: flex; flex-direction: column; min-height: 100vh; padding: 0 44rpx 60rpx; box-sizing: border-box; background: #f7f8fc; }
.c-brand { display: flex; flex-direction: column; align-items: center; margin-top: 160rpx; }
.c-brand-logo { width: 120rpx; height: 120rpx; border-radius: 24rpx; box-shadow: 0 12rpx 30rpx rgba(22,119,255,.13); }
.c-brand-name { margin-top: 24rpx; font-size: 40rpx; font-weight: 600; color: #101828; }
.c-brand-slogan { margin-top: 12rpx; font-size: 26rpx; color: #8b93aa; }
.c-mode { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; margin-top: 72rpx; padding: 24rpx 28rpx; border-radius: 16rpx; background: #ffffff; }
.c-mode-text { flex: 1; min-width: 0; }
.c-mode-title { display: block; font-size: 28rpx; font-weight: 600; color: #101828; }
.c-mode-desc { display: block; margin-top: 6rpx; font-size: 22rpx; color: #8b93aa; }
.c-form { margin-top: 48rpx; }
.c-field { margin-bottom: 28rpx; }
.c-field-label { display: block; margin-bottom: 12rpx; font-size: 24rpx; color: #8a92a8; }
.c-input { width: 100%; height: 92rpx; padding: 0 28rpx; box-sizing: border-box; border-radius: 14rpx; background: #ffffff; font-size: 28rpx; color: #111a2c; }
.c-placeholder { color: #929ab0; }
.c-server { display: flex; align-items: center; gap: 16rpx; margin-top: 10rpx; }
.c-server-label { flex: 0 0 auto; font-size: 24rpx; color: #8a92a8; }
.c-server-input { flex: 1; min-width: 0; height: 60rpx; padding: 0 16rpx; border-bottom: 2rpx solid #d9dee8; font-size: 26rpx; color: #13203a; }
.c-btn { width: 100%; height: 92rpx; line-height: 92rpx; margin-top: 56rpx; border: 0; border-radius: 14rpx; font-size: 30rpx; }
.c-btn::after { border: 0; }
.c-btn.primary { background: linear-gradient(90deg, #1877ff 0%, #2586ff 52%, #1675f7 100%); color: #ffffff; }
.c-btn.primary[disabled] { opacity: .6; }
.c-foot { display: flex; align-items: center; justify-content: center; gap: 10rpx; margin-top: 44rpx; font-size: 25rpx; color: #9299ad; }
.c-link { color: #1677ff; font-weight: 500; }
</style>
