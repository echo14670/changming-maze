/**
 * Canvas 2D 小地图 + 迷雾（UI 层，张洋）。
 *
 * - 15×15 格，按行走记录逐步驱散迷雾（当前格 + 相邻 8 格）；
 * - 已探索格按区域色绘制地面与墙体；
 * - 玩家位置 / 朝向箭头；灯塔大门与入口常显；
 * - 火种按接口约定只在 6m 内显示图标，已拾取的不再绘制；
 * - 绘制节流（约 8fps），不进入 three.js 渲染循环，无额外 draw call。
 */

const MAP_CSS_SIZE = 168
const DPR_SCALE = 2
const REDRAW_INTERVAL = 0.12
const SEED_MARKER_RANGE = 6
const REVEAL_RADIUS = 1

function regionFill(region) {
  switch (region?.id) {
    case 'water':
      return 'rgba(85, 122, 120, 0.34)'
    case 'ember':
      return 'rgba(141, 102, 87, 0.34)'
    case 'atrium':
      return 'rgba(184, 169, 135, 0.4)'
    default:
      return 'rgba(135, 149, 143, 0.3)'
  }
}

export function createMinimap(options) {
  const { state, world, cameraRig, fireSeeds } = options
  if (!state || !world || !cameraRig) {
    throw new Error('createMinimap: missing required dependencies')
  }

  const maze = world.maze
  const size = maze?.size ?? 15
  const scale = MAP_CSS_SIZE / size
  const visited = new Uint8Array(size * size)

  const container = document.createElement('div')
  container.id = 'minimap'
  container.setAttribute('aria-hidden', 'true')

  const canvas = document.createElement('canvas')
  // 只设位图分辨率；显示尺寸交给 CSS，窄屏媒体查询才能生效
  canvas.width = MAP_CSS_SIZE * DPR_SCALE
  canvas.height = MAP_CSS_SIZE * DPR_SCALE
  container.appendChild(canvas)

  const label = document.createElement('span')
  label.className = 'minimap-label'
  label.textContent = '石阵舆图'
  container.appendChild(label)

  const hudRoot = document.querySelector('#hud')
  hudRoot?.appendChild(container)

  const context = canvas.getContext('2d')
  context.setTransform(DPR_SCALE, 0, 0, DPR_SCALE, 0, 0)

  let redrawTimer = 0

  function helpers() {
    return globalThis.Changming?.MazeConfig?.helpers
  }

  function cellIndex(row, col) {
    return row * size + col
  }

  function reveal(row, col) {
    for (let dr = -REVEAL_RADIUS; dr <= REVEAL_RADIUS; dr += 1) {
      for (let dc = -REVEAL_RADIUS; dc <= REVEAL_RADIUS; dc += 1) {
        const r = row + dr
        const c = col + dc
        if (r < 0 || r >= size || c < 0 || c >= size) continue
        visited[cellIndex(r, c)] = 1
      }
    }
  }

  function playerCell() {
    const position = cameraRig.getPosition()
    const cell = helpers()?.worldToCell?.(position.x, position.z)
    if (!cell) return null
    // inside 表示玩家确实站在网格内；网格外（入口石道、海岛）只画箭头不揭示迷雾
    const inside = cell.row >= 0 && cell.row < size && cell.col >= 0 && cell.col < size
    return {
      row: Math.max(0, Math.min(size - 1, cell.row)),
      col: Math.max(0, Math.min(size - 1, cell.col)),
      inside,
      position,
    }
  }

  function drawWalls(cell, x, y) {
    const walls = cell?.walls
    if (!walls) return
    context.strokeStyle = 'rgba(214, 200, 172, 0.68)'
    context.lineWidth = 1
    context.beginPath()
    if (walls.n) {
      context.moveTo(x, y)
      context.lineTo(x + scale, y)
    }
    if (walls.s) {
      context.moveTo(x, y + scale)
      context.lineTo(x + scale, y + scale)
    }
    if (walls.w) {
      context.moveTo(x, y)
      context.lineTo(x, y + scale)
    }
    if (walls.e) {
      context.moveTo(x + scale, y)
      context.lineTo(x + scale, y + scale)
    }
    context.stroke()
  }

  function cellCenter(row, col) {
    return { x: (col + 0.5) * scale, y: (row + 0.5) * scale }
  }

  function drawMarker(x, y, color, radius) {
    context.fillStyle = color
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()
  }

  function draw() {
    const map = playerCell()
    context.clearRect(0, 0, MAP_CSS_SIZE, MAP_CSS_SIZE)
    context.fillStyle = 'rgba(4, 10, 13, 0.78)'
    context.fillRect(0, 0, MAP_CSS_SIZE, MAP_CSS_SIZE)

    // 迷雾：只绘制已探索格
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (!visited[cellIndex(row, col)]) continue
        const region = world.getRegionAtCell?.(row, col)
        const x = col * scale
        const y = row * scale
        context.fillStyle = regionFill(region)
        context.fillRect(x, y, scale, scale)
        drawWalls(maze.cells?.[row]?.[col], x, y)
      }
    }

    // 入口（常显）
    const entrance = world.entrance?.cell
    if (entrance) {
      const point = cellCenter(entrance.row, entrance.col)
      drawMarker(point.x, point.y, 'rgba(159, 176, 181, 0.75)', 2)
    }

    // 灯塔大门（常显目标）
    const doorCell = helpers()?.worldToCell?.(
      world.lighthouseDoor?.position?.x ?? 0,
      world.lighthouseDoor?.position?.z ?? 0,
    )
    if (doorCell) {
      const point = cellCenter(doorCell.row, doorCell.col)
      drawMarker(point.x, point.y, 'rgba(255, 209, 114, 0.9)', 2.6)
      context.strokeStyle = 'rgba(255, 209, 114, 0.45)'
      context.lineWidth = 1
      context.beginPath()
      context.arc(point.x, point.y, 5, 0, Math.PI * 2)
      context.stroke()
    }

    // 火种：只在 6m 内显示图标，已拾取不画
    if (map && fireSeeds?.seeds) {
      for (const seed of fireSeeds.seeds) {
        if (seed.collected) continue
        const target = seed.getPosition()
        const dx = target.x - map.position.x
        const dz = target.z - map.position.z
        if (Math.hypot(dx, dz) > SEED_MARKER_RANGE) continue
        const point = cellCenter(seed.grid.row, seed.grid.col)
        drawMarker(point.x, point.y, 'rgba(255, 140, 60, 0.95)', 2.4)
      }
    }

    // 玩家箭头
    if (map) {
      const point = cellCenter(map.row, map.col)
      const { yaw } = cameraRig.getLook()
      const dirX = -Math.sin(yaw)
      const dirY = -Math.cos(yaw)
      const angle = Math.atan2(dirY, dirX)
      context.save()
      context.translate(point.x, point.y)
      context.rotate(angle)
      context.fillStyle = '#f6e7c8'
      context.beginPath()
      context.moveTo(4.6, 0)
      context.lineTo(-3.2, -3)
      context.lineTo(-3.2, 3)
      context.closePath()
      context.fill()
      context.restore()
    }
  }

  function update(dt) {
    if (state.phase !== 'playing') return
    const map = playerCell()
    if (map?.inside) reveal(map.row, map.col)
    redrawTimer += dt
    if (redrawTimer >= REDRAW_INTERVAL) {
      redrawTimer = 0
      draw()
    }
  }

  // 初始帧先画一次底图，避免标题结束后小地图空白
  draw()

  return {
    update,
    getVisitedCount: () => visited.reduce((total, cell) => total + cell, 0),
    dispose() {
      container.remove()
    },
  }
}
