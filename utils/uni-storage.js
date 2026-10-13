/**
 * 本地存储适配器。
 *
 * H5 发行包开启了 treeShaking（manifest.json → h5.optimization），编译器只保留以
 * `uni.xxx(...)` 形式直接调用的 API。把裸 `uni` 对象当值传递（如 `storage = uni`、
 * `storage || uni`）后再调用方法，在发行包里会拿不到实现而抛 TypeError，
 * 开发运行（未摇树）却正常。这里统一用直接调用包一层，供需要可注入 storage 的地方默认使用。
 */
export const uniStorage = {
  getStorageSync: key => uni.getStorageSync(key),
  setStorageSync: (key, value) => uni.setStorageSync(key, value),
  removeStorageSync: key => uni.removeStorageSync(key)
}
