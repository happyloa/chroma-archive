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

## 情境場景素材

產品實驗室的客廳、臥室、辦公室與燈光使用下列 Poly Haven 素材，授權皆為 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)。由 `scripts/optimize-scene-assets.mjs` 轉換：HDRI 原樣使用 1k 版本，貼圖轉成 1024 WebP，家具貼圖縮到 512 並以 Meshopt 壓縮。

| 檔案                                      | 素材                                                                       | 作者             |
| ----------------------------------------- | -------------------------------------------------------------------------- | ---------------- |
| `public/hdri/studio_small_08.hdr`         | [Studio Small 08](https://polyhaven.com/a/studio_small_08)                 | Sergej Majboroda |
| `public/hdri/lythwood_room.hdr`           | [Lythwood Room](https://polyhaven.com/a/lythwood_room)                     | Greg Zaal        |
| `public/hdri/unfinished_office_night.hdr` | [Unfinished Office Night](https://polyhaven.com/a/unfinished_office_night) | Sergej Majboroda |
| `public/textures/wood_floor/`             | [Wood Floor](https://polyhaven.com/a/wood_floor)                           | Dimitrios Savva  |
| `public/textures/smooth_concrete_floor/`  | [Smooth Concrete Floor](https://polyhaven.com/a/smooth_concrete_floor)     | Dimitrios Savva  |
| `public/textures/painted_plaster_wall/`   | [Painted Plaster Wall](https://polyhaven.com/a/painted_plaster_wall)       | Amal Kumar       |
| `furniture/sofa_03.glb`                   | [Sofa 03](https://polyhaven.com/a/sofa_03)                                 | Fran Calvente    |
| `furniture/coffee_table_round_01.glb`     | [Coffee Table Round 01](https://polyhaven.com/a/coffee_table_round_01)     | Ulan Cabanilla   |
| `furniture/side_table_01.glb`             | [Side Table 01](https://polyhaven.com/a/side_table_01)                     | James Ray Cock   |
| `furniture/potted_plant_04.glb`           | [Potted Plant 04](https://polyhaven.com/a/potted_plant_04)                 | James Ray Cock   |
| `furniture/ClassicNightstand_01.glb`      | [Classic Nightstand 01](https://polyhaven.com/a/ClassicNightstand_01)      | Kirill Sannikov  |
| `furniture/metal_office_desk.glb`         | [Metal Office Desk](https://polyhaven.com/a/metal_office_desk)             | Ulan Cabanilla   |
| `furniture/Shelf_01.glb`                  | [Shelf 01](https://polyhaven.com/a/Shelf_01)                               | Gabriel Radić    |

床、長凳與螢幕沒有合適的公開模型，由 `src/stage/rooms.ts` 以程式產生。
