第2高速化版

- Google Fonts を削除し、システムフォントへ変更
- tailwind-lite.css を HTML にインライン化して初回CSSリクエストを削減
- 公開カレンダーの幅計算で clientWidth を読まないように変更
- 公開カレンダーの grid 再計算を requestAnimationFrame 1回に整理
- 公開初期化を即時描画 + バックグラウンド更新へ変更
