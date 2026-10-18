# 📦 zu-pu (族譜) — Archived

> **此專案已停止維護。所有功能已整合進 [born-somewhere](https://github.com/rollroyces/born-somewhere)。**

## 為什麼歸檔

zu-pu 原本是獨立的族譜（genealogy）工具，後來全部模組（9 語言 i18n、SVG 像素頭像、樹狀視圖、Lab 統計、GEDCOM 解析、社會系統）被移植到 **born-somewhere v4** 並加上增強：

- **v4.0**：族譜 tab + SVG 樹 + 9 語言 + Lab
- **v4.1**：真 GEDCOM 5.5.1 解析 + 寄養/收養 + 戰區孤兒
- **v4.2**：生命交叉事件面板（點家族成員看出生/去世/年齡差）
- **v4.3**：shelf 點書 → mini tree + 家族全景圖 + 共同親屬
- **v4.4**：完整 GEDCOM + 生育死亡 + Lab 家族統計 + 印度種姓 + URL 分享 + 跨國遷徙

完整家族譜系統 + 生命模擬都在 [born-somewhere](https://qcm8a40uzgrkv.space.mcode.cn) 裡。

## zu-pu 的歷史遺產

zu-pu v1 demo data（張氏家族 30 人範例）保留在 `data/demo.json`，可透過 born-somehere 的「匯入 GEDCOM」匯入。

`gedcom.js`（14KB 完整 GEDCOM 5.5.1 解析器）已直接搬到 born-somewhere/。

## 替代方案

| 我想要做 | 請到 |
|---|---|
| 玩族譜 + 生命模擬 + Lab | https://qcm8a40uzgrkv.space.mcode.cn |
| 編輯家族譜 | 同上（匯入 GEDCOM 或樹點編輯） |
| 範例家族（張氏 30 人）| 匯入 `data/demo.json` 到 born-somewhere |
| 開發原始碼 | https://github.com/rollroyces/born-somewhere |

## 感謝使用 zu-pu 🙏

這個 repo 將保留作為歷史 snapshot，不再接受 PR。