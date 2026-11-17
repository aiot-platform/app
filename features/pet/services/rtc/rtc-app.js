// Android / iOS 端实时音视频。
// 默认路径：内嵌同一套 H5 页面（web-view + embed=1），由 H5 端复用 rtc-h5.js 入会，
// 这样 H5 / Android / iOS 共用一份 RTC 代码，也不需要买原生插件与自定义基座（观看端无需相机权限）。
// 可选路径：绑定阿里云 RTC 原生/UTS 插件后走原生管线（更低延迟、支持后台音频、对讲更稳），
// 插件方法名与下面对接契约对齐后把 getNativePlugin 的返回值用起来即可。
import { getPlatformWebBase } from '@/utils/platform-web.js'

const NATIVE_PLUGIN_NAME = 'DingTalk-DingRTC'

// 原生插件桥接契约（对接时按插件实际 API 补齐实现）：
//   plugin.init({ appId, channelId, userId, token, userName })
//   plugin.setRemoteView(viewId) / plugin.leave()
//   plugin.setMuted(boolean) / plugin.startTalk() / plugin.stopTalk()
function getNativePlugin() {
  if (typeof uni.requireNativePlugin !== 'function') return null
  try {
    return uni.requireNativePlugin(NATIVE_PLUGIN_NAME) || null
  } catch (error) {
    console.warn('[pet] 未绑定 RTC 原生插件，回退 web-view 播放', error)
    return null
  }
}

/**
 * 内嵌播放页地址：复用平台 H5 基址，指向同一个面板页面的 embed 模式。
 * token 通过 query 传给 H5 上下文（内嵌网页与原生 App 的存储互相独立），页面在 embed 模式下写入自己的登录态。
 */
export function buildEmbedPlayerUrl({ deviceId, token }) {
  const params = { device_id: String(deviceId), embed: '1', token: String(token || ''), lang: uni.getStorageSync('language') || 'zh-CN' }
  const query = Object.entries(params)
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  return `${getPlatformWebBase()}/#/pages/pet/index?${query}`
}

export function createAppSession({ deviceId, onState }) {
  const plugin = getNativePlugin()
  if (!plugin) {
    return {
      mode: 'app-webview',
      needsWebview: true,
      supported: true,
      // web-view 内的 H5 自行完成入会，这里只负责把外层的状态推到「播放中」。
      async join() { onState?.({ status: 'live' }) },
      async leave() {},
      setMuted() {},
      async startTalk() {},
      async stopTalk() {}
    }
  }
  return {
    mode: 'app-native',
    needsWebview: false,
    supported: true,
    async join(auth) {
      await plugin.init({ appId: auth.appId, channelId: auth.channelId, userId: auth.userId, userName: auth.userName, token: auth.token })
      onState?.({ status: 'live' })
    },
    async leave() { await plugin.leave?.() },
    setMuted(value) { plugin.setMuted?.(value) },
    async startTalk() { await plugin.startTalk?.() },
    async stopTalk() { await plugin.stopTalk?.() }
  }
}
