(function (global) {
  'use strict';

  const Changming = (global.Changming = global.Changming || {});
  const config = Changming.MazeConfig;
  const helpers = config.helpers;
  const createRandom = Changming.Random.createRandom;
  const shuffle = Changming.Random.shuffle;

  const DIRECTIONS = [
    { id: 'n', dr: -1, dc: 0, opposite: 's' },
    { id: 'e', dr: 0, dc: 1, opposite: 'w' },
    { id: 's', dr: 1, dc: 0, opposite: 'n' },
    { id: 'w', dr: 0, dc: -1, opposite: 'e' }
  ];

  function inBounds(row, col) {
    return (
      row >= 0 && row < config.size && col >= 0 && col < config.size
    );
  }

  function key(row, col) {
    return row + ':' + col;
  }

  function cellAt(maze, row, col) {
    if (!inBounds(row, col)) return null;
    return maze.cells[row][col];
  }

  function removeWall(maze, row, col, direction) {
    const cell = cellAt(maze, row, col);
    if (!cell || !cell.walls[direction.id]) return false;
    cell.walls[direction.id] = false;
    const neighbor = cellAt(maze, row + direction.dr, col + direction.dc);
    if (neighbor) neighbor.walls[direction.opposite] = false;
    return true;
  }

  function buildBaseGrid() {
    return Array.from({ length: config.size }, function (_, row) {
      return Array.from({ length: config.size }, function (_, col) {
        return {
          row,
          col,
          walls: { n: true, e: true, s: true, w: true },
          region: helpers.regionIdAtCell(row, col),
          depth: 0
        };
      });
    });
  }

  function carveAtrium(maze) {
    const atrium = config.atrium;
    for (let row = atrium.rowMin; row <= atrium.rowMax; row += 1) {
      for (let col = atrium.colMin; col <= atrium.colMax; col += 1) {
        const cell = maze.cells[row][col];
        cell.isAtrium = true;
        if (row > atrium.rowMin) removeWall(maze, row, col, DIRECTIONS[0]);
        if (col < atrium.colMax) removeWall(maze, row, col, DIRECTIONS[1]);
      }
    }

    // Keep four ceremonial approaches and a clear visual axis to the entrance.
    for (let row = atrium.rowMax; row <= config.entrance.row; row += 1) {
      removeWall(maze, row, config.entrance.col, DIRECTIONS[0]);
    }
  }

  function addLoops(maze, random, rate) {
    const candidates = [];
    for (let row = 0; row < config.size; row += 1) {
      for (let col = 0; col < config.size; col += 1) {
        if (
          row < config.size - 1 &&
          maze.cells[row][col].walls.s &&
          !(row + 1 >= config.atrium.rowMin &&
            row + 1 <= config.atrium.rowMax &&
            col >= config.atrium.colMin &&
            col <= config.atrium.colMax)
        ) {
          candidates.push({ row, col, direction: DIRECTIONS[2] });
        }
        if (col < config.size - 1 && maze.cells[row][col].walls.e) {
          candidates.push({ row, col, direction: DIRECTIONS[1] });
        }
      }
    }

    const target = Math.round(candidates.length * rate);
    const pool = shuffle(candidates, random);
    for (let i = 0; i < target && i < pool.length; i += 1) {
      const item = pool[i];
      removeWall(maze, item.row, item.col, item.direction);
    }
  }

  function computeDepths(maze, startRow, startCol) {
    const start = maze.cells[startRow][startCol];
    start.depth = 0;
    const queue = [start];
    let head = 0;
    while (head < queue.length) {
      const cell = queue[head++];
      for (let i = 0; i < DIRECTIONS.length; i += 1) {
        const direction = DIRECTIONS[i];
        if (cell.walls[direction.id]) continue;
        const neighbor = cellAt(
          maze,
          cell.row + direction.dr,
          cell.col + direction.dc
        );
        if (!neighbor || neighbor.depth !== null) continue;
        neighbor.depth = cell.depth + 1;
        neighbor.parent = { row: cell.row, col: cell.col };
        queue.push(neighbor);
      }
    }
  }

  function countOpenWalls(cell) {
    return DIRECTIONS.reduce(function (total, direction) {
      return total + (cell.walls[direction.id] ? 0 : 1);
    }, 0);
  }

  function chooseSpawnCells(maze, random) {
    const byRegion = { courtyard: [], water: [], ember: [] };
    for (let row = 0; row < config.size; row += 1) {
      for (let col = 0; col < config.size; col += 1) {
        const cell = maze.cells[row][col];
        if (
          cell.isAtrium ||
          cell.region === 'atrium' ||
          cell.row === config.entrance.row
        ) {
          continue;
        }
        if (countOpenWalls(cell) <= 2) {
          byRegion[cell.region].push(cell);
        }
      }
    }

    Object.keys(byRegion).forEach(function (regionId) {
      byRegion[regionId].sort(function (a, b) {
        return b.depth - a.depth || a.col - b.col;
      });
    });

    const chosen = [];
    ['water', 'ember', 'courtyard'].forEach(function (regionId) {
      const bucket = byRegion[regionId];
      let cell = bucket[0] || null;
      if (!cell) {
        let best = null;
        for (let row = 0; row < config.size; row += 1) {
          for (let col = 0; col < config.size; col += 1) {
            const candidate = maze.cells[row][col];
            if (candidate.region !== regionId || candidate.isAtrium) continue;
            if (!best || candidate.depth > best.depth) best = candidate;
          }
        }
        cell = best;
      }
      if (cell) chosen.push(cell);
    });

    // Enforce a minimum visual separation if a random map creates two close ends.
    for (let i = 0; i < chosen.length; i += 1) {
      for (let j = i + 1; j < chosen.length; j += 1) {
        if (
          Math.abs(chosen[i].row - chosen[j].row) +
            Math.abs(chosen[i].col - chosen[j].col) <
          4
        ) {
          const bucket = byRegion[chosen[j].region];
          const alternative = bucket.find(function (candidate) {
            return (
              Math.abs(candidate.row - chosen[i].row) +
                Math.abs(candidate.col - chosen[i].col) >=
              5
            );
          });
          if (alternative) chosen[j] = alternative;
        }
      }
    }

    return chosen.map(function (cell, index) {
      const world = helpers.cellToWorld(cell.row, cell.col);
      return {
        id: 'ember-spawn-' + (index + 1),
        index,
        row: cell.row,
        col: cell.col,
        region: cell.region,
        depth: cell.depth,
        position: { x: world.x, y: 0.95, z: world.z }
      };
    });
  }

  function generateMaze(options) {
    const settings = Object.assign(
      {
        seed: config.defaultSeed,
        loopRate: config.loopRate
      },
      options || {}
    );
    const random = createRandom(settings.seed);
    const maze = {
      size: config.size,
      seed: settings.seed,
      loopRate: settings.loopRate,
      cells: buildBaseGrid(),
      wallsRemoved: 0,
      entrance: Object.assign({}, config.entrance)
    };

    const visited = new Set();
    const start = maze.cells[Math.floor(config.size / 2)][
      Math.floor(config.size / 2)
    ];
    const stack = [start];
    visited.add(key(start.row, start.col));

    while (stack.length) {
      const cell = stack[stack.length - 1];
      const candidates = shuffle(DIRECTIONS, random).filter(function (direction) {
        return (
          inBounds(cell.row + direction.dr, cell.col + direction.dc) &&
          !visited.has(
            key(cell.row + direction.dr, cell.col + direction.dc)
          )
        );
      });

      if (!candidates.length) {
        stack.pop();
        continue;
      }

      const direction = candidates[0];
      const next = maze.cells[cell.row + direction.dr][
        cell.col + direction.dc
      ];
      removeWall(maze, cell.row, cell.col, direction);
      maze.wallsRemoved += 1;
      visited.add(key(next.row, next.col));
      stack.push(next);
    }

    carveAtrium(maze);
    addLoops(maze, random, settings.loopRate);

    // The start is the hole in the south perimeter.
    const entranceCell = maze.cells[config.entrance.row][config.entrance.col];
    entranceCell.walls.s = false;
    maze.entrance.world = helpers.cellToWorld(
      config.entrance.row,
      config.entrance.col
    );

    for (let row = 0; row < config.size; row += 1) {
      for (let col = 0; col < config.size; col += 1) {
        maze.cells[row][col].depth = null;
        maze.cells[row][col].parent = null;
        maze.cells[row][col].region = helpers.regionIdAtCell(row, col);
      }
    }
    computeDepths(maze, config.entrance.row, config.entrance.col);
    maze.spawnPoints = chooseSpawnCells(maze, random);
    maze.random = random;
    return maze;
  }

  Changming.MazeGenerator = Object.freeze({
    DIRECTIONS,
    generate: generateMaze,
    inBounds,
    cellAt,
    countOpenWalls
  });
})(typeof window !== 'undefined' ? window : globalThis);
