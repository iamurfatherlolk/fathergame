# FPS_Game

校園修改版 - 方便在學校編輯

## 檔案結構

```
FPS_Game/
├── index.html      ← 主檔案（打開這個）
├── style.css       ← 樣式（按鍵、 HUD 顯示）
├── game.js         ← 遊戲邏輯（槍械、射擊、移动）
└── README.txt      ← 你在看的這個
```

## 如何修改

1. 用記事本或 [VS Code](https://code.visualstudio.com/) 打開 `index.html`
2. 雙擊 `index.html` 可以在瀏覽器預覽遊戲
3. 在學校電腦上，幾乎所有文字編輯器都能修改這些檔案

## 修改提示

| 想改什麼 | 編輯哪個檔案 |
|---------|-------------|
| 槍械傷害/子彈數 | `game.js` 找 `gunConfigs` |
| 按鍵說明 | `style.css` 或 `index.html` |
| 顏色/HUD樣式 | `style.css` |
| 武器重生時間 | `game.js` 找 `respawnTime` |

## 學校使用方式

1. 把整個資料夾複製到 U盤
2. 到學校後，用記事本打開 `.js` 或 `.css` 檔案
3. 改完存檔，雙擊 `index.html` 測試
