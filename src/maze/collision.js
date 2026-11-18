(function (global) {
  'use strict';

  const Changming = (global.Changming = global.Changming || {});
  const config = Changming.MazeConfig;
  const WallModel = Changming.WallModel;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  class CollisionWorld {
    constructor(maze, options) {
      const settings = options || {};
      this.maze = maze;
      this.boxes = WallModel.collectWallSegments(maze).map(function (segment) {
        const bounds = WallModel.segmentBounds(segment);
        bounds.kind = 'wall';
        bounds.region = segment.region;
        return bounds;
      });
      this.circles = [];
      this.island = settings.island || null;
      this.extra = [];
    }

    addCircle(x, z, radius, metadata) {
      const collider = Object.assign(
        { kind: 'circle', x, z, radius },
        metadata || {}
      );
      this.circles.push(collider);
      return collider;
    }

    addBox(bounds, metadata) {
      const collider = Object.assign(
        {
          minX: Math.min(bounds.minX, bounds.maxX),
          maxX: Math.max(bounds.minX, bounds.maxX),
          minZ: Math.min(bounds.minZ, bounds.maxZ),
          maxZ: Math.max(bounds.minZ, bounds.maxZ),
          kind: 'prop'
        },
        metadata || {}
      );
      this.boxes.push(collider);
      return collider;
    }

    isInsideIsland(x, z) {
      if (!this.island) return true;
      return this.island.contains(x, z);
    }

    circleHitsBox(x, z, radius, box) {
      const nearestX = clamp(x, box.minX, box.maxX);
      const nearestZ = clamp(z, box.minZ, box.maxZ);
      const dx = x - nearestX;
      const dz = z - nearestZ;
      return dx * dx + dz * dz < radius * radius;
    }

    isBlocked(x, z, radius) {
      const r = radius == null ? 0.34 : radius;
      if (!this.isInsideIsland(x, z)) return true;
      for (let i = 0; i < this.boxes.length; i += 1) {
        if (this.circleHitsBox(x, z, r, this.boxes[i])) return true;
      }
      for (let i = 0; i < this.circles.length; i += 1) {
        const circle = this.circles[i];
        const dx = x - circle.x;
        const dz = z - circle.z;
        const minDistance = r + circle.radius;
        if (dx * dx + dz * dz < minDistance * minDistance) return true;
      }
      return false;
    }

    resolveMovement(fromX, fromZ, deltaX, deltaZ, radius) {
      let x = fromX;
      let z = fromZ;
      let hitX = false;
      let hitZ = false;
      const steps = Math.max(
        1,
        Math.ceil(Math.max(Math.abs(deltaX), Math.abs(deltaZ)) / 0.18)
      );
      const stepX = deltaX / steps;
      const stepZ = deltaZ / steps;

      for (let i = 0; i < steps; i += 1) {
        if (!this.isBlocked(x + stepX, z, radius)) {
          x += stepX;
        } else {
          hitX = true;
        }
        if (!this.isBlocked(x, z + stepZ, radius)) {
          z += stepZ;
        } else {
          hitZ = true;
        }
      }

      return {
        x,
        z,
        hitX,
        hitZ,
        blocked: hitX || hitZ
      };
    }

    isInRaisedAtrium(x, z) {
      const halfPlaza = (config.cellSize * 3) / 2;
      return Math.abs(x) <= halfPlaza && Math.abs(z) <= halfPlaza;
    }

    groundHeightAt(x, z) {
      const atrium = config.atrium;
      const halfPlaza = (config.cellSize * 3) / 2;
      if (Math.abs(x) <= halfPlaza && Math.abs(z) <= halfPlaza) {
        return atrium.floorHeight;
      }

      if (
        Math.abs(x) <= 2.9 &&
        z > halfPlaza &&
        z < halfPlaza + atrium.approachDepth
      ) {
        const t = 1 - (z - halfPlaza) / atrium.approachDepth;
        const stepped =
          Math.ceil(clamp(t, 0, 1) * atrium.stepCount) / atrium.stepCount;
        return stepped * atrium.floorHeight;
      }
      return 0;
    }

    sampleGrid(radius) {
      const rows = [];
      for (let row = 0; row < this.maze.size; row += 1) {
        const cells = [];
        for (let col = 0; col < this.maze.size; col += 1) {
          const world = config.helpers.cellToWorld(row, col);
          cells.push(
            !this.isBlocked(world.x, world.z, radius == null ? 0.34 : radius)
          );
        }
        rows.push(cells);
      }
      return rows;
    }
  }

  Changming.CollisionWorld = CollisionWorld;
})(typeof window !== 'undefined' ? window : globalThis);
