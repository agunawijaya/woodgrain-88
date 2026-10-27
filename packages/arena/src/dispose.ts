/**
 * Frees everything a subtree holds on the GPU. A game that leaves for the
 * Hall must give back its geometries, materials and generated textures, or
 * every visit to the game would leak a little more video memory.
 */
import { Mesh, Texture, type Material, type Object3D } from 'three';

export function disposeTree(root: Object3D): void {
  const materials = new Set<Material>();
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const mesh = node as Mesh;
    mesh.geometry.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
    }
  });
  for (const material of materials) disposeMaterial(material);
  root.removeFromParent();
}

/** Disposes a material and every texture it references. */
export function disposeMaterial(material: Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof Texture) value.dispose();
  }
  material.dispose();
}
