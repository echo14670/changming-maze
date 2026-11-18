(function (global) {
  'use strict';

  const Changming = (global.Changming = global.Changming || {});
  const createRandom = Changming.Random.createRandom;

  function makeCanvasTexture(THREE, options) {
    const size = options.size || 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    options.paint(context, size, options.random);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(options.repeatX || 1, options.repeatY || 1);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = options.anisotropy || 1;
    texture.needsUpdate = true;
    return texture;
  }

  function speckle(context, size, random, count, colors, maxRadius) {
    for (let i = 0; i < count; i += 1) {
      context.globalAlpha = random.range(0.035, 0.15);
      context.fillStyle = colors[Math.floor(random() * colors.length)];
      const radius = random.range(0.5, maxRadius || 4);
      context.beginPath();
      context.ellipse(
        random() * size,
        random() * size,
        radius * random.range(0.5, 1.8),
        radius,
        random() * Math.PI,
        0,
        Math.PI * 2
      );
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawStone(context, size, random) {
    context.fillStyle = '#797b75';
    context.fillRect(0, 0, size, size);
    const cell = size / 4;
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const shade = Math.floor(random.range(98, 136));
        context.fillStyle =
          'rgb(' +
          shade +
          ',' +
          Math.floor(shade * 0.98) +
          ',' +
          Math.floor(shade * 0.91) +
          ')';
        const inset = random.range(1, 3);
        context.fillRect(
          col * cell + inset,
          row * cell + inset,
          cell - inset * 2,
          cell - inset * 2
        );
        context.strokeStyle = 'rgba(34,35,32,.42)';
        context.lineWidth = 2;
        context.strokeRect(
          col * cell + 0.5,
          row * cell + 0.5,
          cell - 1,
          cell - 1
        );
      }
    }
    speckle(context, size, random, 280, ['#d0c8b1', '#343936', '#8c8068'], 2.8);
  }

  function drawMossStone(context, size, random) {
    drawStone(context, size, random);
    const gradient = context.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, 'rgba(49,78,60,.42)');
    gradient.addColorStop(0.46, 'rgba(78,112,80,.12)');
    gradient.addColorStop(1, 'rgba(13,45,38,.38)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    speckle(context, size, random, 210, ['#4c7355', '#78966d', '#243f34'], 4);
  }

  function drawBrick(context, size, random) {
    context.fillStyle = '#382523';
    context.fillRect(0, 0, size, size);
    const rowHeight = size / 8;
    const brickWidth = size / 4;
    for (let row = 0; row < 8; row += 1) {
      const offset = row % 2 === 0 ? 0 : -brickWidth / 2;
      for (let col = -1; col < 5; col += 1) {
        const shade = Math.floor(random.range(103, 148));
        context.fillStyle =
          'rgb(' +
          shade +
          ',' +
          Math.floor(shade * 0.64) +
          ',' +
          Math.floor(shade * 0.51) +
          ')';
        context.fillRect(
          offset + col * brickWidth + 2,
          row * rowHeight + 2,
          brickWidth - 4,
          rowHeight - 4
        );
      }
    }
    speckle(context, size, random, 150, ['#d59060', '#1f1716', '#8d4938'], 1.7);
  }

  function drawMarble(context, size, random) {
    const gradient = context.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#cfc8b4');
    gradient.addColorStop(0.45, '#a99f88');
    gradient.addColorStop(1, '#6f685d');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    for (let i = 0; i < 16; i += 1) {
      context.beginPath();
      let x = random() * size;
      let y = -10;
      context.moveTo(x, y);
      while (y < size + 10) {
        y += random.range(8, 22);
        x += random.range(-15, 15);
        context.lineTo(x, y);
      }
      context.strokeStyle =
        i % 3 === 0 ? 'rgba(67,59,50,.34)' : 'rgba(238,229,202,.28)';
      context.lineWidth = random.range(0.4, 1.8);
      context.stroke();
    }
    speckle(context, size, random, 100, ['#f0e7cf', '#524b42'], 2);
  }

  function drawWood(context, size, random) {
    context.fillStyle = '#4e3427';
    context.fillRect(0, 0, size, size);
    for (let i = 0; i < 26; i += 1) {
      context.beginPath();
      context.moveTo(0, (i / 26) * size + random.range(-3, 3));
      for (let x = 0; x <= size; x += 16) {
        context.lineTo(x, (i / 26) * size + Math.sin(x * 0.07 + i) * 2.5);
      }
      context.strokeStyle =
        i % 4 === 0 ? 'rgba(18,10,8,.55)' : 'rgba(140,94,61,.24)';
      context.lineWidth = random.range(0.4, 1.6);
      context.stroke();
    }
    speckle(context, size, random, 50, ['#1b100b', '#ad7850'], 2);
  }

  function materialWithMap(THREE, options) {
    return new THREE.MeshStandardMaterial({
      color: options.color || 0xffffff,
      map: options.map || null,
      bumpMap: options.bumpMap || null,
      bumpScale: options.bumpScale == null ? 0.07 : options.bumpScale,
      roughness: options.roughness == null ? 0.86 : options.roughness,
      metalness: options.metalness == null ? 0.02 : options.metalness,
      transparent: !!options.transparent,
      opacity: options.opacity == null ? 1 : options.opacity,
      side: options.side || THREE.FrontSide,
      emissive: options.emissive || 0x000000,
      emissiveIntensity:
        options.emissiveIntensity == null ? 1 : options.emissiveIntensity
    });
  }

  function createMaterialLibrary(THREE, options) {
    const settings = options || {};
    const random = createRandom((settings.seed || 20261205) + ':materials');
    const anisotropy =
      settings.renderer && settings.renderer.capabilities
        ? Math.min(8, settings.renderer.capabilities.getMaxAnisotropy())
        : 1;
    const textures = [];

    function texture(name, painter, repeatX, repeatY) {
      const value = makeCanvasTexture(THREE, {
        random,
        paint: painter,
        repeatX,
        repeatY,
        anisotropy
      });
      textures.push(value);
      return value;
    }

    const stoneMap = texture('stone', drawStone, 2, 2);
    const mossMap = texture('moss-stone', drawMossStone, 2, 2);
    const brickMap = texture('brick', drawBrick, 2, 2);
    const marbleMap = texture('marble', drawMarble, 3, 3);
    const woodMap = texture('wood', drawWood, 2, 1);

    const wallMaterials = {
      courtyard: materialWithMap(THREE, {
        map: stoneMap,
        bumpMap: stoneMap,
        color: 0xaab3a8,
        bumpScale: 0.075
      }),
      water: materialWithMap(THREE, {
        map: mossMap,
        bumpMap: mossMap,
        color: 0x82968b,
        bumpScale: 0.095
      }),
      ember: materialWithMap(THREE, {
        map: brickMap,
        bumpMap: brickMap,
        color: 0xae8d7d,
        bumpScale: 0.065
      }),
      atrium: materialWithMap(THREE, {
        map: marbleMap,
        bumpMap: marbleMap,
        color: 0xbab098,
        bumpScale: 0.045
      })
    };

    const floorMaterials = {
      courtyard: materialWithMap(THREE, {
        map: stoneMap,
        bumpMap: stoneMap,
        color: 0x777f74,
        roughness: 0.93
      }),
      water: materialWithMap(THREE, {
        map: mossMap,
        bumpMap: mossMap,
        color: 0x4e6e63,
        roughness: 0.9
      }),
      ember: materialWithMap(THREE, {
        map: brickMap,
        bumpMap: brickMap,
        color: 0x77594c,
        roughness: 0.92
      }),
      atrium: materialWithMap(THREE, {
        map: marbleMap,
        bumpMap: marbleMap,
        color: 0xc4b99d,
        roughness: 0.6,
        metalness: 0.08
      })
    };

    const materials = {
      wall: wallMaterials,
      floor: floorMaterials,
      wallCap: new THREE.MeshStandardMaterial({
        color: 0x92968b,
        roughness: 0.95,
        metalness: 0
      }),
      wallCaps: {
        courtyard: new THREE.MeshStandardMaterial({
          color: 0x82968d,
          roughness: 0.94
        }),
        water: new THREE.MeshStandardMaterial({
          color: 0x4c8279,
          roughness: 0.94
        }),
        ember: new THREE.MeshStandardMaterial({
          color: 0xa56951,
          roughness: 0.92
        }),
        atrium: new THREE.MeshStandardMaterial({
          color: 0xc7ae7b,
          roughness: 0.84
        })
      },
      boundaryStone: new THREE.MeshStandardMaterial({
        color: 0x6b746b,
        roughness: 0.96
      }),
      cliff: new THREE.MeshStandardMaterial({
        color: 0x3e4a45,
        roughness: 0.98,
        vertexColors: true
      }),
      reef: new THREE.MeshStandardMaterial({
        color: 0x4d5c55,
        roughness: 0.96
      }),
      wood: materialWithMap(THREE, {
        map: woodMap,
        bumpMap: woodMap,
        color: 0x7a5b45,
        roughness: 0.88,
        bumpScale: 0.06
      }),
      iron: new THREE.MeshStandardMaterial({
        color: 0x292c2b,
        roughness: 0.48,
        metalness: 0.72
      }),
      bronze: new THREE.MeshStandardMaterial({
        color: 0x7f6337,
        roughness: 0.42,
        metalness: 0.72
      }),
      gold: new THREE.MeshStandardMaterial({
        color: 0xc09a4e,
        roughness: 0.34,
        metalness: 0.82
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0x9ac7d6,
        transparent: true,
        opacity: 0.18,
        roughness: 0.12,
        metalness: 0.08,
        transmission: 0.38,
        side: THREE.DoubleSide
      }),
      water: new THREE.MeshPhysicalMaterial({
        color: 0x469598,
        transparent: true,
        opacity: 0.68,
        roughness: 0.19,
        metalness: 0.1,
        transmission: 0.26,
        side: THREE.DoubleSide
      }),
      moss: new THREE.MeshStandardMaterial({
        color: 0x37513e,
        roughness: 1
      }),
      ember: new THREE.MeshStandardMaterial({
        color: 0xff7c35,
        emissive: 0xff5b1f,
        emissiveIntensity: 4,
        roughness: 0.55,
        toneMapped: false
      }),
      beacon: new THREE.MeshStandardMaterial({
        color: 0xffe5a3,
        emissive: 0xffb84e,
        emissiveIntensity: 3.2,
        roughness: 0.18,
        toneMapped: false
      }),
      windowGlow: new THREE.MeshStandardMaterial({
        color: 0xe7a35b,
        emissive: 0xff8a3c,
        emissiveIntensity: 1.35,
        roughness: 0.38,
        toneMapped: false
      })
    };

    return {
      materials,
      textures,
      dispose: function dispose() {
        Object.values(wallMaterials).forEach(function (material) {
          material.dispose();
        });
        Object.values(floorMaterials).forEach(function (material) {
          material.dispose();
        });
        Object.values(materials.wallCaps).forEach(function (material) {
          material.dispose();
        });
        Object.keys(materials).forEach(function (key) {
          if (key !== 'wall' && key !== 'floor' && key !== 'wallCaps') {
            materialByDispose(materials[key]);
          }
        });
        textures.forEach(function (textureValue) {
          textureValue.dispose();
        });
      }
    };
  }

  function materialByDispose(value) {
    if (value && typeof value.dispose === 'function') value.dispose();
  }

  Changming.WorldMaterials = Object.freeze({
    create: createMaterialLibrary
  });
})(typeof window !== 'undefined' ? window : globalThis);
