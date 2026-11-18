(function (global) {
  'use strict';

  const Changming = (global.Changming = global.Changming || {});
  const config = Changming.MazeConfig;
  const helpers = config.helpers;
  const WallModel = Changming.WallModel;
  const createRandom = Changming.Random.createRandom;

  function buildMazeGeometry(THREE, maze, materials, options) {
    const settings = options || {};
    const random = createRandom((settings.seed || maze.seed) + ':walls');
    const group = new THREE.Group();
    group.name = 'StoneMaze';
    group.userData.module = 'B/maze-mesh';

    const segments = WallModel.collectWallSegments(maze);
    const regionIds = ['courtyard', 'water', 'ember', 'atrium'];
    const wallGeometry = new THREE.BoxGeometry(1, 1, 1, 1, 3, 1);
    const capGeometry = new THREE.BoxGeometry(1, 1, 1);
    const baseGeometry = new THREE.BoxGeometry(1, 1, 1);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    const wallMeshes = {};

    regionIds.forEach(function (regionId) {
      const regionSegments = segments.filter(function (segment) {
        return segment.region === regionId;
      });
      if (!regionSegments.length) return;
      const instanced = new THREE.InstancedMesh(
        wallGeometry,
        materials.wall[regionId],
        regionSegments.length
      );
      instanced.name = 'MazeWalls-' + regionId;
      instanced.castShadow = true;
      instanced.receiveShadow = true;
      instanced.userData.region = regionId;
      regionSegments.forEach(function (segment, index) {
        const isBoundary =
          segment.row === 0 ||
          segment.col === 0 ||
          segment.row === maze.size - 1 ||
          segment.col === maze.size - 1;
        const roll = random();
        let height =
          config.wallHeight +
          (isBoundary ? 0.25 : random.range(-0.18, 0.23));
        if (roll < 0.035 && !isBoundary) height -= random.range(0.45, 1.05);
        const horizontal = segment.axis === 'x';
        position.set(segment.x, height / 2, segment.z);
        quaternion.setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          horizontal ? 0 : Math.PI / 2
        );
        scale.set(segment.length, height, segment.depth);
        matrix.compose(position, quaternion, scale);
        instanced.setMatrixAt(index, matrix);
        segment.height = height;
      });
      instanced.instanceMatrix.needsUpdate = true;
      wallMeshes[regionId] = instanced;
      group.add(instanced);
    });

    const capMeshes = {};
    regionIds.forEach(function (regionId) {
      const regionSegments = segments.filter(function (segment) {
        return segment.region === regionId;
      });
      if (!regionSegments.length) return;
      const caps = new THREE.InstancedMesh(
        capGeometry,
        materials.wallCaps[regionId],
        regionSegments.length
      );
      caps.name = 'MazeWallCaps-' + regionId;
      caps.castShadow = true;
      caps.receiveShadow = true;
      regionSegments.forEach(function (segment, index) {
        const horizontal = segment.axis === 'x';
        const height = segment.height || config.wallHeight;
        position.set(segment.x, height + 0.08, segment.z);
        quaternion.setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          horizontal ? 0 : Math.PI / 2
        );
        scale.set(
          segment.length + 0.06,
          random.range(0.12, 0.2),
          segment.depth + 0.08
        );
        matrix.compose(position, quaternion, scale);
        caps.setMatrixAt(index, matrix);
      });
      caps.instanceMatrix.needsUpdate = true;
      capMeshes[regionId] = caps;
      group.add(caps);
    });

    const bases = new THREE.InstancedMesh(
      baseGeometry,
      materials.boundaryStone,
      segments.length
    );
    bases.name = 'MazeWallFootings';
    bases.receiveShadow = true;
    bases.castShadow = false;
    segments.forEach(function (segment, index) {
      const horizontal = segment.axis === 'x';
      position.set(segment.x, 0.14, segment.z);
      quaternion.setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        horizontal ? 0 : Math.PI / 2
      );
      scale.set(segment.length + 0.12, 0.24, segment.depth + 0.14);
      matrix.compose(position, quaternion, scale);
      bases.setMatrixAt(index, matrix);
    });
    bases.instanceMatrix.needsUpdate = true;
    group.add(bases);

    buildFloors(THREE, maze, materials, random, group);
    buildAtrium(THREE, materials, group);
    buildWaterChannels(THREE, maze, materials, random, group);
    buildOuterRuinRing(THREE, maze, materials, random, group);

    return {
      group,
      segments,
      wallMeshes,
      caps: capMeshes,
      bases,
      wallCount: segments.length
    };
  }

  function buildFloors(THREE, maze, materials, random, group) {
    const floorGeometry = new THREE.BoxGeometry(
      config.cellSize - 0.08,
      0.09,
      config.cellSize - 0.08
    );
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    const position = new THREE.Vector3();
    const regionIds = ['courtyard', 'water', 'ember', 'atrium'];

    regionIds.forEach(function (regionId) {
      const cells = [];
      for (let row = 0; row < maze.size; row += 1) {
        for (let col = 0; col < maze.size; col += 1) {
          if (
            maze.cells[row][col].region === regionId &&
            !maze.cells[row][col].isAtrium
          ) {
            cells.push({ row, col });
          }
        }
      }
      if (!cells.length) return;
      const floors = new THREE.InstancedMesh(
        floorGeometry,
        materials.floor[regionId],
        cells.length
      );
      floors.name = 'MazeFloor-' + regionId;
      floors.receiveShadow = true;
      floors.castShadow = false;
      floors.userData.region = regionId;
      cells.forEach(function (cell, index) {
        const world = helpers.cellToWorld(cell.row, cell.col);
        position.set(world.x, -0.025 + random.range(-0.012, 0.012), world.z);
        quaternion.setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          random.chance(0.08) ? Math.PI / 2 : 0
        );
        matrix.compose(position, quaternion, scale);
        floors.setMatrixAt(index, matrix);
      });
      floors.instanceMatrix.needsUpdate = true;
      group.add(floors);
    });

    const inlay = new THREE.Mesh(
      new THREE.RingGeometry(11.2, 11.38, 64),
      new THREE.MeshStandardMaterial({
        color: 0x84785f,
        roughness: 0.7,
        metalness: 0.18
      })
    );
    inlay.name = 'RegionBoundaryInlay';
    inlay.rotation.x = -Math.PI / 2;
    inlay.position.y = 0.036;
    group.add(inlay);
  }

  function buildAtrium(THREE, materials, group) {
    const atrium = config.atrium;
    const plazaSize = config.cellSize * 3;
    const plaza = new THREE.Mesh(
      new THREE.BoxGeometry(plazaSize, atrium.floorHeight, plazaSize),
      materials.floor.atrium
    );
    plaza.name = 'RaisedAtrium';
    plaza.position.y = atrium.floorHeight / 2;
    plaza.castShadow = true;
    plaza.receiveShadow = true;
    group.add(plaza);

    const trimMaterial = new THREE.MeshStandardMaterial({
      color: 0xb99a59,
      roughness: 0.38,
      metalness: 0.72
    });
    const trimGeometry = new THREE.BoxGeometry(plazaSize + 0.18, 0.08, 0.18);
    [
      { x: 0, z: -plazaSize / 2, rotation: 0 },
      { x: 0, z: plazaSize / 2, rotation: 0 },
      { x: -plazaSize / 2, z: 0, rotation: Math.PI / 2 },
      { x: plazaSize / 2, z: 0, rotation: Math.PI / 2 }
    ].forEach(function (edge) {
      const trim = new THREE.Mesh(trimGeometry, trimMaterial);
      trim.position.set(edge.x, atrium.floorHeight + 0.045, edge.z);
      trim.rotation.y = edge.rotation;
      trim.receiveShadow = true;
      group.add(trim);
    });

    const mosaic = new THREE.Mesh(
      new THREE.RingGeometry(3.9, 5.62, 64, 1),
      new THREE.MeshStandardMaterial({
        color: 0x4f4b42,
        roughness: 0.58,
        metalness: 0.22
      })
    );
    mosaic.name = 'AtriumCompassInlay';
    mosaic.rotation.x = -Math.PI / 2;
    mosaic.position.y = atrium.floorHeight + 0.012;
    group.add(mosaic);

    for (let i = 0; i < 16; i += 1) {
      const angle = (i / 16) * Math.PI * 2;
      const ray = new THREE.Mesh(
        new THREE.BoxGeometry(0.075, 0.018, 1.25),
        materials.gold
      );
      ray.position.set(
        Math.sin(angle) * 4.72,
        atrium.floorHeight + 0.025,
        Math.cos(angle) * 4.72
      );
      ray.rotation.y = angle;
      group.add(ray);
    }

    const stepCount = atrium.stepCount;
    const stepWidth = 5.8;
    const stepDepth = atrium.approachDepth / stepCount;
    for (let i = 0; i < stepCount; i += 1) {
      const height = ((i + 1) / stepCount) * atrium.floorHeight;
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(stepWidth, height, stepDepth + 0.035),
        materials.floor.atrium
      );
      step.name = 'AtriumSouthStep' + (i + 1);
      step.position.set(
        0,
        height / 2,
        plazaSize / 2 + (stepCount - i - 0.5) * stepDepth
      );
      step.castShadow = true;
      step.receiveShadow = true;
      group.add(step);
    }

    for (let side = -1; side <= 1; side += 2) {
      const sideRail = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.62, atrium.approachDepth + 0.5),
        trimMaterial
      );
      sideRail.position.set(
        side * 3.1,
        0.3,
        plazaSize / 2 + atrium.approachDepth / 2
      );
      sideRail.rotation.x = -0.26;
      group.add(sideRail);
    }
  }

  function buildWaterChannels(THREE, maze, materials, random, group) {
    const channels = [];
    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 7; col += 1) {
        if (
          maze.cells[row][col].region === 'water' &&
          (row + col) % 2 === 0
        ) {
          channels.push({ row, col });
        }
      }
    }

    const waterGeometry = new THREE.BoxGeometry(0.78, 0.045, 3.45);
    const water = new THREE.InstancedMesh(
      waterGeometry,
      materials.water,
      channels.length
    );
    water.name = 'ShallowWaterChannels';
    water.receiveShadow = true;
    water.renderOrder = 1;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    channels.forEach(function (cell, index) {
      const world = helpers.cellToWorld(cell.row, cell.col);
      const horizontal = random.chance(0.5);
      position.set(
        world.x + random.range(-0.45, 0.45),
        0.045,
        world.z + random.range(-0.22, 0.22)
      );
      quaternion.setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        horizontal ? Math.PI / 2 : 0
      );
      scale.set(1, 1, random.range(0.72, 1.03));
      matrix.compose(position, quaternion, scale);
      water.setMatrixAt(index, matrix);
    });
    water.instanceMatrix.needsUpdate = true;
    group.add(water);

    const poolGeometry = new THREE.CircleGeometry(1, 14);
    poolGeometry.rotateX(-Math.PI / 2);
    const pools = new THREE.InstancedMesh(
      poolGeometry,
      materials.water,
      channels.length
    );
    pools.name = 'WaterCourtMoonPools';
    pools.renderOrder = 1;
    channels.forEach(function (cell, index) {
      const world = helpers.cellToWorld(cell.row, cell.col);
      position.set(
        world.x + random.range(-0.72, 0.72),
        0.062,
        world.z + random.range(-0.72, 0.72)
      );
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * Math.PI);
      scale.set(random.range(0.5, 1.05), 1, random.range(0.32, 0.68));
      matrix.compose(position, quaternion, scale);
      pools.setMatrixAt(index, matrix);
    });
    pools.instanceMatrix.needsUpdate = true;
    group.add(pools);

    const reedGeometry = new THREE.CylinderGeometry(0.018, 0.026, 0.65, 4);
    const reeds = new THREE.InstancedMesh(
      reedGeometry,
      materials.moss,
      Math.max(1, channels.length * 3)
    );
    reeds.name = 'WaterCourtReeds';
    reeds.castShadow = true;
    let index = 0;
    channels.forEach(function (cell) {
      const world = helpers.cellToWorld(cell.row, cell.col);
      for (let reed = 0; reed < 3; reed += 1) {
        position.set(
          world.x + random.range(-1.55, 1.55),
          0.33,
          world.z + random.range(-1.55, 1.55)
        );
        quaternion.setFromEuler(
          new THREE.Euler(random.range(-0.16, 0.16), 0, random.range(-0.16, 0.16))
        );
        scale.set(1, random.range(0.45, 1.0), 1);
        matrix.compose(position, quaternion, scale);
        reeds.setMatrixAt(index++, matrix);
      }
    });
    reeds.instanceMatrix.needsUpdate = true;
    group.add(reeds);
  }

  function buildOuterRuinRing(THREE, maze, materials, random, group) {
    const posts = [];
    for (let col = 0; col < maze.size; col += 3) {
      posts.push({ x: (col - (maze.size - 1) / 2) * config.cellSize, z: -31.2 });
      posts.push({ x: (col - (maze.size - 1) / 2) * config.cellSize, z: 31.2 });
    }
    for (let row = 2; row < maze.size - 1; row += 4) {
      posts.push({ x: -31.2, z: (row - (maze.size - 1) / 2) * config.cellSize });
      posts.push({ x: 31.2, z: (row - (maze.size - 1) / 2) * config.cellSize });
    }

    const geometry = new THREE.CylinderGeometry(0.3, 0.48, 1, 6);
    const instanced = new THREE.InstancedMesh(
      geometry,
      materials.boundaryStone,
      posts.length
    );
    instanced.name = 'OuterRuinPosts';
    instanced.castShadow = true;
    instanced.receiveShadow = true;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    posts.forEach(function (post, index) {
      position.set(post.x, 2.6, post.z);
      quaternion.setFromEuler(
        new THREE.Euler(random.range(-0.035, 0.035), random() * Math.PI, random.range(-0.035, 0.035))
      );
      scale.set(1, random.range(4.0, 6.4), 1);
      matrix.compose(position, quaternion, scale);
      instanced.setMatrixAt(index, matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
    group.add(instanced);
  }

  Changming.buildMazeGeometry = buildMazeGeometry;
})(typeof window !== 'undefined' ? window : globalThis);
