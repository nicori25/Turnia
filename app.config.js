module.exports = ({ config }) => {
  const baseUrl = process.env.TURNIA_WEB_BASE_PATH
  if (!baseUrl) return config

  return {
    ...config,
    experiments: { ...config.experiments, baseUrl },
  }
}
