(function (global) {
  'use strict';

  const Changming = (global.Changming = global.Changming || {});
  const createRandom = Changming.Random.createRandom;

  function radiusProfile(angle) {
    return clamp(
      48.5 +
        Math.sin(angle * 3 - 0.4) * 2.2 +
        Math.sin(angle * 7 + 1.2) * 1.15 +
        Math.sin(angle * 13 + 0.2) * 0.55,
      44.7,
      51.5
    );
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function buildIsland(THREE, materials, options) {
    const settings = options || {};
    const seed = settings.seed || 20261205;
    const random = createRandom(seed + ':island');
    const group = new THREE.Group();
    group.name = 'ReefIsland';
    group.userData.module = 'B/island';

    const angularSegments = 96;
    const radialRings = [
      { radius: 0, height: 0.02, color: new THREE.Color(0x728178) },
      { radius: 22, height: -0.01, color: new THREE.Color(0x68796e) },
      { radius: 37, height: -0.09, color: new THREE.Color(0x5c6e63) },
      { radius: 44.5, height: -0.34, color: new THREE.Color(0x50665d) },
      { radius: 49, height: -2.0, color: new THREE.Color(0x43564f) },
      { radius: 54, height: -5.1, color: new THREE.Color(0x34443f) },
      { radius: 59, height: -7.8, color: new THREE.Color(0x26332f) }
    ];
    const positions = [];
    const colors = [];
    const indices = [];

    for (let ring = 0; ring < radialRings.length; ring += 1) {
      const profile = radialRings[ring];
      for (let segment = 0; segment < angularSegments; segment += 1) {
        const angle = (segment / angularSegments) * Math.PI * 2;
        let radius = profile.radius;
        if (ring > 0) {
          radius *= radiusProfile(angle) / 48.5;
          if (ring < 3) radius += Math.sin(angle * 9 + ring) * 0.35;
        }
        const shoreNoise =
          Math.sin(angle * 5.0 + ring * 0.7) * 0.16 +
          Math.sin(angle * 17.0 - 0.5) * 0.07;
        positions.push(
          Math.sin(angle) * radius,
          profile.height + (ring > 3 ? shoreNoise * ring : shoreNoise),
          Math.cos(angle) * radius
        );
        const color = profile.color.clone().offsetHSL(
          random.range(-0.012, 0.012),
          random.range(-0.03, 0.015),
          random.range(-0.035, 0.035)
        );
        colors.push(color.r, color.g, color.b);
      }
    }

    for (let ring = 0; ring < radialRings.length - 1; ring += 1) {
      for (let segment = 0; segment < angularSegments; segment += 1) {
        const nextSegment = (segment + 1) % angularSegments;
        const a = ring * angularSegments + segment;
        const b = ring * angularSegments + nextSegment;
        const c = (ring + 1) * angularSegments + segment;
        const d = (ring + 1) * angularSegments + nextSegment;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(colors, 3)
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const islandMesh = new THREE.Mesh(geometry, materials.cliff);
    islandMesh.name = 'ReefIslandCliff';
    islandMesh.receiveShadow = true;
    islandMesh.castShadow = false;
    group.add(islandMesh);

    const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
    rockGeometry.scale(1, 0.62, 0.88);
    const rockMaterial = materials.reef;
    const rockCount = 78;
    const rocks = new THREE.InstancedMesh(
      rockGeometry,
      rockMaterial,
      rockCount
    );
    rocks.name = 'CoastalRocks';
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    for (let i = 0; i < rockCount; i += 1) {
      const angle = random() * Math.PI * 2;
      const radius = random.range(44.8, 54.5);
      const size = random.range(0.65, 3.3);
      position.set(
        Math.sin(angle) * radius,
        random.range(-1.4, 0.05) - Math.max(0, radius - 48) * 0.08,
        Math.cos(angle) * radius
      );
      quaternion.setFromEuler(
        new THREE.Euler(random.range(-0.4, 0.4), random.range(0, Math.PI * 2), random.range(-0.25, 0.25))
      );
      scale.set(size, size * random.range(0.55, 1.05), size * random.range(0.7, 1.25));
      matrix.compose(position, quaternion, scale);
      rocks.setMatrixAt(i, matrix);
    }
    rocks.instanceMatrix.needsUpdate = true;
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    group.add(rocks);

    const mossGeometry = new THREE.CircleGeometry(1, 9);
    mossGeometry.rotateX(-Math.PI / 2);
    const mossCount = 44;
    const moss = new THREE.InstancedMesh(
      mossGeometry,
      materials.moss,
      mossCount
    );
    moss.name = 'MossPatches';
    for (let i = 0; i < mossCount; i += 1) {
      const angle = random() * Math.PI * 2;
      const radius = random.range(34, 45);
      const size = random.range(0.5, 1.75);
      position.set(
        Math.sin(angle) * radius,
        0.035,
        Math.cos(angle) * radius
      );
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * Math.PI);
      scale.set(size * random.range(0.8, 2.1), 1, size);
      matrix.compose(position, quaternion, scale);
      moss.setMatrixAt(i, matrix);
    }
    moss.instanceMatrix.needsUpdate = true;
    moss.receiveShadow = true;
    group.add(moss);

    const path = new THREE.Group();
    path.name = 'ApproachPath';
    for (let i = 0; i < 15; i += 1) {
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(
          random.range(2.15, 2.65),
          random.range(0.08, 0.16),
          random.range(1.05, 1.5)
        ),
        materials.floor.courtyard
      );
      slab.position.set(
        random.range(-0.25, 0.25),
        0.06,
        30.6 + i * 0.9 + random.range(-0.12, 0.12)
      );
      slab.rotation.y = random.range(-0.055, 0.055);
      slab.receiveShadow = true;
      path.add(slab);
    }
    group.add(path);

    const wreck = buildBrokenHull(THREE, materials, random);
    wreck.group.position.set(31, -0.25, 31);
    wreck.group.rotation.y = -0.66;
    group.add(wreck.group);

    return {
      group,
      mesh: islandMesh,
      rocks,
      contains: function contains(x, z) {
        const radius = Math.hypot(x, z);
        const angle = Math.atan2(x, z);
        return radius < radiusProfile(angle) - 1.2;
      },
      getShoreRadius: function getShoreRadius(x, z) {
        return radiusProfile(Math.atan2(x, z));
      },
      wreck
    };
  }

  function buildBrokenHull(THREE, materials, random) {
    const group = new THREE.Group();
    group.name = 'BrokenHull';
    const hull = new THREE.Group();
    const curvature = 0.38;

    for (let i = 0; i < 11; i += 1) {
      const t = i / 10;
      const width = 0.4 + Math.sin(t * Math.PI) * 1.35;
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.16, 0.48),
        materials.wood
      );
      plank.position.set(
        (t - 0.5) * 5.2,
        -0.3 + Math.sin(t * Math.PI) * curvature,
        0
      );
      plank.rotation.z = Math.cos(t * Math.PI) * 0.28;
      plank.rotation.y = random.range(-0.08, 0.08);
      plank.castShadow = true;
      hull.add(plank);
    }

    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 5; i += 1) {
        const rib = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.12 + i * 0.32, 0.18),
          materials.wood
        );
        rib.position.set(-1.9 + i * 0.92, 0.18 + i * 0.12, side * 0.36);
        rib.rotation.x = side * (0.5 + i * 0.045);
        rib.castShadow = true;
        hull.add(rib);
      }
    }

    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.13, 3.7, 8),
      materials.wood
    );
    mast.position.set(0.15, 1.35, 0);
    mast.rotation.z = 0.34;
    mast.castShadow = true;
    hull.add(mast);

    const shard = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.12, 0.18),
      materials.wood
    );
    shard.position.set(1.25, 1.65, 0.1);
    shard.rotation.z = 0.16;
    shard.rotation.y = -0.4;
    hull.add(shard);

    group.add(hull);
    return { group, hull };
  }

  Changming.createIsland = buildIsland;
})(typeof window !== 'undefined' ? window : globalThis);
