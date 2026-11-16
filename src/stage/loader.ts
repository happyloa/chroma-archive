import type { Group, WebGLRenderer } from 'three';

/**
 * 外部 3D 資源載入（T034）。目前產品模型以程式產生（products/），這裡保留 glTF 載入路徑，
 * 之後換成 Blender 製作的 .glb 時使用。載入器與解碼器都延遲載入，同一網址只下載一次。
 */
const gltfCache = new Map<string, Promise<Group>>();

export function loadGLTF(url: string, renderer: WebGLRenderer): Promise<Group> {
  const hit = gltfCache.get(url);
  if (hit) return hit.then((g) => g.clone(true));

  const task = (async () => {
    const [{ GLTFLoader }, { MeshoptDecoder }, { KTX2Loader }] = await Promise.all([
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/libs/meshopt_decoder.module.js'),
      import('three/examples/jsm/loaders/KTX2Loader.js'),
    ]);
    const ktx2 = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer);
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx2);
    const gltf = await loader.loadAsync(url);
    return gltf.scene;
  })();

  gltfCache.set(url, task);
  task.catch(() => gltfCache.delete(url));
  return task.then((g) => g.clone(true));
}
