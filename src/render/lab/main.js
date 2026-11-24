import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createRenderer } from '../../engine/renderer.js'
import { createRenderPipeline } from '../pipeline.js'

const canvas = document.querySelector('#render-canvas')
const statusLine = document.querySelector('#lab-status')
const errorBanner = document.querySelector('#lab-error')

if (!canvas) throw new Error('render lab: missing #render-canvas')

const engine = createRenderer(canvas, { quality: 'high' })
const { scene, camera, renderer } = engine
renderer.info.autoReset = false

scene.background = new THREE.Color(0x06141b)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.dampingFactor = 0.075
controls.minDistance = 3.2
controls.maxDistance = 34
controls.maxPolarAngle = Math.PI * 0.485
controls.target.set(0, 1.7, -1)

const sky = createSky(scene)
const world = createRenderLabWorld(scene)
const pipeline = createRenderPipeline({
  scene,
  camera,
  renderer,
  engine,
  quality: 'high',
  water: {
    size: { x: 13.2, z: 9.2 },
    position: { x: 0, y: 0.035, z: -1.1 },
    deepColor: 0x082f39,
    shallowColor: 0x327b80,
    horizonColor: 0x547a81,
  },
  features: {
    shadow: true,
    lantern: true,
    volumetric: true,
    water: true,
    rain: false,
    bloom: true,
    pbr: true,
  },
})

const VIEWS = {
  courtyard: {
    position: new THREE.Vector3(11.8, 7.2, 15.2),
    target: new THREE.Vector3(0, 1.8, -1.4),
  },
  water: {
    position: new THREE.Vector3(8.35, 3.9, 3.4),
    target: new THREE.Vector3(0.2, 0.48, -1.15),
  },
  ember: {
    position: new THREE.Vector3(-8.4, 3.5, 6.4),
    target: new THREE.Vector3(-5.1, 1.4, -2.45),
  },
}

let fps = 0
let frames = 0
let fpsWindowStart = performance.now()
let lastFrame = 0
let elapsed = 0
let viewTween = null
let firstFrame = true

function setView(name, immediate = false) {
  const view = VIEWS[name] || VIEWS.courtyard
  if (immediate) {
    camera.position.copy(view.position)
    controls.target.copy(view.target)
    controls.update()
    viewTween = null
    return true
  }
  viewTween = {
    elapsed: 0,
    duration: 0.7,
    fromPosition: camera.position.clone(),
    toPosition: view.position.clone(),
    fromTarget: controls.target.clone(),
    toTarget: view.target.clone(),
  }
  return true
}

function updateViewTween(dt) {
  if (!viewTween) return
  viewTween.elapsed += dt
  const raw = Math.min(1, viewTween.elapsed / viewTween.duration)
  const t = raw * raw * (3 - 2 * raw)
  camera.position.lerpVectors(viewTween.fromPosition, viewTween.toPosition, t)
  controls.target.lerpVectors(viewTween.fromTarget, viewTween.toTarget, t)
  if (raw >= 1) viewTween = null
}

function setFeature(name, enabled) {
  return pipeline.setFeature(name, enabled)
}

function setQuality(quality) {
  const changed = engine.setQuality(quality)
  if (changed) {
    pipeline.setQuality(quality)
    updateQualityControls()
    syncFeatureControls()
    engine.resize()
    pipeline.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio)
  }
  return changed
}

function resize() {
  engine.resize()
  pipeline.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio)
}

function updateEnvironment(dt) {
  world.update(elapsed, dt)
  sky.material.uniforms.uTime.value = elapsed
}

function animate(now) {
  const dt = lastFrame === 0 ? 0 : Math.min((now - lastFrame) / 1000, 0.05)
  lastFrame = now
  elapsed += dt

  updateViewTween(dt)
  controls.update()
  updateEnvironment(dt)
  pipeline.update(dt)
  renderer.info.reset()
  pipeline.render(dt)

  frames += 1
  if (now - fpsWindowStart >= 500) {
    fps = (frames * 1000) / (now - fpsWindowStart)
    frames = 0
    fpsWindowStart = now
    updateStatus()
  }

  if (firstFrame) {
    firstFrame = false
    document.body.dataset.ready = 'true'
  }
  window.requestAnimationFrame(animate)
}

function updateStatus() {
  if (!statusLine) return
  const info = renderer.info.render
  statusLine.innerHTML = [
    `<span>${Math.round(fps)} FPS</span>`,
    `<span>${info.calls} CALLS</span>`,
    `<span>${formatNumber(info.triangles)} TRIS</span>`,
    `<span>${pipeline.getQuality().toUpperCase()}</span>`,
  ].join('')
}

function formatNumber(value) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return String(value)
}

function getDiagnostics() {
  const gl = renderer.getContext()
  const info = renderer.info.render
  const features = pipeline.getFeatures()
  return {
    webglVersion: gl.getParameter(gl.VERSION),
    glError: gl.getError(),
    fps: Math.round(fps * 10) / 10,
    drawCalls: info.calls,
    triangles: info.triangles,
    quality: pipeline.getQuality(),
    features,
    allFeaturesToggleable: Object.keys(features).every((name) =>
      pipeline.setFeature(name, features[name]),
    ),
    ready: document.body.dataset.ready === 'true',
  }
}

function installControls() {
  document.querySelectorAll('[data-feature]').forEach((input) => {
    input.addEventListener('change', () => {
      setFeature(input.dataset.feature, input.checked)
    })
  })
  syncFeatureControls()

  document.querySelectorAll('[data-quality]').forEach((button) => {
    button.addEventListener('click', () => setQuality(button.dataset.quality))
  })

  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view))
  })
}

function syncFeatureControls() {
  document.querySelectorAll('[data-feature]').forEach((input) => {
    input.checked = pipeline.getFeatures()[input.dataset.feature] !== false
  })
}

function updateQualityControls() {
  document.querySelectorAll('[data-quality]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.quality === pipeline.getQuality())
    button.setAttribute(
      'aria-pressed',
      String(button.dataset.quality === pipeline.getQuality()),
    )
  })
}

function showFatalError(error) {
  console.error('[render-lab]', error)
  if (errorBanner) {
    errorBanner.hidden = false
    errorBanner.textContent = error instanceof Error ? error.message : String(error)
  }
  document.body.dataset.ready = 'error'
}

try {
  installControls()
  updateQualityControls()
  setView('courtyard', true)
  window.addEventListener('resize', resize)
  window.addEventListener('pointerdown', () => {
    viewTween = null
  }, { once: true })

  window.renderLab = {
    version: '0.1.0',
    setFeature,
    setQuality,
    setView,
    getFeatures: pipeline.getFeatures,
    getDiagnostics,
    screenshotReady: () => document.body.dataset.ready === 'true',
    pipeline,
    scene,
    camera,
    renderer,
  }

  resize()
  updateStatus()
  window.requestAnimationFrame(animate)
} catch (error) {
  showFatalError(error)
}

function createRenderLabWorld(targetScene) {
  const root = new THREE.Group()
  root.name = 'RenderLabWorld'
  targetScene.add(root)

  const materials = {
    stone: new THREE.MeshStandardMaterial({
      color: 0x58655f,
      roughness: 0.94,
      metalness: 0.01,
    }),
    stoneDark: new THREE.MeshStandardMaterial({
      color: 0x303d3b,
      roughness: 0.97,
      metalness: 0,
    }),
    stoneWet: new THREE.MeshStandardMaterial({
      color: 0x47615f,
      roughness: 0.58,
      metalness: 0.06,
    }),
    basin: new THREE.MeshStandardMaterial({
      color: 0x101f23,
      roughness: 0.74,
      metalness: 0.16,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: 0x84612f,
      roughness: 0.38,
      metalness: 0.72,
    }),
    coal: new THREE.MeshStandardMaterial({
      color: 0xff7935,
      emissive: 0xff4b18,
      emissiveIntensity: 7,
      roughness: 0.52,
      toneMapped: false,
    }),
    ember: new THREE.MeshBasicMaterial({
      color: new THREE.Color(4.6, 1.1, 0.26),
      toneMapped: false,
    }),
    beacon: new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.2, 3.8, 3.6),
      toneMapped: false,
    }),
  }

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(35, 0.85, 27, 1, 1, 1),
    materials.stoneDark,
  )
  floor.position.set(0, -0.48, -1.2)
  floor.receiveShadow = true
  root.add(floor)

  const courtyard = new THREE.Mesh(
    new THREE.BoxGeometry(29, 0.18, 21),
    materials.stone,
  )
  courtyard.position.set(0, -0.02, -1.2)
  courtyard.receiveShadow = true
  root.add(courtyard)

  const poolFloor = new THREE.Mesh(
    new THREE.BoxGeometry(13.5, 0.26, 9.5),
    materials.basin,
  )
  poolFloor.position.set(0, -0.52, -1.1)
  poolFloor.receiveShadow = true
  root.add(poolFloor)

  addPoolFrame(root, materials)
  addCourtyardWalls(root, materials)
  const brazier = addBrazier(root, materials)
  const beacon = addBeacon(root, materials)
  const embers = addEmbers(root, materials)
  addStoneLanterns(root, materials)

  const emberData = embers.map((mesh, index) => ({
    mesh,
    baseY: mesh.position.y,
    phase: index * 0.73,
    radius: 0.12 + (index % 4) * 0.025,
  }))

  return {
    root,
    update(time, dt) {
      emberData.forEach((ember, index) => {
        ember.mesh.position.y =
          ember.baseY + Math.sin(time * 0.82 + ember.phase) * 0.24
        ember.mesh.position.x += Math.cos(time * 0.25 + index) * dt * 0.012
        ember.mesh.rotation.y += dt * (0.2 + index * 0.015)
        ember.mesh.scale.setScalar(0.82 + Math.sin(time * 1.7 + index) * 0.16)
      })
      brazier.lightCore.scale.setScalar(0.92 + Math.sin(time * 9.2) * 0.07)
      beacon.inner.rotation.y += dt * 0.28
      beacon.ring.rotation.y -= dt * 0.18
    },
  }
}

function addPoolFrame(root, materials) {
  const blocks = [
    [-7.15, 0, -1.1, 0.75, 0.54, 10.1],
    [7.15, 0, -1.1, 0.75, 0.54, 10.1],
    [0, 0, 4.45, 14.8, 0.54, 0.72],
    [0, 0, -6.65, 14.8, 0.54, 0.72],
  ]
  blocks.forEach(([x, y, z, width, height, depth], index) => {
    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      index < 2 ? materials.stoneWet : materials.stone,
    )
    curb.position.set(x, y, z)
    curb.castShadow = true
    curb.receiveShadow = true
    root.add(curb)
  })
}

function addCourtyardWalls(root, materials) {
  const definitions = [
    [-11.3, 2.35, 4.8, 0.85, 4.7, 7.2, -0.025],
    [-8.1, 1.85, 7.5, 5.9, 3.7, 0.82, 0.018],
    [8.6, 2.1, 7.45, 7.2, 4.2, 0.86, -0.018],
    [12.6, 2.9, 2.1, 0.9, 5.8, 7.1, 0.022],
    [11.9, 1.7, -7.3, 7.4, 3.4, 0.84, -0.012],
    [-11.9, 1.65, -7.35, 6.5, 3.3, 0.84, 0.014],
    [-5.5, 2.45, -9.1, 5.5, 4.9, 0.88, -0.008],
    [5.4, 2.7, -9.15, 5.6, 5.4, 0.92, 0.012],
  ]
  definitions.forEach(([x, y, z, width, height, depth, rotation], index) => {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      index % 3 === 0 ? materials.stoneWet : materials.stone,
    )
    wall.position.set(x, y, z)
    wall.rotation.z = rotation
    wall.castShadow = true
    wall.receiveShadow = true
    root.add(wall)

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.18, 0.18, depth + 0.18),
      materials.stoneDark,
    )
    cap.position.set(x, y + height / 2 + 0.08, z)
    cap.rotation.z = rotation
    cap.castShadow = true
    root.add(cap)
  })

  const brokenArch = new THREE.Group()
  const pillarGeometry = new THREE.BoxGeometry(0.85, 4.8, 0.85)
  ;[-2.2, 2.2].forEach((x) => {
    const pillar = new THREE.Mesh(pillarGeometry, materials.stoneWet)
    pillar.position.set(x, 2.4, -8.2)
    pillar.castShadow = true
    pillar.receiveShadow = true
    brokenArch.add(pillar)
  })
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 0.72, 0.94),
    materials.stone,
  )
  lintel.position.set(0, 4.35, -8.2)
  lintel.rotation.z = -0.04
  lintel.castShadow = true
  brokenArch.add(lintel)
  root.add(brokenArch)
}

function addBrazier(root, materials) {
  const group = new THREE.Group()
  group.name = 'Brazier'
  group.position.set(-5.7, 0, -2.6)

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 1.05, 0.28, 10),
    materials.brass,
  )
  base.position.y = 0.14
  base.castShadow = true
  group.add(base)

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.36, 0.9, 9),
    materials.brass,
  )
  stem.position.y = 0.72
  stem.castShadow = true
  group.add(stem)

  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.82, 0.5, 0.44, 12),
    materials.brass,
  )
  bowl.position.y = 1.25
  bowl.castShadow = true
  group.add(bowl)

  const coalGeometry = new THREE.DodecahedronGeometry(0.22, 0)
  const coals = new THREE.Group()
  for (let index = 0; index < 9; index += 1) {
    const coal = new THREE.Mesh(coalGeometry, materials.coal)
    const angle = (index / 9) * Math.PI * 2
    coal.position.set(Math.cos(angle) * 0.36, 1.46, Math.sin(angle) * 0.36)
    coal.scale.set(0.8, 0.55, 0.9)
    coals.add(coal)
  }
  group.add(coals)

  const lightCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 18, 12),
    materials.ember,
  )
  lightCore.position.y = 1.54
  group.add(lightCore)

  root.add(group)
  return { group, coals, lightCore }
}

function addBeacon(root, materials) {
  const group = new THREE.Group()
  group.name = 'Beacon'
  group.position.set(5.65, 0, -3.6)

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.55, 0.56, 8),
    materials.stoneDark,
  )
  pedestal.position.y = 0.28
  pedestal.castShadow = true
  pedestal.receiveShadow = true
  group.add(pedestal)

  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.66, 0.9, 1.3, 8),
    materials.stoneWet,
  )
  plinth.position.y = 1.06
  plinth.castShadow = true
  group.add(plinth)

  const inner = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.58, 0),
    materials.beacon,
  )
  inner.position.y = 2.3
  inner.scale.set(0.72, 1.48, 0.72)
  group.add(inner)

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.83, 0.035, 8, 36),
    materials.brass,
  )
  ring.position.y = 2.3
  ring.rotation.x = Math.PI / 2
  group.add(ring)

  root.add(group)
  return { group, inner, ring }
}

function addEmbers(root, materials) {
  const embers = []
  const geometry = new THREE.SphereGeometry(0.075, 8, 6)
  for (let index = 0; index < 26; index += 1) {
    const angle = (index / 26) * Math.PI * 2 + (index % 3) * 0.13
    const radius = 1.2 + (index % 6) * 0.31
    const mesh = new THREE.Mesh(geometry, materials.ember)
    mesh.position.set(
      -5.7 + Math.cos(angle) * radius,
      1.8 + (index % 7) * 0.23,
      -2.6 + Math.sin(angle) * radius,
    )
    root.add(mesh)
    embers.push(mesh)
  }
  return embers
}

function addStoneLanterns(root, materials) {
  const positions = [
    [-10.2, 0, 3.7],
    [10.2, 0, 3.7],
    [10.3, 0, -6.8],
  ]
  positions.forEach(([x, y, z]) => {
    const group = new THREE.Group()
    group.position.set(x, y, z)
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.7, 0.3, 6),
      materials.stoneDark,
    )
    base.position.y = 0.15
    base.castShadow = true
    group.add(base)
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 2.5, 0.42),
      materials.stone,
    )
    post.position.y = 1.45
    post.castShadow = true
    group.add(post)
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.5, 0.44),
      materials.coal,
    )
    glow.position.y = 2.8
    group.add(glow)
    root.add(group)
  })
}

function createSky(targetScene) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTop: { value: new THREE.Color(0x02070e) },
      uHorizon: { value: new THREE.Color(0x294d58) },
      uMoonDirection: {
        value: new THREE.Vector3(-0.52, 0.54, -0.66).normalize(),
      },
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uMoonDirection;
      varying vec3 vDirection;
      void main() {
        float height = clamp(vDirection.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 color = mix(uHorizon, uTop, smoothstep(0.47, 0.92, height));
        float moon = pow(max(dot(normalize(vDirection), uMoonDirection), 0.0), 34.0);
        float cloud = sin(vDirection.x * 18.0 + uTime * 0.01) *
                      sin(vDirection.z * 13.0 - uTime * 0.008);
        color += vec3(0.18, 0.3, 0.36) * moon;
        color += vec3(0.008, 0.015, 0.019) * (cloud * 0.5 + 0.5);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  })
  material.userData.fixedLightingModel = true
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(420, 48, 24), material)
  mesh.name = 'RenderLabSky'
  mesh.frustumCulled = false
  targetScene.add(mesh)
  return mesh
}
