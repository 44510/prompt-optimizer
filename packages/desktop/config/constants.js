/**
 * 静态常量定义
 * 这个文件只包含纯静态常量，没有任何动态逻辑或副作用
 * 可以安全地在 Electron preload 脚本的沙箱环境中加载
 */

// IPC事件名称常量
const IPC_EVENTS = {
  UPDATE_CHECK: 'updater-check-update',
  UPDATE_START_DOWNLOAD: 'updater-start-download',
  UPDATE_INSTALL: 'updater-install-update',
  UPDATE_IGNORE_VERSION: 'updater-ignore-version',

  // 主进程发送给渲染进程的事件
  UPDATE_AVAILABLE_INFO: 'update-available-info',
  UPDATE_NOT_AVAILABLE: 'update-not-available',
  UPDATE_DOWNLOAD_PROGRESS: 'update-download-progress',
  UPDATE_DOWNLOADED: 'update-downloaded',
  UPDATE_ERROR: 'update-error'
};

// 偏好设置键名常量
const PREFERENCE_KEYS = {
  ALLOW_PRERELEASE: 'updater.allowPrerelease',
  IGNORED_VERSION: 'updater.ignoredVersion', // 保留用于向后兼容
  IGNORED_VERSIONS: 'updater.ignoredVersions' // 新的多版本忽略存储
};

// 默认配置
const DEFAULT_CONFIG = {
  autoDownload: false,
  allowPrerelease: false,
  checkInterval: 24 * 60 * 60 * 1000, // 24小时
  timeout: 30000 // 30秒
};

module.exports = {
  IPC_EVENTS,
  PREFERENCE_KEYS,
  DEFAULT_CONFIG
};
