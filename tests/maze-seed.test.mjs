import test from 'node:test'
import assert from 'node:assert/strict'

import { createMaze } from '../src/world/index.js'

function signature(maze) {
  return {
    size: maze.size,
    seed: maze.seed,
    loopRate: maze.loopRate,
    entrance: {
      row: maze.entrance.row,
      col: maze.entrance.col,
      world: maze.entrance.world,
    },
    cells: maze.cells.map((row) =>
      row.map((cell) => ({
        row: cell.row,
        col: cell.col,
        walls: { ...cell.walls },
        region: cell.region,
        depth: cell.depth,
        isAtrium: Boolean(cell.isAtrium),
      })),
    ),
    spawnPoints: maze.spawnPoints.map((spawn) => ({
      id: spawn.id,
      index: spawn.index,
      row: spawn.row,
      col: spawn.col,
      region: spawn.region,
      depth: spawn.depth,
      position: { ...spawn.position },
    })),
  }
}

function assertReachable(maze) {
  const unreachable = maze.cells
    .flat()
    .filter((cell) => !cell.isAtrium && cell.depth === null)
    .map((cell) => `${cell.row}:${cell.col}`)
  assert.deepEqual(unreachable, [], 'every non-atrium cell must be reachable')
}

test('maze specification is finalized at 15 x 15', () => {
  const maze = createMaze({ seed: 20261205 })
  assert.equal(maze.size, 15)
  assert.equal(maze.cells.length, 15)
  assert.equal(maze.cells[0].length, 15)
  assert.equal(maze.cells.flat().length, 225)
  assert.equal(maze.entrance.row, 14)
  assert.equal(maze.entrance.col, 7)
  assertReachable(maze)
})

test('the same seed produces the same maze, walls, regions and fire sites', () => {
  const first = createMaze({ seed: 20261205, loopRate: 0.12 })
  const second = createMaze({ seed: 20261205, loopRate: 0.12 })
  assert.deepEqual(signature(first), signature(second))
})

test('different seeds produce different maze layouts', () => {
  const first = signature(createMaze({ seed: 20261205 }))
  const second = signature(createMaze({ seed: 20261206 }))
  assert.notDeepEqual(first.cells, second.cells)
})

test('seeded generation keeps three reachable fire sites across seeds', () => {
  for (let seed = 1; seed <= 100; seed += 1) {
    const maze = createMaze({ seed })
    assert.equal(maze.spawnPoints.length, 3, `seed ${seed}: fire count`)
    assert.equal(
      new Set(maze.spawnPoints.map((spawn) => spawn.region)).size,
      3,
      `seed ${seed}: fire regions`,
    )
    assertReachable(maze)
  }
})
