// Resolve each card independently, including when the other request is slow.
export function loadMiniDeviceOverview({ device, alarm, onDevice, onAlarm }) {
  const counts = values => values.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)
  return Promise.all([
    Promise.resolve().then(device).then(result => {
      const { device_total: total, device_on: online, device_offline = total - online } = result?.data || {}
      if (result?.code !== 200 || !counts([total, online, device_offline])) throw new Error('Invalid device statistics')
      onDevice({ total, online, offline: device_offline })
    }).catch(() => onDevice(null)),
    Promise.resolve().then(alarm).then(result => {
      const value = result?.data?.alarm_device_total
      if (result?.code !== 200 || !counts([value])) throw new Error('Invalid alarm statistics')
      onAlarm(value)
    }).catch(() => onAlarm(null))
  ])
}
