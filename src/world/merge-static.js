(function (global) {
  'use strict';

  const Changming = (global.Changming = global.Changming || {});

  function mergeStaticMeshes(THREE, root) {
    root.updateWorldMatrix(true, true);
    const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const candidates = [];

    root.traverse(function (object) {
      if (!object.isMesh || object.isInstancedMesh || object.isSkinnedMesh) return;
      if (object.userData.noMerge || isBelowNoMerge(object, root)) return;
      if (!object.geometry || Array.isArray(object.material)) return;
      if (!object.material || object.material.transparent) return;
      if (
        object.material.isShaderMaterial ||
        object.material.isSpriteMaterial
      ) {
        return;
      }
      const attributes = object.geometry.attributes;
      if (!attributes || !attributes.position) return;
      candidates.push(object);
    });

    const buckets = new Map();
    candidates.forEach(function (mesh) {
      const attributes = mesh.geometry.attributes;
      const signature = [
        mesh.material.uuid,
        mesh.castShadow ? 1 : 0,
        mesh.receiveShadow ? 1 : 0,
        mesh.renderOrder || 0,
        attributes.normal ? 1 : 0,
        attributes.uv ? 1 : 0,
        attributes.color ? 1 : 0
      ].join(':');
      if (!buckets.has(signature)) {
        buckets.set(signature, []);
      }
      buckets.get(signature).push(mesh);
    });

    let before = 0;
    let after = 0;
    buckets.forEach(function (meshes) {
      before += meshes.length;
      if (meshes.length < 2) {
        after += meshes.length;
        return;
      }
      const merged = mergeBucket(THREE, root, rootInverse, meshes);
      if (!merged) {
        after += meshes.length;
        return;
      }
      after += 1;
    });

    return {
      inputMeshes: before,
      outputMeshes: after,
      removedCalls: Math.max(0, before - after)
    };
  }

  function isBelowNoMerge(object, root) {
    let current = object;
    while (current && current !== root) {
      if (current.userData.noMerge) return true;
      current = current.parent;
    }
    return false;
  }

  function mergeBucket(THREE, root, rootInverse, meshes) {
    const transformed = [];
    let positionCount = 0;
    for (let i = 0; i < meshes.length; i += 1) {
      const mesh = meshes[i];
      mesh.updateWorldMatrix(true, false);
      let geometry = mesh.geometry.clone();
      if (geometry.index) {
        const nonIndexed = geometry.toNonIndexed();
        geometry.dispose();
        geometry = nonIndexed;
      }
      if (!geometry.attributes.normal) geometry.computeVertexNormals();
      const matrix = new THREE.Matrix4().multiplyMatrices(
        rootInverse,
        mesh.matrixWorld
      );
      geometry.applyMatrix4(matrix);
      transformed.push(geometry);
      positionCount += geometry.attributes.position.count;
    }

    if (!positionCount) return null;
    const hasNormal = transformed.every(function (geometry) {
      return !!geometry.attributes.normal;
    });
    const hasUv = transformed.every(function (geometry) {
      return !!geometry.attributes.uv;
    });
    const hasColor = transformed.every(function (geometry) {
      return !!geometry.attributes.color;
    });

    const positions = new Float32Array(positionCount * 3);
    const normals = hasNormal ? new Float32Array(positionCount * 3) : null;
    const uvs = hasUv ? new Float32Array(positionCount * 2) : null;
    const colors = hasColor ? new Float32Array(positionCount * 3) : null;
    let positionOffset = 0;
    let uvOffset = 0;
    let colorOffset = 0;

    transformed.forEach(function (geometry) {
      const position = geometry.attributes.position.array;
      positions.set(position, positionOffset * 3);
      if (normals) {
        normals.set(geometry.attributes.normal.array, positionOffset * 3);
      }
      if (uvs) {
        uvs.set(geometry.attributes.uv.array, uvOffset * 2);
      }
      if (colors) {
        colors.set(geometry.attributes.color.array, colorOffset * 3);
      }
      positionOffset += geometry.attributes.position.count;
      if (uvs) uvOffset += geometry.attributes.uv.count;
      if (colors) colorOffset += geometry.attributes.color.count;
      geometry.dispose();
    });

    const mergedGeometry = new THREE.BufferGeometry();
    mergedGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    );
    if (normals) {
      mergedGeometry.setAttribute(
        'normal',
        new THREE.BufferAttribute(normals, 3)
      );
    }
    if (uvs) {
      mergedGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    }
    if (colors) {
      mergedGeometry.setAttribute(
        'color',
        new THREE.BufferAttribute(colors, 3)
      );
    }
    mergedGeometry.computeBoundingBox();
    mergedGeometry.computeBoundingSphere();

    const first = meshes[0];
    const mergedMesh = new THREE.Mesh(mergedGeometry, first.material);
    mergedMesh.name = 'StaticBatch-' + (first.material.name || first.material.uuid);
    mergedMesh.castShadow = first.castShadow;
    mergedMesh.receiveShadow = first.receiveShadow;
    mergedMesh.renderOrder = first.renderOrder;
    mergedMesh.userData.staticBatch = true;
    root.add(mergedMesh);

    meshes.forEach(function (mesh) {
      if (mesh.parent) mesh.parent.remove(mesh);
      mesh.geometry.dispose();
    });
    return mergedMesh;
  }

  Changming.mergeStaticMeshes = mergeStaticMeshes;
})(typeof window !== 'undefined' ? window : globalThis);
