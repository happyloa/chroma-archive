import { Group, Mesh, MeshStandardMaterial, type Object3D } from 'three';

/**
 * 使用者上傳的 3D 模型（US-11）。檔案只在瀏覽器裡解析，不會上傳或儲存到伺服器。
 * 支援自成一檔的格式：.glb、.gltf（資源需內嵌）、.obj、.stl。
 */
export const ACCEPTED_EXTENSIONS = ['.glb', '.gltf', '.obj', '.stl'] as const;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export class UploadError extends Error {}

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i).toLowerCase();
}

export async function parseModelFile(file: File): Promise<Group> {
  const ext = extensionOf(file.name);
  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new UploadError(`不支援 ${ext || '這種'} 檔案，請使用 ${ACCEPTED_EXTENSIONS.join('、')}`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(`檔案超過 ${MAX_UPLOAD_BYTES / 1024 / 1024} MB 上限`);
  }

  let root: Object3D;
  if (ext === '.glb' || ext === '.gltf') {
    const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/libs/meshopt_decoder.module.js'),
    ]);
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const data = ext === '.glb' ? await file.arrayBuffer() : await file.text();
    try {
      const gltf = await loader.parseAsync(data, '');
      root = gltf.scene;
    } catch (e) {
      const message = String((e as Error)?.message ?? e);
      if (/draco/i.test(message))
        throw new UploadError('不支援 Draco 壓縮的模型，請改用未壓縮或 Meshopt 壓縮的檔案');
      throw new UploadError(
        '無法讀取這個 glTF 檔。.gltf 必須把貼圖與 bin 內嵌在檔案裡，建議改用 .glb',
      );
    }
  } else if (ext === '.obj') {
    const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
    root = new OBJLoader().parse(await file.text());
  } else {
    const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
    const geometry = new STLLoader().parse(await file.arrayBuffer());
    geometry.computeVertexNormals();
    root = new Mesh(geometry, new MeshStandardMaterial());
  }

  const group = new Group();
  group.add(root);
  let meshes = 0;
  group.traverse((o) => {
    if (o instanceof Mesh) meshes += 1;
  });
  if (!meshes) throw new UploadError('檔案裡沒有可顯示的模型');
  group.updateMatrixWorld(true);
  return group;
}

/** 換上我們的材質前，先釋放模型原本的材質與貼圖 */
export function releaseOriginalMaterials(mesh: Mesh): void {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const m of mats) {
    for (const value of Object.values(m)) {
      if (value && typeof value === 'object' && 'isTexture' in value) {
        (value as { dispose(): void }).dispose();
      }
    }
    m.dispose();
  }
}

/** 釋放上傳模型的幾何（材質是視窗共用的，不在這裡釋放） */
export function disposeGeometries(root: Object3D): void {
  root.traverse((o) => {
    if (o instanceof Mesh) o.geometry.dispose();
  });
}
