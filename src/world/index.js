import * as THREE from 'three'

// B 模块最初以 `file://` 独立的 IIFE 形式开发。这里保留现有生成逻辑，
// 按依赖顺序装载，并在正式 esbuild 入口中提供 ESM 适配层。
import '../maze/config.js'
import '../maze/random.js'
import './atmosphere-legacy.js'
import '../maze/dfs-maze.js'
import '../maze/wall-model.js'
import '../maze/collision.js'
import './materials.js'
import './lighthouse.js'
import './island.js'
import './ocean.js'
import './maze-mesh.js'
import './landmarks.js'
import './merge-static.js'
import './world-builder.js'

function getNamespace() {
  const namespace = globalThis.Changming
  if (!namespace?.buildWorld) {
    throw new Error('B 世界模块初始化失败：缺少 Changming.buildWorld')
  }
  return namespace
}

/**
 * 创建迷宫、露天石阵、灯塔、礁岛与外海。
 *
 * @param {{
 *   scene: import('three').Scene,
 *   seed?: number,
 *   renderer?: import('three').WebGLRenderer,
 *   quality?: string,
 * }} options
 */
export function createWorld(options) {
  if (!options?.scene) throw new Error('createWorld: scene is required')
  globalThis.THREE = THREE
  const namespace = getNamespace()
  return namespace.buildWorld(THREE, options.scene, {
    seed: options.seed,
    renderer: options.renderer,
    quality: options.quality,
    exposeGlobally: true,
  })
}

export function createMaze(options = {}) {
  return getNamespace().MazeGenerator.generate(options)
}

export function createWorldAtmosphere(scene, renderer, options = {}) {
  globalThis.THREE = THREE
  const namespace = getNamespace()
  if (typeof namespace.createPreviewAtmosphere !== 'function') {
    throw new Error('B 氛围模块初始化失败：缺少 createPreviewAtmosphere')
  }
  return namespace.createPreviewAtmosphere(THREE, scene, renderer, options)
}

export function buildMazeMesh(options) {
  if (!options?.maze || !options?.materials || !options?.group) {
    throw new Error('buildMazeMesh: maze, materials and group are required')
  }
  return getNamespace().buildMazeGeometry(
    THREE,
    options.maze,
    options.materials,
    options,
  )
}
