import type { Group } from 'three';

/**
 * glTF 模型載入（T034）。載入器與 Meshopt 解碼器延遲載入；同一網址只下載與解析一次，
 * 之後回傳 clone（幾何與材質共用，不在視窗釋放時 dispose）。
 * 模型貼圖用 WebP（EXT_texture_webp），three.js 內建支援，不需要額外的轉碼器。
 */
const gltfCache = new Map<string, Promise<Group>>();

export function loadGLTF(url: string): Promise<Group> {
  let task = gltfCache.get(url);
  if (!task) {
    task = (async () => {
      const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/libs/meshopt_decoder.module.js'),
      ]);
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const gltf = await loader.loadAsync(url);
      return gltf.scene;
    })();
    gltfCache.set(url, task);
    task.catch(() => gltfCache.delete(url));
  }
  return task.then((g) => g.clone(true));
}
