# 3D 模型來源與授權

本資料夾的 .glb 由 `scripts/optimize-models.mjs` 從下列原始檔案轉換而來：底色貼圖轉成灰階細節圖（執行時乘上年度色）、貼圖縮到 1024 並轉成 WebP、幾何以 Meshopt 壓縮。運動鞋只保留 Beach 這組材質變體。

| 檔案          | 原始模型              | 作者                       | 來源                                                                                                                    | 授權                                                          |
| ------------- | --------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `chair.glb`   | Modern Arm Chair 01   | Kuutti Siitonen            | [Poly Haven](https://polyhaven.com/a/modern_arm_chair_01)                                                               | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `vase.glb`    | Ceramic Vase 03       | James Ray Cock             | [Poly Haven](https://polyhaven.com/a/ceramic_vase_03)                                                                   | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `sneaker.glb` | MaterialsVariantsShoe | Shopify                    | [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/MaterialsVariantsShoe) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)     |
| `lamp.glb`    | IridescenceLamp       | Eric Chadwick, Wayfair LLC | [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/IridescenceLamp)       | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)     |

CC BY 4.0 的兩個模型經過修改（重新上色、壓縮、移除材質變體），網站「關於」頁也有標註。

耳罩式耳機與智慧音箱沒有合適的公開模型，由 `src/stage/products/` 以程式產生。
