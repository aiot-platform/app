// 宠物看护控制面板（微信小程序原生）。
// 设备数据与宠物店平台数据复用 ThingsPanel 后端（/api/v1/*），登录态沿用 access_token + serverAddress 存储约定；
// 未登录时自动进入演示模式（等价 H5 的 ?demo=1），保证一进小程序就能看到完整面板。
const DEFAULTS = {
  serverAddress: 'https://cloud.thingspanel.cn'
}

App({
  globalData: {
    statusBarHeight: 20,
    windowWidth: 375
  },

  onLaunch() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.globalData.statusBarHeight = info.statusBarHeight || 20
    this.globalData.windowWidth = info.windowWidth || 375
    if (!wx.getStorageSync('serverAddress')) wx.setStorageSync('serverAddress', DEFAULTS.serverAddress)

    // 接入阿里云小程序 RTC SDK：npm i aliyun-rtc-wx-sdk 后在开发者工具执行「工具 > 构建 npm」，
    // 再取消下面两行注释即可启用真实音视频（小程序需企业主体 + live-pusher/live-player 类目权限）。
    // const AliRtcEngine = require('aliyun-rtc-wx-sdk').default
    // this.globalData.AliRtcEngine = AliRtcEngine
  }
})
