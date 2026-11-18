(function (global) {
  'use strict';

  const Changming = (global.Changming = global.Changming || {});
  Changming.assetManifest = Object.freeze({
    schemaVersion: 1,
    project: '长明：雾海迷宫',
    owner: 'B',
    generatedAt: '2026-11-17',
    dependency: {
      three: {
        version: '0.187.0',
        license: 'MIT',
        module: 'three'
      }
    },
    assets: [
      {
        id: 'texture.stone',
        type: 'procedural-texture',
        source: 'src/world/materials.js',
        license: 'project-original',
        fallback: null
      },
      {
        id: 'texture.moss-stone',
        type: 'procedural-texture',
        source: 'src/world/materials.js',
        license: 'project-original',
        fallback: null
      },
      {
        id: 'texture.brick',
        type: 'procedural-texture',
        source: 'src/world/materials.js',
        license: 'project-original',
        fallback: null
      },
      {
        id: 'texture.marble',
        type: 'procedural-texture',
        source: 'src/world/materials.js',
        license: 'project-original',
        fallback: null
      },
      {
        id: 'texture.wood',
        type: 'procedural-texture',
        source: 'src/world/materials.js',
        license: 'project-original',
        fallback: null
      },
      {
        id: 'model.obelisk',
        type: 'procedural-geometry',
        source: 'src/world/landmarks.js',
        license: 'project-original',
        fallback: 'primitive-cylinder',
        overridePolicy: 'base64-glb'
      },
      {
        id: 'model.sentinel',
        type: 'procedural-geometry',
        source: 'src/world/landmarks.js',
        license: 'project-original',
        fallback: 'primitive-capsule',
        overridePolicy: 'base64-glb'
      },
      {
        id: 'model.crate',
        type: 'procedural-geometry',
        source: 'src/world/landmarks.js',
        license: 'project-original',
        fallback: 'primitive-box',
        overridePolicy: 'base64-glb'
      },
      {
        id: 'model.broken-hull',
        type: 'procedural-geometry',
        source: 'src/world/island.js',
        license: 'project-original',
        fallback: 'primitive-planks',
        overridePolicy: 'base64-glb'
      }
    ],
    externalAssetsLoaded: 0,
    notes: [
      '所有运行时纹理与场景模型均由项目代码生成。',
      '若后续替换为 GLB，必须保持 id 不变，并同步更新 LICENSES.md。',
      'file:// 交付版本不得在运行时 fetch 外部资源。'
    ]
  });
})(typeof window !== 'undefined' ? window : globalThis);
