import { uniStorage } from '@/utils/uni-storage'

export const SESSION_STORAGE_KEYS = ['access_token', 'userWxInfo', 'isAuth', 'wx_code', 'push_id']

export function isSessionExpiredCode(code) {
  return Number(code) === 401
}

export function clearSessionStorage(storage = uniStorage) {
  SESSION_STORAGE_KEYS.forEach(key => storage.removeStorageSync(key))
}
