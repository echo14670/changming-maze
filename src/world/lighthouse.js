(function (global) {
  'use strict';

  const Changming = (global.Changming = global.Changming || {});

  function makeDoorShape(THREE, width, height) {
    const radius = width / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(width / 2, height - radius);
    shape.absarc(0, height - radius, radius, 0, Math.PI, false);
    shape.lineTo(-width / 2, 0);
    return shape;
  }

  function createLighthouse(THREE, materials, options) {
    const settings = options || {};
    const group = new THREE.Group();
    group.name = 'LighthouseExterior';
    group.userData.module = 'B/lighthouse';

    const stone = materials.wall.atrium;
    const wallStone = materials.wall.courtyard;
    const bronze = materials.bronze;
    const iron = materials.iron;
    const glass = materials.glass;
    const glow = materials.windowGlow;
    const baseY = settings.baseY == null ? 0.6 : settings.baseY;

    function addMesh(geometry, material, y, castShadow, receiveShadow) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = y;
      mesh.castShadow = castShadow !== false;
      mesh.receiveShadow = receiveShadow !== false;
      group.add(mesh);
      return mesh;
    }

    const foundation = addMesh(
      new THREE.CylinderGeometry(4.25, 4.55, 0.8, 24, 1),
      wallStone,
      baseY + 0.4,
      true
    );
    foundation.name = 'LighthousePlinth';

    const lowerRing = addMesh(
      new THREE.CylinderGeometry(3.55, 3.8, 0.55, 24, 1),
      stone,
      baseY + 1.05
    );
    lowerRing.name = 'LighthouseFoundationBand';

    const towerHeight = 17.8;
    const tower = addMesh(
      new THREE.CylinderGeometry(2.5, 3.35, towerHeight, 24, 5),
      stone,
      baseY + 1.1 + towerHeight / 2
    );
    tower.name = 'LighthouseTower';

    [5.2, 10.0, 14.8].forEach(function (relativeY, index) {
      const ring = addMesh(
        new THREE.CylinderGeometry(
          3.22 - index * 0.22,
          3.34 - index * 0.22,
          0.22,
          24,
          1
        ),
        index === 2 ? bronze : wallStone,
        baseY + relativeY
      );
      ring.name = 'LighthouseStoneBand' + (index + 1);
    });

    const buttressGeometry = new THREE.BoxGeometry(0.46, 6.6, 0.7);
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const radius = 3.15;
      const buttress = new THREE.Mesh(buttressGeometry, wallStone);
      buttress.position.set(
        Math.sin(angle) * radius,
        baseY + 4.1,
        Math.cos(angle) * radius
      );
      buttress.rotation.y = angle;
      buttress.rotation.x = -0.035;
      buttress.castShadow = true;
      buttress.receiveShadow = true;
      group.add(buttress);
    }

    const doorShape = makeDoorShape(THREE, 2.55, 3.55);
    const frameShape = makeDoorShape(THREE, 3.18, 4.08);
    frameShape.holes.push(doorShape);
    const frameMesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(frameShape, {
        depth: 0.18,
        bevelEnabled: true,
        bevelSize: 0.05,
        bevelThickness: 0.04,
        bevelSegments: 2,
        curveSegments: 8
      }),
      bronze
    );
    frameMesh.position.set(0, baseY + 0.8, 3.31);
    frameMesh.castShadow = true;
    group.add(frameMesh);

    const doorInset = new THREE.Mesh(
      new THREE.ShapeGeometry(doorShape),
      new THREE.MeshStandardMaterial({
        color: 0x1f1712,
        roughness: 0.5,
        metalness: 0.15
      })
    );
    doorInset.position.set(0, baseY + 0.8, 3.51);
    group.add(doorInset);

    const doorRoot = new THREE.Group();
    doorRoot.position.set(0, baseY + 0.8, 3.54);
    doorRoot.name = 'LighthouseDoorRoot';
    group.add(doorRoot);

    const doorPanelMaterial = materials.wood.clone();
    doorPanelMaterial.color.setHex(0x4e2e1b);
    const doorPivots = [];
    [-1, 1].forEach(function (side) {
      const pivot = new THREE.Group();
      pivot.position.x = side * 1.24;
      doorRoot.add(pivot);

      const panelShape = new THREE.Shape();
      const panelWidth = 1.23;
      panelShape.moveTo(side < 0 ? 0 : -panelWidth, 0);
      panelShape.lineTo(side < 0 ? panelWidth : 0, 0);
      panelShape.lineTo(side < 0 ? panelWidth : 0, 2.61);
      panelShape.absarc(
        side < 0 ? panelWidth / 2 : -panelWidth / 2,
        2.61,
        panelWidth / 2,
        0,
        Math.PI,
        side > 0
      );
      panelShape.lineTo(side < 0 ? 0 : -panelWidth, 0);

      const panel = new THREE.Mesh(
        new THREE.ExtrudeGeometry(panelShape, {
          depth: 0.1,
          bevelEnabled: true,
          bevelSize: 0.035,
          bevelThickness: 0.025,
          bevelSegments: 1,
          curveSegments: 8
        }),
        doorPanelMaterial
      );
      panel.castShadow = true;
      pivot.add(panel);

      for (let band = 0; band < 4; band += 1) {
        const brace = new THREE.Mesh(
          new THREE.BoxGeometry(panelWidth * 0.82, 0.06, 0.035),
          iron
        );
        brace.position.set(0, 0.4 + band * 0.6, 0.16);
        pivot.add(brace);
      }
      doorPivots.push({ pivot, side });
    });

    function addWindow(y, angle, scale) {
      const windowGroup = new THREE.Group();
      const radius = 3.1 - ((y - baseY) / towerHeight) * 0.66;
      windowGroup.position.set(
        Math.sin(angle) * radius,
        y,
        Math.cos(angle) * radius
      );
      windowGroup.rotation.y = angle;

      const pane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.62 * scale, 1.3 * scale),
        new THREE.MeshStandardMaterial({
          color: 0x2a2825,
          emissive: 0xe28a47,
          emissiveIntensity: 0.1,
          roughness: 0.32
        })
      );
      pane.position.z = 0.035;
      windowGroup.add(pane);

      const sill = new THREE.Mesh(
        new THREE.BoxGeometry(0.9 * scale, 0.13, 0.22),
        wallStone
      );
      sill.position.y = -0.76 * scale;
      windowGroup.add(sill);
      group.add(windowGroup);
      return pane;
    }

    const windowPanes = [
      addWindow(baseY + 7.2, 0, 1),
      addWindow(baseY + 11.1, 0.04, 0.86),
      addWindow(baseY + 7.2, Math.PI * 0.64, 0.92),
      addWindow(baseY + 11.1, -Math.PI * 0.68, 0.78)
    ];
    windowPanes.forEach(function (pane) {
      pane.userData.noMerge = true;
    });

    const galleryY = baseY + 19.15;
    const gallery = addMesh(
      new THREE.CylinderGeometry(3.45, 3.2, 0.28, 24, 1),
      bronze,
      galleryY
    );
    gallery.name = 'LighthouseGallery';

    const galleryUnderside = addMesh(
      new THREE.CylinderGeometry(3.1, 3.55, 0.18, 24, 1),
      iron,
      galleryY - 0.22
    );
    galleryUnderside.name = 'LighthouseGalleryBrackets';

    const railInner = new THREE.Group();
    railInner.name = 'LighthouseRail';
    group.add(railInner);
    const postGeometry = new THREE.CylinderGeometry(0.035, 0.045, 1.03, 7);
    const postCount = 20;
    for (let i = 0; i < postCount; i += 1) {
      const angle = (i / postCount) * Math.PI * 2;
      const post = new THREE.Mesh(postGeometry, bronze);
      post.position.set(
        Math.sin(angle) * 3.22,
        galleryY + 0.55,
        Math.cos(angle) * 3.22
      );
      railInner.add(post);
    }
    const topRail = new THREE.Mesh(
      new THREE.TorusGeometry(3.22, 0.045, 6, 64),
      bronze
    );
    topRail.position.y = galleryY + 1.08;
    topRail.rotation.x = Math.PI / 2;
    railInner.add(topRail);

    const lanternBase = addMesh(
      new THREE.CylinderGeometry(2.35, 2.68, 0.38, 16, 1),
      bronze,
      galleryY + 0.36
    );
    lanternBase.name = 'LanternRoomBase';

    const lanternGlass = addMesh(
      new THREE.CylinderGeometry(2.02, 2.18, 2.65, 16, 1, true),
      glass,
      galleryY + 1.7,
      false,
      false
    );
    lanternGlass.name = 'LanternRoomGlass';

    const lanternFrames = new THREE.Group();
    lanternFrames.name = 'LanternRoomFrames';
    group.add(lanternFrames);
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 2.75, 0.08),
        iron
      );
      frame.position.set(
        Math.sin(angle) * 2.12,
        galleryY + 1.7,
        Math.cos(angle) * 2.12
      );
      frame.rotation.y = angle;
      lanternFrames.add(frame);
    }

    const roof = addMesh(
      new THREE.ConeGeometry(2.8, 1.8, 8, 2),
      iron,
      galleryY + 3.7
    );
    roof.rotation.y = Math.PI / 8;
    roof.name = 'LighthouseRoof';

    const finial = addMesh(
      new THREE.CylinderGeometry(0.035, 0.08, 1.2, 7),
      bronze,
      galleryY + 5.02
    );
    finial.name = 'LighthouseFinial';

    const beacon = addMesh(
      new THREE.IcosahedronGeometry(0.78, 2),
      materials.beacon,
      galleryY + 1.72,
      false,
      false
    );
    beacon.name = 'MainBeacon';
    beacon.scale.set(1, 1.08, 1);

    const haloMaterial = new THREE.SpriteMaterial({
      color: 0xffc56e,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const halo = new THREE.Sprite(haloMaterial);
    halo.position.copy(beacon.position);
    halo.scale.set(5.6, 5.6, 1);
    halo.name = 'BeaconHalo';
    group.add(halo);

    const beaconLight = new THREE.PointLight(0xffb457, 2.1, 34, 1.6);
    beaconLight.position.copy(beacon.position);
    beaconLight.castShadow = false;
    beaconLight.userData.owner = 'C';
    group.add(beaconLight);

    const beamMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd790,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    const beamGeometry = new THREE.ConeGeometry(12, 100, 24, 1, true);
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    beam.name = 'LighthouseBeam';
    beam.rotation.z = Math.PI / 2;
    beam.position.set(50, galleryY + 1.72, 0);
    beam.visible = false;
    beam.userData.noMerge = true;
    halo.userData.noMerge = true;
    beacon.userData.noMerge = true;
    doorRoot.traverse(function (child) {
      child.userData.noMerge = true;
    });
    group.add(beam);

    const doorLamp = new THREE.PointLight(0xff974d, 1.1, 12, 2);
    doorLamp.position.set(0, baseY + 3.9, 4.1);
    doorLamp.userData.owner = 'C';
    group.add(doorLamp);

    const doorAnchor = new THREE.Object3D();
    doorAnchor.name = 'LighthouseDoorInteractionAnchor';
    doorAnchor.position.set(0, baseY + 1.15, 4.35);
    group.add(doorAnchor);

    const beaconAnchor = new THREE.Object3D();
    beaconAnchor.name = 'MainBeaconAnchor';
    beaconAnchor.position.copy(beacon.position);
    group.add(beaconAnchor);

    let doorOpen = 0;
    let beaconIntensity = 0.18;
    let targetBeaconIntensity = 0.18;

    return {
      group,
      tower,
      doorRoot,
      doorAnchor,
      doorLamp,
      beacon,
      beaconAnchor,
      beaconLight,
      beam,
      windowPanes,
      addCollider: function addCollider(collision) {
        collision.addCircle(0, 0, 3.55, {
          kind: 'lighthouse',
          id: 'lighthouse-base'
        });
        return collision;
      },
      setDoorOpen: function setDoorOpen(value) {
        doorOpen = Math.max(0, Math.min(1, value));
      },
      setBeaconIntensity: function setBeaconIntensity(value, immediate) {
        targetBeaconIntensity = Math.max(0, value);
        if (immediate) beaconIntensity = targetBeaconIntensity;
      },
      getDoorOpen: function getDoorOpen() {
        return doorOpen;
      },
      update: function update(time) {
        const easedDoor =
          doorOpen * doorOpen * (3 - 2 * doorOpen);
        doorPivots.forEach(function (entry) {
          entry.pivot.rotation.y =
            entry.side * easedDoor * THREE.MathUtils.degToRad(72);
        });

        beaconIntensity +=
          (targetBeaconIntensity - beaconIntensity) * 0.025;
        const pulse =
          0.92 +
          Math.sin(time * 2.03) * 0.055 +
          Math.sin(time * 5.21) * 0.018;
        materials.beacon.emissiveIntensity = beaconIntensity * 5.5 * pulse;
        beaconLight.intensity = beaconIntensity * 9 * pulse;
        beaconLight.distance = 28 + beaconIntensity * 34;
        haloMaterial.opacity =
          Math.min(0.92, 0.18 + beaconIntensity * 0.65) * pulse;
        halo.scale.setScalar(4.3 + beaconIntensity * 3.2);
        beam.visible = beaconIntensity > 0.35;
        beamMaterial.opacity = Math.max(
          0,
          Math.min(0.2, (beaconIntensity - 0.3) * 0.21)
        );
        beam.rotation.y = time * 0.035;
        doorLamp.intensity = 0.9 + Math.sin(time * 3.7) * 0.08;
        windowPanes.forEach(function (pane, index) {
          pane.material.emissiveIntensity =
            0.18 + beaconIntensity * 0.5 + Math.sin(time * 1.4 + index) * 0.03;
        });
      }
    };
  }

  Changming.createLighthouse = createLighthouse;
})(typeof window !== 'undefined' ? window : globalThis);
