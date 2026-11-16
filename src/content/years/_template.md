---
# 複製這個檔案為 YYYY.md，欄位定義見 src/content.config.ts，新增年度色的步驟見 README
year: 2027
summary: 一句話描述這個顏色，120 字以內。
keywords: [關鍵字一, 關鍵字二, 關鍵字三, 關鍵字四]
concepts:
  - id: concept-id
    title: 產品概念名稱
    category: furniture # furniture | audio | lighting | homeware | footwear | wearable | packaging | mobility | other
    pitch: 一句話描述，80 字以內。
    audience: 目標使用者
    cmf:
      primary: '2027-0' # YYYY-N 或 #RRGGBB
      accent: '#E8DCCB'
      material: 主要材質
      finish: matte # matte | satin | gloss | metallic | velvet | translucent
    labPreset: { product: chair, light: studio } # product: chair | headphones | vase | speaker | lamp | sneaker
materials:
  good:
    - { material: 材質, reason: 理由，60 字以內 }
    - { material: 材質, reason: 理由 }
    - { material: 材質, reason: 理由 }
  avoid:
    - { material: 材質, reason: 理由 }
    - { material: 材質, reason: 理由 }
    - { material: 材質, reason: 理由 }
status: draft # 審稿完成改成 reviewed，頁面才會顯示設計發想
---

300 到 500 字的色彩故事。自行撰寫，不要直接引用 Pantone 官方文案。
