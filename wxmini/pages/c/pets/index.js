// C 端宠物列表：按绑定关系展示宠物档案 + 门店，点击进入看护面板（携带 device_id）。
import { cListPets, clearCAccessToken, isCLoggedIn } from '../../../services/c-api.js'

Page({
  data: {
    pets: [],
    loading: true,
    error: ''
  },

  onShow() {
    if (!isCLoggedIn()) {
      wx.reLaunch({ url: '/pages/c/login/index' })
      return
    }
    this.loadPets()
  },

  onPullDownRefresh() {
    this.loadPets().then(() => wx.stopPullDownRefresh())
  },

  async loadPets() {
    this.setData({ loading: true, error: '' })
    try {
      const list = await cListPets()
      const pets = (Array.isArray(list) ? list : []).map(item => ({
        deviceId: item.device_id || item.deviceId,
        deviceNumber: item.device_number || item.deviceNumber || '',
        deviceName: item.device_name || item.deviceName || '',
        petName: item.pet_name || item.petName || '',
        breed: item.breed || '',
        avatar: item.avatar || '',
        boardingDays: Number(item.boarding_days != null ? item.boarding_days : (item.boardingDays || 0)),
        shopName: item.shop_name || item.shopName || ''
      })).map(item => ({ ...item, title: item.petName || item.deviceName || item.deviceNumber }))
      this.setData({ pets, loading: false })
    } catch (error) {
      this.setData({ error: (error && error.message) || '加载宠物列表失败', loading: false })
    }
  },

  openPet(e) {
    const item = this.data.pets[e.currentTarget.dataset.index]
    if (!item || !item.deviceId) return
    wx.navigateTo({ url: '/pages/pet/index?device_id=' + encodeURIComponent(item.deviceId) })
  },

  goBind() {
    wx.navigateTo({ url: '/pages/c/bind/index' })
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: res => {
        if (!res.confirm) return
        clearCAccessToken()
        wx.reLaunch({ url: '/pages/c/login/index' })
      }
    })
  }
})
