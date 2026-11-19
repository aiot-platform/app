// C 端家长登录（手机号 + 密码）。登录成功后令牌写入 access_token，跳转宠物列表。
import { cLogin, saveCAccessToken, getServerAddress, saveServerAddress } from '../../../services/c-api.js'

Page({
  data: {
    phone: '',
    password: '',
    server: '',
    loading: false
  },

  onShow() {
    this.setData({
      server: getServerAddress(),
      phone: wx.getStorageSync('c_phone') || '',
      password: ''
    })
  },

  onPhone(e) { this.setData({ phone: e.detail.value }) },
  onPassword(e) { this.setData({ password: e.detail.value }) },
  onServer(e) { this.setData({ server: e.detail.value }) },

  saveServer() {
    const value = String(this.data.server || '').trim()
    if (value) saveServerAddress(value)
    this.setData({ server: getServerAddress() })
  },

  async submit() {
    if (this.data.loading) return
    const phone = String(this.data.phone || '').trim()
    const password = String(this.data.password || '')
    if (!/^\d{6,20}$/.test(phone)) { this.toast('请输入正确的手机号'); return }
    if (!password) { this.toast('请输入密码'); return }
    this.saveServer()
    this.setData({ loading: true })
    try {
      const data = await cLogin({ phone, password })
      saveCAccessToken(data && data.token)
      try { wx.setStorageSync('c_phone', phone) } catch (error) { /* 存储不可用时忽略 */ }
      wx.reLaunch({ url: '/pages/c/pets/index' })
    } catch (error) {
      this.toast((error && error.message) || '登录失败，请检查手机号与密码')
    } finally {
      this.setData({ loading: false })
    }
  },

  goRegister() {
    wx.navigateTo({ url: '/pages/c/register/index' })
  },

  goDemo() {
    wx.reLaunch({ url: '/pages/pet/index?demo=1' })
  },

  toast(title) {
    wx.showToast({ title, icon: 'none' })
  }
})
