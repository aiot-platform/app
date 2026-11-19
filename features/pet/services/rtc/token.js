// 实时音视频鉴权：AppID / 频道 / 用户 / Token 一律由平台后端签发，客户端不持有 AppKey。
// C 端走独立令牌接口（家长仅能为自己已绑定的设备取入会凭证）：
//   POST /api/v1/c/pets/{device_id}/rtc/token      Header: x-token
//   resp: { code: 200, data: { app_id, channel_id, user_id, user_name, token, expires_at } }
//   - app_id：阿里云 ARTC 应用的 AppID（控制台「视频直播 > 实时音视频 > 应用管理」）
//   - channel_id：按设备维度固定，例如 `pet_${device_id}`，保证同一设备的主人都进同一频道
//   - user_id：C 端用户 ID，同一频道内不可重复
//   - user_name：显示名，可空
//   - token：阿里云 ARTC 单参数入会 token，有效期由后端控制（建议 ≥ 2 小时并在过期前刷新）
//   - expires_at：ISO 时间或秒级时间戳，前端据此提前 30 秒刷新
import { cGetRtcToken } from '@/api/modules/c-end.js'

export async function fetchRtcAuth(deviceId) {
  const data = await cGetRtcToken(deviceId)
  const auth = {
    appId: data?.app_id,
    channelId: data?.channel_id,
    userId: data?.user_id == null ? '' : String(data.user_id),
    userName: data?.user_name || '',
    token: data?.token,
    expiresAt: data?.expires_at
  }
  if (!auth.appId || !auth.channelId || !auth.userId || !auth.token) {
    const error = new Error('实时音视频通道未配置')
    error.code = 'RTC_AUTH_MISSING'
    throw error
  }
  return auth
}

/** 鉴权信息剩余有效期（毫秒）；无法解析时返回 null，交给调用方按需刷新。 */
export function authRemainingMs(auth) {
  if (!auth?.expiresAt) return null
  const time = typeof auth.expiresAt === 'number'
    ? (auth.expiresAt < 1e11 ? auth.expiresAt * 1000 : auth.expiresAt)
    : Date.parse(auth.expiresAt)
  return Number.isFinite(time) ? time - Date.now() : null
}
