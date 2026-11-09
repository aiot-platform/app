// Older servers predate the runtime endpoint. Only its explicit absence permits
// legacy reads; auth errors, outages and native-engine failures must stay errors.
export function withMiniAlarmCompatibility(request) {
  return async (path, ...args) => {
    try {
      return await request(path, ...args)
    } catch (error) {
      if (path === '/api/v1/automation/runtime' && error?.statusCode === 404) {
        return { code: 200, data: { mode: 'legacy' } }
      }
      throw error
    }
  }
}
