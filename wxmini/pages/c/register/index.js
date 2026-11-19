// C 端家长注册。注册接口不返回令牌，注册成功后自动登录进入宠物列表。
import { cRegister, cLogin, saveCAccessToken } from '../../../services/c-api.js'

Page({
  data: {
    phone: '',
    password: '',
    confirmPassword: '',
    nickname: '',
    loading: false
  },

  onPhone(e) { this.setData({ phone: e.detail.value }) },
  onPassword(e) { this.setData({ password: e.detail.value }) },
  onConfirm(e) { this.setData({ confirmPassword: e.detail.value }) },
  onNickname(e) { this.setData({ nickname: e.detail.value }) },

  async submit() {
    if (this.data.loading) return
    const phone = String(this.data.phone || '').trim()
    const password = String(this.data.password || '')
    if (!/^\d{6,20}$/.test(phone)) { this.toast('请输入正确的手机号'); return }
    if (!password || password.length < 6) { this.toast('密码至少 6 位'); return }
    if (password !== this.data.confirmPassword) { this.toast('两次输入的密码不一致'); return }
    this.setData({ loading: true })
    try {
      await cRegister({ phone, password, nickname: this.data.nickname })
      const data = await cLogin({ phone, password })
      saveCAccessToken(data && data.token)
      try { wx.setStorageSync('c_phone', phone) } catch (error) { /* 存储不可用时忽略 */ }
      wx.showToast({ title: '注册成功', icon: 'success' })
      setTimeout(() => wx.reLaunch({ url: '/pages/c/pets/index' }), 500)
    } catch (error) {
      this.toast((error && error.message) || '注册失败，请稍后重试')
    } finally {
      this.setData({ loading: false })
    }
  },

  goLogin() {
    wx.navigateBack({ delta: 1, fail: () => wx.reLaunch({ url: '/pages/c/login/index' }) })
  },

  toast(title) {
    wx.showToast({ title, icon: 'none' })
  }
})
