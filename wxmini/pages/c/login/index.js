// C 端家长登录（手机号 + 密码）。支持一键切换「演示模式」与真实接口。
// 演示模式：写入 pet_demo_mode 标记后进入 demo 面板；关闭则正常登录，令牌写入 access_token。
import { cLogin, saveCAccessToken, getServerAddress, saveServerAddress } from '../../../services/c-api.js'

// 演示模式标记：与 pet 面板、platform 服务共用，保证一键切换后数据源一致。
const DEMO_FLAG_KEY = 'pet_demo_mode'

function readDemoFlag() {
  try { return String(wx.getStorageSync(DEMO_FLAG_KEY) || '') === '1' } catch (error) { return false }
}

function writeDemoFlag(on) {
  try {
    if (on) wx.setStorageSync(DEMO_FLAG_KEY, '1')
    else wx.removeStorageSync(DEMO_FLAG_KEY)
  } catch (error) { /* 存储不可用时忽略 */ }
}

Page({
  data: {
    phone: '',
    password: '',
    server: '',
    loading: false,
    demoMode: false
  },

  onShow() {
    this.setData({
      server: getServerAddress(),
      demoMode: readDemoFlag(),
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

  onModeChange(e) {
    const on = !!(e.detail && e.detail.value)
    writeDemoFlag(on)
    this.setData({ demoMode: on, password: on ? '' : this.data.password })
  },

  onPrimary() {
    if (this.data.demoMode) this.enterDemo()
    else this.submit()
  },

  enterDemo() {
    writeDemoFlag(true)
    wx.reLaunch({ url: '/pages/pet/index?demo=1' })
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
      writeDemoFlag(false)
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

  toast(title) {
    wx.showToast({ title, icon: 'none' })
  }
})
