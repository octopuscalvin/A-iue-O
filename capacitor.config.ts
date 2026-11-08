import type { CapacitorConfig } from '@capacitor/cli'

/**
 * 手機 App 設定（Capacitor）：將 dist 入面嘅網頁包裝成 iOS / Android App。
 * appId 上架之後就唔可以改，正式上架前請確認。
 */
const config: CapacitorConfig = {
  appId: 'com.octoaiueo.jewelryatelier',
  appName: '首飾工作室',
  webDir: 'dist',
  backgroundColor: '#f6eef1',
}

export default config
