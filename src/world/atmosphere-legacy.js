(function (global) {
  'use strict';

  const Changming = (global.Changming = global.Changming || {});
  const createRandom = Changming.Random.createRandom;

  function createAtmosphere(THREE, scene, renderer, options) {
    const settings = options || {};
    const random = createRandom((settings.seed || 20261205) + ':sky');
    const group = new THREE.Group();
    group.name = 'PreviewAtmosphere';

    scene.fog = new THREE.FogExp2(0x0a1821, 0.0062);
    scene.background = new THREE.Color(0x0a1821);

    const skyUniforms = {
      uTop: { value: new THREE.Color(0x020913) },
      uHorizon: { value: new THREE.Color(0x244550) },
      uMoonDirection: {
        value: new THREE.Vector3(-0.42, 0.52, -0.74).normalize()
      }
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(620, 40, 20),
      new THREE.ShaderMaterial({
        uniforms: skyUniforms,
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: [
          'varying vec3 vDirection;',
          'void main() {',
          '  vDirection = normalize(position);',
          '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
          '}'
        ].join('\n'),
        fragmentShader: [
          'uniform vec3 uTop;',
          'uniform vec3 uHorizon;',
          'uniform vec3 uMoonDirection;',
          'varying vec3 vDirection;',
          'void main() {',
          '  float h = clamp(vDirection.y * 0.5 + 0.5, 0.0, 1.0);',
          '  vec3 color = mix(uHorizon, uTop, smoothstep(0.48, 0.92, h));',
          '  float moonHalo = pow(max(dot(normalize(vDirection), uMoonDirection), 0.0), 18.0);',
          '  color += vec3(0.14, 0.22, 0.28) * moonHalo;',
          '  gl_FragColor = vec4(color, 1.0);',
          '}'
        ].join('\n')
      })
    );
    sky.name = 'NightSky';
    sky.frustumCulled = false;
    group.add(sky);

    const starPositions = [];
    for (let i = 0; i < 620; i += 1) {
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(random.range(0.08, 1));
      const radius = 520 + random.range(-20, 18);
      starPositions.push(
        Math.sin(phi) * Math.cos(theta) * radius,
        Math.cos(phi) * radius,
        Math.sin(phi) * Math.sin(theta) * radius
      );
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(starPositions, 3)
    );
    const starMaterial = new THREE.PointsMaterial({
      color: 0xa6c1d2,
      size: 1.15,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      fog: false,
      sizeAttenuation: true
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    stars.name = 'Stars';
    group.add(stars);

    const moonTexture = makeMoonTexture(THREE);
    const moonMaterial = new THREE.SpriteMaterial({
      map: moonTexture,
      color: 0xd4e4ed,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      fog: false
    });
    const moon = new THREE.Sprite(moonMaterial);
    moon.name = 'DistantMoon';
    moon.position.set(-260, 290, -420);
    moon.scale.set(43, 43, 1);
    group.add(moon);

    const hemisphere = new THREE.HemisphereLight(0x9cbccc, 0x1d2b30, 2.1);
    hemisphere.name = 'MoonAmbient';
    group.add(hemisphere);

    const moonLight = new THREE.DirectionalLight(0xb9d5e3, 3.8);
    moonLight.name = 'MoonDirectionalLight';
    moonLight.position.set(-48, 72, 32);
    moonLight.target.position.set(0, 0, 0);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(2048, 2048);
    moonLight.shadow.camera.left = -48;
    moonLight.shadow.camera.right = 48;
    moonLight.shadow.camera.top = 48;
    moonLight.shadow.camera.bottom = -48;
    moonLight.shadow.camera.near = 8;
    moonLight.shadow.camera.far = 160;
    moonLight.shadow.bias = -0.00018;
    moonLight.shadow.normalBias = 0.035;
    group.add(moonLight);
    group.add(moonLight.target);

    const fill = new THREE.DirectionalLight(0x6493a0, 1.7);
    fill.name = 'SeaFillLight';
    fill.position.set(40, 18, -50);
    group.add(fill);

    const ambient = new THREE.AmbientLight(0x7d979f, 0.48);
    ambient.name = 'PreviewAmbient';
    group.add(ambient);

    const regionLights = [
      { x: 0, z: 22, y: 7, color: 0xb7d0cf, intensity: 1.15, distance: 32 },
      { x: -15, z: -12, y: 6, color: 0x65c8c3, intensity: 1.75, distance: 32 },
      { x: 15, z: -12, y: 6, color: 0xff8848, intensity: 2.2, distance: 34 },
      { x: 0, z: 0, y: 8, color: 0xffbf68, intensity: 1.65, distance: 26 }
    ];
    regionLights.forEach(function (definition, index) {
      const light = new THREE.PointLight(
        definition.color,
        definition.intensity,
        definition.distance,
        1.65
      );
      light.name = 'PreviewRegionLight-' + (index + 1);
      light.position.set(definition.x, definition.y, definition.z);
      light.userData.owner = 'C-preview-only';
      group.add(light);
    });

    scene.add(group);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.43;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    return {
      group,
      moonLight,
      hemisphere,
      ambient,
      moon,
      stars
    };
  }

  function makeMoonTexture(THREE) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    const halo = context.createRadialGradient(128, 128, 24, 128, 128, 124);
    halo.addColorStop(0, 'rgba(225,239,245,1)');
    halo.addColorStop(0.24, 'rgba(198,220,231,.92)');
    halo.addColorStop(0.34, 'rgba(156,194,211,.2)');
    halo.addColorStop(0.66, 'rgba(121,171,195,.07)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = halo;
    context.fillRect(0, 0, 256, 256);
    context.globalCompositeOperation = 'destination-in';
    context.beginPath();
    context.arc(128, 128, 122, 0, Math.PI * 2);
    context.fill();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  Changming.createPreviewAtmosphere = createAtmosphere;
})(typeof window !== 'undefined' ? window : globalThis);
