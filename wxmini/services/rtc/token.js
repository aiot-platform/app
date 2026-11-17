// 实时音视频鉴权：AppID / 频道 / 用户 / Token 一律由平台后端签发，客户端不持有 AppKey。
// 后端需实现（本文件即接口约定）：
//   POST /api/v1/pet/rtc/token      Header: x-token
//   body: { device_id }
//   resp: { code: 200, data: { app_id, channel_id, user_id, user_name, token, expires_at } }
//   - app_id：阿里云 ARTC / DingRTC 应用 AppID
//   - channel_id：按设备维度固定，例如 pet_${device_id}，保证同一设备的主人进同一频道
//   - user_id：平台用户 ID，同一频道内不可重复
//   - token：单参数入会 token，有效期由后端控制（建议 ≥ 2 小时）
//   - expires_at：ISO 时间或秒级时间戳
import { request } from '../request.js'

export async function fetchRtcAuth(deviceId) {
  const data = await request('pet/rtc/token', { device_id: deviceId }, 'POST')
  const auth = {
    appId: data && data.app_id,
    channelId: data && data.channel_id,
    userId: data && data.user_id != null ? String(data.user_id) : '',
    userName: (data && data.user_name) || '',
    token: data && data.token,
    expiresAt: data && data.expires_at
  }
  if (!auth.appId || !auth.channelId || !auth.userId || !auth.token) {
    const error = new Error('实时音视频通道未配置')
    error.code = 'RTC_AUTH_MISSING'
    throw error
  }
  return auth
}
