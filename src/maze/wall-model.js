(function (global) {
  'use strict';

  const Changming = (global.Changming = global.Changming || {});
  const config = Changming.MazeConfig;
  const helpers = config.helpers;

  function collectWallSegments(maze) {
    const segments = [];
    const half = config.cellSize / 2;
    const ext = config.cellSize + config.wallThickness;

    function add(row, col, side) {
      const world = helpers.cellToWorld(row, col);
      if (side === 'n') {
        segments.push({
          row,
          col,
          side,
          axis: 'x',
          x: world.x,
          z: world.z - half,
          length: ext,
          depth: config.wallThickness,
          region: helpers.regionIdAtCell(row, col)
        });
      } else if (side === 's') {
        segments.push({
          row,
          col,
          side,
          axis: 'x',
          x: world.x,
          z: world.z + half,
          length: ext,
          depth: config.wallThickness,
          region: helpers.regionIdAtCell(row, col)
        });
      } else if (side === 'w') {
        segments.push({
          row,
          col,
          side,
          axis: 'z',
          x: world.x - half,
          z: world.z,
          length: ext,
          depth: config.wallThickness,
          region: helpers.regionIdAtCell(row, col)
        });
      } else {
        segments.push({
          row,
          col,
          side,
          axis: 'z',
          x: world.x + half,
          z: world.z,
          length: ext,
          depth: config.wallThickness,
          region: helpers.regionIdAtCell(row, col)
        });
      }
    }

    for (let row = 0; row < maze.size; row += 1) {
      for (let col = 0; col < maze.size; col += 1) {
        const cell = maze.cells[row][col];
        if (cell.walls.n) add(row, col, 'n');
        if (cell.walls.w) add(row, col, 'w');
        if (row === maze.size - 1 && cell.walls.s) add(row, col, 's');
        if (col === maze.size - 1 && cell.walls.e) add(row, col, 'e');
      }
    }
    return segments;
  }

  function segmentBounds(segment) {
    const horizontal = segment.axis === 'x';
    const hx = horizontal ? segment.length / 2 : segment.depth / 2;
    const hz = horizontal ? segment.depth / 2 : segment.length / 2;
    return {
      minX: segment.x - hx,
      maxX: segment.x + hx,
      minZ: segment.z - hz,
      maxZ: segment.z + hz,
      minY: 0,
      maxY: config.wallHeight
    };
  }

  Changming.WallModel = Object.freeze({
    collectWallSegments,
    segmentBounds
  });
})(typeof window !== 'undefined' ? window : globalThis);
