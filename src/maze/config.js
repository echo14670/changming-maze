(function (global) {
  'use strict';

  const Changming = (global.Changming = global.Changming || {});
  const size = 15;
  const cellSize = 4;

  const regions = Object.freeze({
    courtyard: Object.freeze({
      id: 'courtyard',
      name: '外庭',
      subtitle: '风蚀石阶',
      color: '#87958f',
      glow: '#d8b16a',
      fog: '#17221f'
    }),
    water: Object.freeze({
      id: 'water',
      name: '水院',
      subtitle: '潮痕苔井',
      color: '#557a78',
      glow: '#7bd4c5',
      fog: '#12252a'
    }),
    ember: Object.freeze({
      id: 'ember',
      name: '烬厅',
      subtitle: '赤砖余火',
      color: '#8d6657',
      glow: '#f28b4b',
      fog: '#251915'
    }),
    atrium: Object.freeze({
      id: 'atrium',
      name: '中庭',
      subtitle: '长明之门',
      color: '#b8a987',
      glow: '#ffd172',
      fog: '#211d18'
    })
  });

  const config = {
    size,
    cellSize,
    wallHeight: 4.5,
    wallThickness: 0.62,
    defaultSeed: 20261205,
    loopRate: 0.12,
    corridorLoopMin: 8,
    atrium: Object.freeze({
      rowMin: 6,
      rowMax: 8,
      colMin: 6,
      colMax: 8,
      floorHeight: 0.6,
      approachDepth: 2.2,
      stepCount: 5
    }),
    entrance: Object.freeze({
      row: size - 1,
      col: Math.floor(size / 2)
    }),
    regions
  };

  function cellToWorld(row, col, y) {
    return {
      x: (col - (size - 1) / 2) * cellSize,
      y: y == null ? 0 : y,
      z: (row - (size - 1) / 2) * cellSize
    };
  }

  function worldToCell(x, z) {
    return {
      row: Math.round(z / cellSize + (size - 1) / 2),
      col: Math.round(x / cellSize + (size - 1) / 2)
    };
  }

  function isInAtrium(row, col) {
    return (
      row >= config.atrium.rowMin &&
      row <= config.atrium.rowMax &&
      col >= config.atrium.colMin &&
      col <= config.atrium.colMax
    );
  }

  function regionIdAtCell(row, col) {
    if (isInAtrium(row, col)) return 'atrium';
    if (
      row === config.atrium.rowMax + 1 &&
      col >= config.atrium.colMin &&
      col <= config.atrium.colMax
    ) {
      return 'atrium';
    }
    if (row >= 10) return 'courtyard';
    if (col < 7) return 'water';
    if (col > 7) return 'ember';
    return 'courtyard';
  }

  function regionIdAtWorld(x, z) {
    const cell = worldToCell(x, z);
    if (
      cell.row < 0 ||
      cell.row >= size ||
      cell.col < 0 ||
      cell.col >= size
    ) {
      return 'courtyard';
    }
    return regionIdAtCell(cell.row, cell.col);
  }

  config.helpers = Object.freeze({
    cellToWorld,
    worldToCell,
    isInAtrium,
    regionIdAtCell,
    regionIdAtWorld
  });
  Object.freeze(config);
  Changming.MazeConfig = config;
})(typeof window !== 'undefined' ? window : globalThis);
