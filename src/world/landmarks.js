(function (global) {
  'use strict';

  const Changming = (global.Changming = global.Changming || {});
  const config = Changming.MazeConfig;
  const helpers = config.helpers;
  const createRandom = Changming.Random.createRandom;

  function buildLandmarks(THREE, maze, materials, collision, options) {
    const settings = options || {};
    const random = createRandom((settings.seed || maze.seed) + ':landmarks');
    const group = new THREE.Group();
    group.name = 'LandmarksAndProps';
    group.userData.module = 'B/landmarks';
    const landmarks = [];
    const props = [];
    const braziers = [];
    const spawnAnchors = [];
    const torchLights = [];

    const obelisk = createObelisk(THREE, materials);
    placeAtCell(obelisk.group, 12, 3, -0.8, -0.6, 0);
    group.add(obelisk.group);
    collision.addCircle(obelisk.group.position.x, obelisk.group.position.z, 0.83, {
      kind: 'landmark',
      id: 'water-obelisk'
    });
    landmarks.push({
      id: 'water-obelisk',
      name: '潮痕方尖碑',
      region: 'courtyard',
      object: obelisk.group,
      anchor: obelisk.group.position.clone()
    });

    const brokenArch = createBrokenArch(THREE, materials);
    placeAtCell(brokenArch.group, 4, 3, -0.15, 0, 0);
    brokenArch.group.rotation.y = Math.PI / 2;
    group.add(brokenArch.group);
    const archOffsetX = Math.cos(brokenArch.group.rotation.y) * 1.0;
    const archOffsetZ = -Math.sin(brokenArch.group.rotation.y) * 1.0;
    collision.addCircle(
      brokenArch.group.position.x + archOffsetX,
      brokenArch.group.position.z + archOffsetZ,
      0.42,
      { kind: 'landmark', id: 'water-arch-west' }
    );
    collision.addCircle(
      brokenArch.group.position.x - archOffsetX,
      brokenArch.group.position.z - archOffsetZ,
      0.42,
      { kind: 'landmark', id: 'water-arch-east' }
    );
    landmarks.push({
      id: 'water-arch',
      name: '断潮拱门',
      region: 'water',
      object: brokenArch.group,
      anchor: brokenArch.group.position.clone()
    });

    const giantLamp = createGiantLamp(THREE, materials);
    placeAtCell(giantLamp.group, 3, 11, -0.8, 0.35, 0);
    group.add(giantLamp.group);
    collision.addCircle(giantLamp.group.position.x, giantLamp.group.position.z, 0.72, {
      kind: 'landmark',
      id: 'ember-giant-lamp'
    });
    braziers.push(giantLamp.brazier);
    torchLights.push(giantLamp.light);
    landmarks.push({
      id: 'ember-giant-lamp',
      name: '烬厅巨灯',
      region: 'ember',
      object: giantLamp.group,
      anchor: giantLamp.group.position.clone()
    });

    const sentinel = createSentinel(THREE, materials);
    sentinel.group.position.set(-4.55, config.atrium.floorHeight, 4.35);
    sentinel.group.rotation.y = Math.PI * 0.22;
    group.add(sentinel.group);
    collision.addCircle(sentinel.group.position.x, sentinel.group.position.z, 0.58, {
      kind: 'landmark',
      id: 'atrium-sentinel'
    });
    landmarks.push({
      id: 'atrium-sentinel',
      name: '守夜者石像',
      region: 'atrium',
      object: sentinel.group,
      anchor: sentinel.group.position.clone()
    });

    const signDefinitions = [
      { region: 'courtyard', row: 10, col: 7, dx: 1.25, dz: 0.35 },
      { region: 'water', row: 8, col: 4, dx: -0.65, dz: -0.7 },
      { region: 'ember', row: 8, col: 10, dx: 0.65, dz: -0.7 },
      { region: 'atrium', row: 8, col: 7, dx: 1.15, dz: 0.35 }
    ];
    signDefinitions.forEach(function (definition) {
      const sign = createRegionSign(THREE, materials, definition.region);
      placeAtCell(
        sign.group,
        definition.row,
        definition.col,
        definition.dx,
        definition.dz,
        definition.region === 'atrium' ? config.atrium.floorHeight : 0
      );
      group.add(sign.group);
      collision.addCircle(sign.group.position.x, sign.group.position.z, 0.24, {
        kind: 'prop',
        id: 'region-sign-' + definition.region
      });
      props.push({
        id: 'region-sign-' + definition.region,
        object: sign.group,
        kind: 'sign'
      });
    });

    const propCells = [
      { row: 13, col: 1, dx: -0.8, dz: 0.9, type: 'crate' },
      { row: 12, col: 5, dx: 1.0, dz: -0.8, type: 'crate' },
      { row: 9, col: 1, dx: -1.1, dz: 0.6, type: 'barrel' },
      { row: 6, col: 2, dx: 0.9, dz: 1.0, type: 'crate' },
      { row: 2, col: 8, dx: -0.9, dz: 0.8, type: 'barrel' },
      { row: 7, col: 12, dx: 0.8, dz: 0.8, type: 'crate' },
      { row: 2, col: 13, dx: 0.75, dz: -0.8, type: 'crate' }
    ];
    propCells.forEach(function (definition, index) {
      const item =
        definition.type === 'crate'
          ? createCrate(THREE, materials)
          : createBarrel(THREE, materials);
      placeAtCell(
        item,
        definition.row,
        definition.col,
        definition.dx,
        definition.dz,
        0
      );
      item.rotation.y = random.range(0, Math.PI * 2);
      group.add(item);
      const radius = definition.type === 'crate' ? 0.57 : 0.43;
      collision.addCircle(item.position.x, item.position.z, radius, {
        kind: 'prop',
        id: definition.type + '-' + index
      });
      props.push({
        id: definition.type + '-' + index,
        object: item,
        kind: definition.type
      });
    });

    const benchDefinitions = [
      { row: 11, col: 11, dx: 0, dz: 0.55 },
      { row: 5, col: 5, dx: 0, dz: 0.55 }
    ];
    benchDefinitions.forEach(function (definition, index) {
      const bench = createBench(THREE, materials);
      placeAtCell(bench, definition.row, definition.col, definition.dx, definition.dz, 0);
      bench.rotation.y = 0;
      group.add(bench);
      collision.addBox(
        {
          minX: bench.position.x - 1.25,
          maxX: bench.position.x + 1.25,
          minZ: bench.position.z - 0.35,
          maxZ: bench.position.z + 0.35
        },
        { kind: 'prop', id: 'bench-' + index }
      );
      props.push({ id: 'bench-' + index, object: bench, kind: 'bench' });
    });

    const brazierDefinitions = [
      { row: 14, col: 5, dx: 0, dz: -1.15, y: 0 },
      { row: 14, col: 9, dx: 0, dz: -1.15, y: 0 },
      { row: 7, col: 4, dx: -1.25, dz: 1.2, y: 0 },
      { row: 10, col: 7, dx: 1.45, dz: 0.65, y: 0 },
      { row: 7, col: 9, dx: 1.2, dz: -1.1, y: 0 },
      { row: 7, col: 7, dx: 4.45, dz: -4.25, y: config.atrium.floorHeight }
    ];
    brazierDefinitions.forEach(function (definition, index) {
      const brazier = createBrazier(THREE, materials, index % 2 === 0);
      placeAtCell(
        brazier.group,
        definition.row,
        definition.col,
        definition.dx,
        definition.dz,
        definition.y
      );
      group.add(brazier.group);
      braziers.push(brazier);
      torchLights.push(brazier.light);
      collision.addCircle(brazier.group.position.x, brazier.group.position.z, 0.48, {
        kind: 'prop',
        id: 'brazier-' + index
      });
      props.push({
        id: 'brazier-' + index,
        object: brazier.group,
        kind: 'brazier'
      });
    });

    maze.spawnPoints.forEach(function (spawn, index) {
      const cradle = createEmberCradle(THREE, materials);
      cradle.position.set(spawn.position.x, 0.02, spawn.position.z);
      group.add(cradle);
      const anchor = new THREE.Object3D();
      anchor.name = 'EmberSpawnAnchor' + (index + 1);
      anchor.position.set(0, 1.06, 0);
      cradle.add(anchor);
      spawnAnchors.push(anchor);
      collision.addCircle(cradle.position.x, cradle.position.z, 0.46, {
        kind: 'prop',
        id: spawn.id + '-cradle'
      });
    });

    let elapsed = 0;
    return {
      group,
      landmarks,
      props,
      braziers,
      spawnAnchors,
      torchLights,
      update: function update(time, delta) {
        elapsed += delta || 0;
        braziers.forEach(function (brazier, index) {
          const flicker =
            0.82 +
            Math.sin(time * 7.2 + index * 1.73) * 0.11 +
            Math.sin(time * 13.3 + index) * 0.055;
          brazier.light.intensity = brazier.baseIntensity * flicker;
          brazier.flame.scale.set(
            1 + Math.sin(time * 5.7 + index) * 0.08,
            flicker,
            1 + Math.cos(time * 4.9 + index) * 0.08
          );
          brazier.flame.rotation.y = time * 0.8 + index;
        });
      }
    };
  }

  function placeAtCell(object, row, col, dx, dz, y) {
    const world = helpers.cellToWorld(row, col);
    object.position.set(world.x + (dx || 0), y || 0, world.z + (dz || 0));
    return object;
  }

  function createObelisk(THREE, materials) {
    const group = new THREE.Group();
    group.name = 'TideObelisk';
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.42, 0.52, 4),
      materials.boundaryStone
    );
    base.position.y = 0.26;
    base.rotation.y = Math.PI / 4;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const middle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 1.08, 0.42, 4),
      materials.wall.water
    );
    middle.position.y = 0.73;
    middle.rotation.y = Math.PI / 4;
    middle.castShadow = true;
    group.add(middle);

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.68, 4.8, 4),
      materials.wall.water
    );
    shaft.position.y = 3.32;
    shaft.rotation.y = Math.PI / 4;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    group.add(shaft);

    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.31, 0.55, 4),
      materials.gold
    );
    tip.position.y = 5.99;
    tip.rotation.y = Math.PI / 4;
    group.add(tip);

    for (let i = 0; i < 4; i += 1) {
      const glyph = new THREE.Mesh(
        new THREE.PlaneGeometry(0.13, 0.72),
        materials.beacon
      );
      const angle = (i / 4) * Math.PI * 2;
      const radius = 0.49;
      glyph.position.set(
        Math.sin(angle) * radius,
        3.4,
        Math.cos(angle) * radius
      );
      glyph.rotation.y = angle;
      group.add(glyph);
    }
    return { group, tip };
  }

  function createBrokenArch(THREE, materials) {
    const group = new THREE.Group();
    group.name = 'BrokenTideArch';
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(1.65, 20),
      materials.water
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.068;
    pool.renderOrder = 1;
    group.add(pool);

    const columnGeometry = new THREE.CylinderGeometry(0.46, 0.66, 3.7, 8);
    [-1.0, 1.0].forEach(function (x, index) {
      const column = new THREE.Mesh(columnGeometry, materials.wall.water);
      column.position.set(x, 1.85, 0);
      column.scale.y = index === 0 ? 0.76 : 1;
      column.rotation.z = index === 0 ? 0.07 : -0.025;
      column.castShadow = true;
      group.add(column);

      const foot = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.32, 0.95),
        materials.boundaryStone
      );
      foot.position.set(x, 0.16, 0);
      group.add(foot);
    });

    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(2.28, 0.36, 0.82),
      materials.wall.water
    );
    lintel.position.set(-0.31, 3.08, 0);
    lintel.rotation.z = -0.08;
    lintel.castShadow = true;
    group.add(lintel);

    const shard = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.34, 0.78),
      materials.wall.water
    );
    shard.position.set(0.95, 2.81, 0);
    shard.rotation.z = 0.32;
    shard.castShadow = true;
    group.add(shard);
    return { group };
  }

  function createGiantLamp(THREE, materials) {
    const group = new THREE.Group();
    group.name = 'EmberGiantLamp';

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.94, 0.82, 8),
      materials.wall.ember
    );
    pedestal.position.y = 0.41;
    pedestal.castShadow = true;
    group.add(pedestal);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.22, 2.8, 8),
      materials.iron
    );
    stem.position.y = 2.15;
    stem.castShadow = true;
    group.add(stem);

    const cage = new THREE.Group();
    cage.position.y = 3.65;
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 1.18, 0.055),
        materials.bronze
      );
      bar.position.set(Math.sin(angle) * 0.55, 0, Math.cos(angle) * 0.55);
      cage.add(bar);
    }
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.37, 1.25, 12),
      materials.ember
    );
    flame.position.y = 0.08;
    flame.userData.noMerge = true;
    cage.add(flame);
    const cageTop = new THREE.Mesh(
      new THREE.ConeGeometry(0.84, 0.52, 6),
      materials.iron
    );
    cageTop.position.y = 0.82;
    cage.add(cageTop);
    group.add(cage);

    const light = new THREE.PointLight(0xff7a37, 4.8, 23, 1.8);
    light.position.set(0, 3.7, 0);
    light.userData.owner = 'C';
    group.add(light);

    return {
      group,
      light,
      brazier: {
        group,
        light,
        flame,
        baseIntensity: 4.8
      }
    };
  }

  function createSentinel(THREE, materials) {
    const group = new THREE.Group();
    group.name = 'AtriumSentinel';

    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.9, 1.1, 4),
      materials.wall.atrium
    );
    plinth.position.y = 0.55;
    plinth.rotation.y = Math.PI / 4;
    plinth.castShadow = true;
    group.add(plinth);

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 1.35, 4, 8),
      materials.boundaryStone
    );
    body.position.y = 2.05;
    body.scale.set(0.88, 1, 0.74);
    body.castShadow = true;
    group.add(body);

    const hood = new THREE.Mesh(
      new THREE.ConeGeometry(0.53, 0.82, 8),
      materials.boundaryStone
    );
    hood.position.y = 3.16;
    hood.castShadow = true;
    group.add(hood);

    const eye = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.045, 0.05),
      materials.beacon
    );
    eye.position.set(0, 2.93, 0.34);
    group.add(eye);

    const spear = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 3.7, 6),
      materials.bronze
    );
    spear.position.set(0.64, 2.05, 0);
    spear.rotation.z = -0.06;
    group.add(spear);

    const spearHead = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.42, 4),
      materials.bronze
    );
    spearHead.position.set(0.75, 3.92, 0);
    group.add(spearHead);
    return { group };
  }

  function makeSignTexture(THREE, regionId) {
    const region = config.regions[regionId];
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 512, 256);
    gradient.addColorStop(0, '#34251b');
    gradient.addColorStop(1, '#171311');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 256);
    context.strokeStyle = region.glow;
    context.lineWidth = 8;
    context.strokeRect(18, 18, 476, 220);
    context.strokeStyle = 'rgba(240,220,176,.28)';
    context.lineWidth = 2;
    context.strokeRect(32, 32, 448, 192);
    context.textAlign = 'center';
    context.fillStyle = '#e7dcc4';
    context.font = '700 78px "Microsoft YaHei", "Noto Serif SC", serif';
    context.fillText(region.name, 256, 122);
    context.fillStyle = region.glow;
    context.font = '500 28px "Microsoft YaHei", "Noto Sans SC", sans-serif';
    context.fillText(region.subtitle, 256, 178);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  function createRegionSign(THREE, materials, regionId) {
    const group = new THREE.Group();
    group.name = 'RegionSign-' + regionId;
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 2.0, 0.14),
      materials.wood
    );
    post.position.y = 1;
    post.castShadow = true;
    group.add(post);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.52, 0.76, 0.1),
      materials.wood
    );
    board.position.y = 1.84;
    board.castShadow = true;
    group.add(board);

    const texture = makeSignTexture(THREE, regionId);
    const faceMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 0.66), faceMaterial);
    face.position.set(0, 1.84, 0.056);
    group.add(face);
    const back = face.clone();
    back.rotation.y = Math.PI;
    back.position.z = -0.056;
    group.add(back);
    return { group, texture };
  }

  function createCrate(THREE, materials) {
    const crate = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.94, 0.82, 0.94),
      materials.wood
    );
    box.position.y = 0.41;
    box.castShadow = true;
    box.receiveShadow = true;
    crate.add(box);
    const bandGeometry = new THREE.BoxGeometry(1.0, 0.08, 0.035);
    [-0.27, 0.27].forEach(function (y) {
      const front = new THREE.Mesh(bandGeometry, materials.iron);
      front.position.set(0, 0.41 + y, 0.48);
      crate.add(front);
      const back = front.clone();
      back.position.z = -0.48;
      crate.add(back);
    });
    crate.name = 'SupplyCrate';
    return crate;
  }

  function createBarrel(THREE, materials) {
    const barrel = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.45, 0.88, 12, 3),
      materials.wood
    );
    body.position.y = 0.44;
    body.castShadow = true;
    barrel.add(body);
    [-0.29, 0.29].forEach(function (y) {
      const hoop = new THREE.Mesh(
        new THREE.TorusGeometry(0.43, 0.035, 5, 16),
        materials.iron
      );
      hoop.position.y = 0.44 + y;
      hoop.rotation.x = Math.PI / 2;
      barrel.add(hoop);
    });
    barrel.name = 'WoodBarrel';
    return barrel;
  }

  function createBench(THREE, materials) {
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.19, 0.58),
      materials.wood
    );
    seat.position.y = 0.58;
    seat.castShadow = true;
    bench.add(seat);
    [-0.92, 0.92].forEach(function (x) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.56, 0.44),
        materials.wood
      );
      leg.position.set(x, 0.3, 0);
      leg.castShadow = true;
      bench.add(leg);
    });
    bench.name = 'StoneCourtBench';
    return bench;
  }

  function createBrazier(THREE, materials, intense) {
    const group = new THREE.Group();
    group.name = 'Brazier';
    const foot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.44, 0.22, 8),
      materials.bronze
    );
    foot.position.y = 0.11;
    group.add(foot);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.11, 0.78, 8),
      materials.iron
    );
    stem.position.y = 0.58;
    group.add(stem);

    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.25, 0.32, 10),
      materials.iron
    );
    bowl.position.y = 1.02;
    bowl.castShadow = true;
    group.add(bowl);

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.72, 8),
      materials.ember
    );
    flame.position.y = 1.36;
    flame.userData.noMerge = true;
    group.add(flame);

    const baseIntensity = intense ? 2.35 : 1.45;
    const light = new THREE.PointLight(
      intense ? 0xff6d2e : 0xffa052,
      baseIntensity,
      intense ? 14 : 10,
      2
    );
    light.position.y = 1.35;
    light.castShadow = false;
    light.userData.owner = 'C';
    group.add(light);

    return { group, flame, light, baseIntensity };
  }

  function createEmberCradle(THREE, materials) {
    const cradle = new THREE.Group();
    cradle.name = 'EmberCradle';
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.43, 0.55, 0.24, 6),
      materials.wall.atrium
    );
    base.position.y = 0.12;
    base.castShadow = true;
    cradle.add(base);

    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.2, 0.28, 8),
      materials.bronze
    );
    bowl.position.y = 0.38;
    cradle.add(bowl);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.035, 6, 16),
      materials.gold
    );
    rim.position.y = 0.52;
    rim.rotation.x = Math.PI / 2;
    cradle.add(rim);
    return cradle;
  }

  Changming.buildLandmarks = buildLandmarks;
})(typeof window !== 'undefined' ? window : globalThis);
