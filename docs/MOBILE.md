# 手機 App 點樣做

首飾工作室有兩種方法放上手機：

## 方法一：直接安裝網頁（PWA，已經可以用）

網站放上網之後（要用 https），用手機瀏覽器打開：

- **iPhone（Safari）**：撳「分享」，再撳「加至主畫面」
- **Android（Chrome）**：撳右上角「⋮」，再撳「安裝應用程式」/「加到主畫面」

裝好之後，主畫面會出現粉紅色星星圖示，開出嚟冇網址列，似一個 App。開過一次之後，冇網都可以用。設計會存喺手機瀏覽器入面。

> 注意：要先將網站放上網（例如 Netlify、Vercel、Cloudflare Pages）。依家個網站只係喺你部電腦上面運行（localhost）。

## 方法二：正式 App（Capacitor，項目已經準備好）

`android/` 同 `ios/` 兩個資料夾就係 App 項目。每次改完網頁，用呢句更新 App：

```bash
npm run app:sync
```

### Android（可以喺 Windows 做）

1. 安裝 [Android Studio](https://developer.android.com/studio)，裝埋佢帶嘅 Android SDK 同 JDK 17。部電腦依家只有 Java 8，唔夠新。
2. 喺項目資料夾打：

   ```bash
   npm run app:android
   ```

3. Android Studio 會打開個項目。插上手機（要喺手機開「開發人員選項 → USB 偵錯」），撳 ▶ Run 就會裝落手機。
4. 要上架 Google Play：用 Build → Generate Signed Bundle 整 `.aab` 檔，再註冊 Google Play 開發者帳戶（一次性 US$25）。

### iOS（一定要用 Mac）

Apple 規定 iOS App 只可以喺 Mac 上面用 Xcode 整。

1. 將成個項目資料夾複製去 Mac，安裝 Xcode 同 Node.js。
2. 喺 Mac 打：

   ```bash
   npm install
   ```

   ```bash
   npm run app:ios
   ```

3. Xcode 打開之後，揀你嘅 Apple ID 做 Team，插上 iPhone，撳 ▶。
4. 要上架 App Store：需要 Apple Developer Program（每年 US$99）。

## App 設定

- App 名稱：首飾工作室
- App ID：`com.octoaiueo.jewelryatelier`（上架之後就唔可以改，上架前請確認）
- 設定檔：`capacitor.config.ts`
- 圖示：暫時用 Capacitor 預設圖示。正式上架前，可以用 `public/icons/icon-512.png` 生成各種尺寸嘅 App 圖示。
