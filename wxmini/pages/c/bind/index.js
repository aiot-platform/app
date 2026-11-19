// C 端扫码绑定设备。开发者工具不支持摄像头扫码，因此始终提供手动输入绑定码兜底。
import { cBindDevice } from '../../../services/c-api.js'

Page({
  data: {
    code: '',
    loading: false
  },

  onCode(e) { this.setData({ code: e.detail.value }) },

  scan() {
    if (this.data.loading) return
    wx.scanCode({
      onlyFromCamera: false,
      success: res => {
        const code = this.extractCode(res && res.result)
        if (!code) { this.toast('未识别到绑定码，请重试或手动输入'); return }
        this.setData({ code })
        this.submit()
      },
      fail: () => {
        // 微信开发者工具与未授权摄像头时走这里，提示改用手输。
        this.toast('当前环境不支持扫码，请手动输入绑定码')
      }
    })
  },

  // 绑定码可能是裸码，也可能是形如 https://xxx/bind?code=ABCD 的二维码内容。
  extractCode(raw) {
    const text = String(raw || '').trim()
    if (!text) return ''
    const matched = text.match(/[?&]code=([^&#]+)/i)
    if (matched && matched[1]) {
      try { return decodeURIComponent(matched[1]) } catch (error) { return matched[1] }
    }
    if (/^https?:\/\//i.test(text)) {
      const seg = text.replace(/\/+$/, '').split('/').pop() || ''
      return seg.split('?')[0]
    }
    return text
  },

  async submit() {
    if (this.data.loading) return
    const code = String(this.data.code || '').trim()
    if (!code) { this.toast('请输入绑定码'); return }
    this.setData({ loading: true })
    try {
      await cBindDevice(code)
      wx.showToast({ title: '绑定成功', icon: 'success' })
      setTimeout(() => wx.reLaunch({ url: '/pages/c/pets/index' }), 600)
    } catch (error) {
      this.toast((error && error.message) || '绑定失败，请检查绑定码')
    } finally {
      this.setData({ loading: false })
    }
  },

  goBack() {
    wx.navigateBack({ delta: 1, fail: () => wx.reLaunch({ url: '/pages/c/pets/index' }) })
  },

  toast(title) {
    wx.showToast({ title, icon: 'none' })
  }
})
