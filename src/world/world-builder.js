(function (global) {
  'use strict';

  const Changming = (global.Changming = global.Changming || {});
  const config = Changming.MazeConfig;
  const helpers = config.helpers;

  function buildWorld(THREE, scene, options) {
    const settings = options || {};
    const seed =
      settings.seed == null ? config.defaultSeed : settings.seed;
    const root = new THREE.Group();
    root.name = 'ChangmingWorldRoot';
    root.userData.module = 'B/world';
    root.userData.seed = seed;
    scene.add(root);

    const materialLibrary = Changming.WorldMaterials.create(THREE, {
      seed,
      renderer: settings.renderer
    });
    const materials = materialLibrary.materials;
    const maze = Changming.MazeGenerator.generate({
      seed,
      loopRate: settings.loopRate == null ? config.loopRate : settings.loopRate
    });

    const island = Changming.createIsland(THREE, materials, { seed });
    root.add(island.group);

    const collision = new Changming.CollisionWorld(maze, { island });
    const mazeGeometry = Changming.buildMazeGeometry(
      THREE,
      maze,
      materials,
      { seed }
    );
    root.add(mazeGeometry.group);

    const lighthouse = Changming.createLighthouse(THREE, materials, {
      baseY: config.atrium.floorHeight
    });
    lighthouse.group.position.y = 0;
    root.add(lighthouse.group);
    lighthouse.addCollider(collision);

    const landmarks = Changming.buildLandmarks(
      THREE,
      maze,
      materials,
      collision,
      { seed }
    );
    root.add(landmarks.group);

    const entranceGate = createEntranceGate(THREE, materials, collision);
    root.add(entranceGate.group);

    const ocean = Changming.createOcean(THREE, {
      seed,
      seaLevel: -1.12
    });
    root.add(ocean.group);

    const mergeStats = Changming.mergeStaticMeshes(THREE, root);

    const spawnPoints = maze.spawnPoints.map(function (spawn, index) {
      const anchor = landmarks.spawnAnchors[index];
      const worldPosition = new THREE.Vector3();
      if (anchor) anchor.getWorldPosition(worldPosition);
      else worldPosition.set(spawn.position.x, 0.96, spawn.position.z);
      return Object.assign({}, spawn, {
        position: {
          x: worldPosition.x,
          y: worldPosition.y,
          z: worldPosition.z
        },
        anchor
      });
    });

    const doorAnchor = lighthouse.doorAnchor;
    const doorWorld = new THREE.Vector3();
    doorAnchor.getWorldPosition(doorWorld);

    const entrance = {
      cell: { row: maze.entrance.row, col: maze.entrance.col },
      position: new THREE.Vector3(0, 0, 41.2),
      insidePosition: new THREE.Vector3(0, 0, maze.entrance.world.z),
      facing: 0
    };

    const meshStats = countRenderableParts(root);
    const api = {
      version: 1,
      moduleOwner: 'B',
      seed,
      root,
      scene,
      maze,
      materials,
      materialLibrary,
      island,
      ocean,
      mazeGeometry,
      collision,
      lighthouse,
      landmarks,
      entranceGate,
      entrance,
      spawnPoints,
      lighthouseDoor: {
        id: 'lighthouse-door',
        position: {
          x: doorWorld.x,
          y: doorWorld.y,
          z: doorWorld.z
        },
        anchor: doorAnchor,
        lighthouse: lighthouse
      },
      regions: config.regions,
      regionOrder: ['courtyard', 'water', 'ember', 'atrium'],
      stats: Object.assign(meshStats, {
        mergedStaticDrawCalls: mergeStats.removedCalls,
        wallSegments: mazeGeometry.wallCount,
        mazeCells: maze.size * maze.size,
        landmarkCount: landmarks.landmarks.length,
        propCount: landmarks.props.length,
        emberSpawnCount: spawnPoints.length
      }),
      getRegionAt: function getRegionAt(x, z) {
        return config.regions[helpers.regionIdAtWorld(x, z)];
      },
      cellToWorld: function cellToWorld(row, col, y) {
        return helpers.cellToWorld(row, col, y);
      },
      getRegionAtCell: function getRegionAtCell(row, col) {
        return config.regions[helpers.regionIdAtCell(row, col)];
      },
      getGroundHeight: function getGroundHeight(x, z) {
        return collision.groundHeightAt(x, z);
      },
      resolveMovement: function resolveMovement(
        fromX,
        fromZ,
        deltaX,
        deltaZ,
        radius
      ) {
        return collision.resolveMovement(
          fromX,
          fromZ,
          deltaX,
          deltaZ,
          radius == null ? 0.34 : radius
        );
      },
      isWalkable: function isWalkable(x, z, radius) {
        return !collision.isBlocked(
          x,
          z,
          radius == null ? 0.34 : radius
        );
      },
      setDoorOpen: lighthouse.setDoorOpen,
      setBeaconIntensity: lighthouse.setBeaconIntensity,
      update: function update(time, delta) {
        ocean.update(time);
        if (ocean.boats.userData.updateBobbers) {
          ocean.boats.userData.updateBobbers(time);
        }
        lighthouse.update(time);
        landmarks.update(time, delta);
      },
      dispose: function dispose() {
        scene.remove(root);
        root.traverse(function (child) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            const list = Array.isArray(child.material)
              ? child.material
              : [child.material];
            list.forEach(function (material) {
              material.dispose();
            });
          }
        });
        materialLibrary.dispose();
      }
    };

    if (settings.exposeGlobally !== false) {
      global.ChangmingWorld = api;
    }
    return api;
  }

  function createEntranceGate(THREE, materials, collision) {
    const group = new THREE.Group();
    group.name = 'SouthEntranceGate';
    const columnGeometry = new THREE.BoxGeometry(1.12, 5.8, 1.18);
    [-3.05, 3.05].forEach(function (x, index) {
      const column = new THREE.Mesh(columnGeometry, materials.wall.courtyard);
      column.position.set(x, 2.9, 30.52);
      column.rotation.z = index === 0 ? -0.018 : 0.018;
      column.castShadow = true;
      column.receiveShadow = true;
      group.add(column);

      const foot = new THREE.Mesh(
        new THREE.BoxGeometry(1.55, 0.5, 1.68),
        materials.boundaryStone
      );
      foot.position.set(x, 0.25, 30.52);
      foot.castShadow = true;
      group.add(foot);
      collision.addCircle(x, 30.52, 0.72, {
        kind: 'architecture',
        id: 'entrance-gate-column-' + index
      });
    });

    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(7.4, 0.72, 1.38),
      materials.wall.courtyard
    );
    lintel.position.set(0, 5.63, 30.52);
    lintel.rotation.z = -0.012;
    lintel.castShadow = true;
    group.add(lintel);

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(7.8, 0.22, 1.62),
      materials.boundaryStone
    );
    cap.position.set(0, 6.1, 30.52);
    group.add(cap);

    const crestRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.43, 0.045, 8, 28),
      materials.gold
    );
    crestRing.position.set(0, 5.03, 31.24);
    group.add(crestRing);
    const crestMark = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18, 0),
      materials.gold
    );
    crestMark.position.set(0, 5.03, 31.27);
    crestMark.scale.set(0.62, 1.55, 0.38);
    group.add(crestMark);

    const light = new THREE.PointLight(0x9cc6b7, 1.15, 12, 2);
    light.position.set(0, 4.7, 29.8);
    light.userData.owner = 'C';
    group.add(light);
    return { group, light };
  }

  function countRenderableParts(root) {
    let meshes = 0;
    let instanced = 0;
    let triangles = 0;
    root.traverse(function (child) {
      if (!child.isMesh) return;
      meshes += 1;
      if (child.isInstancedMesh) {
        instanced += 1;
        if (child.geometry && child.geometry.index) {
          triangles +=
            (child.geometry.index.count / 3) * child.count;
        }
      } else if (child.geometry) {
        if (child.geometry.index) {
          triangles += child.geometry.index.count / 3;
        } else if (child.geometry.attributes.position) {
          triangles += child.geometry.attributes.position.count / 3;
        }
      }
    });
    return {
      meshCount: meshes,
      instancedMeshCount: instanced,
      estimatedTriangles: Math.round(triangles)
    };
  }

  Changming.buildWorld = buildWorld;
})(typeof window !== 'undefined' ? window : globalThis);
