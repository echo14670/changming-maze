(function (global) {
  'use strict';

  const Changming = (global.Changming = global.Changming || {});
  const createRandom = Changming.Random.createRandom;

  function buildOcean(THREE, options) {
    const settings = options || {};
    const group = new THREE.Group();
    group.name = 'OpenSea';
    group.userData.module = 'B/ocean';
    group.userData.replaceableBy = 'C/water';

    const shader = {
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color(0x123b47) },
        uShallow: { value: new THREE.Color(0x3c7f8b) },
        uHorizon: { value: new THREE.Color(0x628f98) },
        uFog: { value: new THREE.Color(0x17343e) },
        uMoonDirection: { value: new THREE.Vector3(-0.36, 0.62, -0.7).normalize() },
        uMoonColor: { value: new THREE.Color(0x9fcbe5) }
      },
      vertexShader: [
        'uniform float uTime;',
        'varying vec3 vWorldPosition;',
        'varying float vWave;',
        'varying vec3 vWorldNormal;',
        'float waveHeight(vec2 p) {',
        '  return sin(p.x * 0.095 + uTime * 0.48) * 0.42',
        '    + sin(p.y * 0.072 - uTime * 0.31) * 0.5',
        '    + sin((p.x + p.y) * 0.19 + uTime * 0.74) * 0.16',
        '    + sin((p.x - p.y * 0.62) * 0.33 - uTime * 0.6) * 0.07;',
        '}',
        'void main() {',
        '  vec3 displaced = position;',
        '  float h = waveHeight(position.xy);',
        '  displaced.z += h;',
        '  float eps = 0.75;',
        '  float hx = waveHeight(position.xy + vec2(eps, 0.0));',
        '  float hy = waveHeight(position.xy + vec2(0.0, eps));',
        '  vec3 localNormal = normalize(vec3(h - hx, h - hy, eps));',
        '  vec4 world = modelMatrix * vec4(displaced, 1.0);',
        '  vWorldPosition = world.xyz;',
        '  vWorldNormal = normalize(mat3(modelMatrix) * localNormal);',
        '  vWave = h;',
        '  gl_Position = projectionMatrix * viewMatrix * world;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime;',
        'uniform vec3 uDeep;',
        'uniform vec3 uShallow;',
        'uniform vec3 uHorizon;',
        'uniform vec3 uFog;',
        'uniform vec3 uMoonDirection;',
        'uniform vec3 uMoonColor;',
        'varying vec3 vWorldPosition;',
        'varying float vWave;',
        'varying vec3 vWorldNormal;',
        'void main() {',
        '  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);',
        '  float fresnel = pow(1.0 - max(dot(vWorldNormal, viewDirection), 0.0), 3.0);',
        '  float moonAmount = max(dot(vWorldNormal, uMoonDirection), 0.0);',
        '  float moonGlint = pow(moonAmount, 34.0);',
        '  vec3 reflectedView = reflect(-viewDirection, vWorldNormal);',
        '  float moonSpecular = pow(max(dot(reflectedView, uMoonDirection), 0.0), 26.0);',
        '  float stripe = smoothstep(0.945, 1.0, sin(vWorldPosition.x * 0.19 + vWorldPosition.z * 0.075 + uTime * 0.62));',
        '  vec3 water = mix(uDeep, uShallow, 0.34 + vWave * 0.28);',
        '  water = mix(water, uHorizon, fresnel * 0.54);',
        '  water += uMoonColor * moonGlint * (0.55 + stripe * 2.1);',
        '  water += uMoonColor * moonSpecular * 1.4;',
        '  water += vec3(0.018, 0.04, 0.045) * max(vWorldNormal.y, 0.0);',
        '  water += vec3(0.1, 0.18, 0.17) * stripe * 0.23;',
        '  float distanceToCamera = length(cameraPosition - vWorldPosition);',
        '  float fogAmount = 1.0 - exp(-pow(distanceToCamera * 0.0042, 1.55));',
        '  gl_FragColor = vec4(mix(water, uFog, clamp(fogAmount, 0.0, 0.84)), 1.0);',
        '}'
      ].join('\n')
    };

    const geometry = new THREE.PlaneGeometry(1600, 1600, 150, 150);
    const material = new THREE.ShaderMaterial({
      uniforms: shader.uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader,
      side: THREE.DoubleSide
    });
    material.extensions = { derivatives: true };

    const oceanMesh = new THREE.Mesh(geometry, material);
    oceanMesh.name = 'OpenSeaMesh';
    oceanMesh.rotation.x = -Math.PI / 2;
    oceanMesh.position.y = settings.seaLevel == null ? -1.12 : settings.seaLevel;
    oceanMesh.receiveShadow = true;
    group.add(oceanMesh);

    const foamGeometry = new THREE.RingGeometry(48.8, 51.1, 96, 3);
    foamGeometry.rotateX(-Math.PI / 2);
    const foamMaterial = new THREE.MeshBasicMaterial({
      color: 0x78989a,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const foam = new THREE.Mesh(foamGeometry, foamMaterial);
    foam.name = 'ShoreFoam';
    foam.position.y = -0.87;
    group.add(foam);

    const boatGroup = buildDistantBoats(THREE, settings.seed || 20261205);
    group.add(boatGroup);

    return {
      group,
      mesh: oceanMesh,
      material,
      foam,
      boats: boatGroup,
      update: function update(time) {
        shader.uniforms.uTime.value = time;
        foamMaterial.opacity = 0.11 + Math.sin(time * 0.43) * 0.045;
        foam.scale.setScalar(1 + Math.sin(time * 0.32) * 0.004);
        boatGroup.userData.lights.material.opacity =
          0.55 + Math.sin(time * 1.7) * 0.14;
      }
    };
  }

  function buildDistantBoats(THREE, seed) {
    const random = createRandom(seed + ':boats');
    const group = new THREE.Group();
    group.name = 'DistantBoatLights';
    const lightPositions = [];
    const boatGeometry = new THREE.BoxGeometry(1.4, 0.25, 0.45);
    const boatMaterial = new THREE.MeshBasicMaterial({ color: 0x111b20 });
    const bobbers = [];

    for (let i = 0; i < 11; i += 1) {
      const angle = random.range(-Math.PI * 0.88, Math.PI * 0.88);
      const radius = random.range(125, 285);
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const y = -0.72 + Math.sin(angle) * 0.2;

      const boat = new THREE.Mesh(boatGeometry, boatMaterial);
      boat.userData.noMerge = true;
      boat.position.set(x, y, z);
      boat.rotation.y = random.range(-0.5, 0.5) - angle * 0.1;
      boat.scale.set(random.range(0.7, 1.7), 1, random.range(0.7, 1.2));
      group.add(boat);
      bobbers.push({ object: boat, baseY: y, phase: random() * Math.PI * 2 });

      lightPositions.push(x, y + 0.3, z);
      if (random.chance(0.45)) {
        lightPositions.push(x + random.range(-0.25, 0.25), y + 0.22, z);
      }
    }

    const lightGeometry = new THREE.BufferGeometry();
    lightGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(lightPositions, 3)
    );
    const lightMaterial = new THREE.PointsMaterial({
      color: 0xffc163,
      size: 4.2,
      transparent: true,
      opacity: 0.82,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const lights = new THREE.Points(lightGeometry, lightMaterial);
    lights.name = 'BoatLights';
    group.add(lights);
    group.userData.lights = lights;
    group.userData.bobbers = bobbers;
    group.userData.updateBobbers = function updateBobbers(time) {
      bobbers.forEach(function (boat) {
        boat.object.position.y =
          boat.baseY + Math.sin(time * 0.55 + boat.phase) * 0.08;
        boat.object.rotation.z =
          Math.sin(time * 0.43 + boat.phase) * 0.018;
      });
    };
    return group;
  }

  Changming.createOcean = buildOcean;
})(typeof window !== 'undefined' ? window : globalThis);
