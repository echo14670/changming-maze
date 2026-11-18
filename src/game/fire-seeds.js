import * as THREE from 'three'

const REGION_LABELS = {
  courtyard: '外庭',
  water: '水院',
  ember: '烬厅',
  atrium: '中庭',
}

function makeHaloTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 62)
  gradient.addColorStop(0, 'rgba(255,245,206,1)')
  gradient.addColorStop(0.15, 'rgba(255,190,84,.92)')
  gradient.addColorStop(0.45, 'rgba(255,112,35,.28)')
  gradient.addColorStop(1, 'rgba(255,82,20,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 128, 128)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * 火种是玩法层对象，不属于碰撞墙体。
 * 判断范围刻意比旧版宽松：近距离无需精确瞄准也能 focus。
 */
export function createFireSeeds(options) {
  const { scene, world } = options
  if (!scene || !world) throw new Error('createFireSeeds: scene and world are required')

  const haloTexture = makeHaloTexture()
  const seeds = world.spawnPoints.map((spawn, index) => {
    const group = new THREE.Group()
    group.name = `FireSeed-${index + 1}`
    group.position.set(
      spawn.position.x,
      spawn.position.y + 0.08,
      spawn.position.z,
    )

    const hitRadius = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 12, 8),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    )
    hitRadius.name = 'FireSeedHitRadius'
    group.add(hitRadius)

    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0xffe2a1,
      emissive: 0xff7a23,
      emissiveIntensity: 2.7,
      roughness: 0.2,
    })
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.115, 2), coreMaterial)
    core.position.y = 0.24
    group.add(core)

    const haloMaterial = new THREE.SpriteMaterial({
      map: haloTexture,
      color: 0xffb95f,
      transparent: true,
      opacity: 0.58,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const halo = new THREE.Sprite(haloMaterial)
    halo.position.y = 0.24
    halo.scale.set(0.78, 0.78, 1)
    group.add(halo)

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffb04e,
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
    const orbit = new THREE.Group()
    orbit.position.y = 0.24
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.015, 5, 32),
      ringMaterial,
    )
    ring.rotation.x = Math.PI / 2
    orbit.add(ring)
    const ring2 = ring.clone()
    ring2.scale.setScalar(0.74)
    ring2.rotation.z = 0.72
    orbit.add(ring2)
    group.add(orbit)

    const motePositions = []
    for (let i = 0; i < 16; i += 1) {
      const angle = (i / 16) * Math.PI * 2
      const radius = 0.24 + (i % 3) * 0.09
      motePositions.push(
        Math.cos(angle) * radius,
        0.2 + (i % 5) * 0.08,
        Math.sin(angle) * radius,
      )
    }
    const moteGeometry = new THREE.BufferGeometry()
    moteGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(motePositions, 3),
    )
    const motes = new THREE.Points(
      moteGeometry,
      new THREE.PointsMaterial({
        color: 0xffbb64,
        size: 0.03,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    group.add(motes)

    const light = new THREE.PointLight(0xff8f3f, 1.8, 5.5, 2)
    light.position.y = 0.28
    light.userData.owner = 'C'
    group.add(light)

    scene.add(group)
    return {
      id: spawn.id,
      index,
      region: spawn.region,
      regionLabel: REGION_LABELS[spawn.region] || '石阵',
      anchor: spawn.anchor,
      grid: { row: spawn.row, col: spawn.col },
      group,
      core,
      halo,
      orbit,
      ring,
      ring2,
      motes,
      light,
      baseY: group.position.y,
      collected: false,
      collecting: -1,
      focused: false,
      getPosition() {
        return group.getWorldPosition(new THREE.Vector3())
      },
    }
  })

  function collect(id) {
    const seed = seeds.find((item) => item.id === id)
    if (!seed || seed.collected) return false
    seed.collected = true
    seed.collecting = 0
    seed.focused = false
    return true
  }

  function setFocused(id) {
    for (const seed of seeds) seed.focused = seed.id === id
  }

  function update(dt, elapsed) {
    for (const seed of seeds) {
      if (seed.collecting >= 0) {
        seed.collecting += dt
        const t = Math.min(1, seed.collecting / 0.62)
        const eased = 1 - (1 - t) ** 3
        seed.group.position.y = seed.baseY + eased * 1.35
        seed.group.scale.setScalar(Math.max(0.001, 1 - eased))
        seed.core.material.emissiveIntensity = 2.7 + eased * 5
        seed.light.intensity = (1 - eased) * 6
        seed.halo.material.opacity = (1 - eased) * 0.9
        if (t >= 1) {
          seed.group.visible = false
          seed.collecting = -1
        }
        continue
      }
      if (seed.collected) continue

      const pulse = 0.92 + Math.sin(elapsed * 3.4 + seed.index * 1.7) * 0.08
      seed.group.position.y =
        seed.baseY + Math.sin(elapsed * 1.85 + seed.index * 2.1) * 0.075
      seed.core.rotation.y += dt * 0.75
      seed.core.rotation.x += dt * 0.3
      seed.core.scale.setScalar(seed.focused ? 1.12 * pulse : pulse)
      seed.orbit.rotation.y += dt * (seed.focused ? 1.7 : 0.7)
      seed.orbit.rotation.x = Math.sin(elapsed * 0.7 + seed.index) * 0.18
      seed.halo.scale.setScalar(seed.focused ? 1.08 : 0.78)
      seed.halo.material.opacity = seed.focused ? 0.82 : 0.58
      seed.light.intensity = seed.focused ? 3.1 : 1.8
      seed.motes.rotation.y -= dt * 0.45
      seed.motes.material.opacity = seed.focused ? 1 : 0.72
    }
  }

  return {
    seeds,
    collect,
    setFocused,
    update,
    getActive() {
      return seeds.filter((seed) => !seed.collected)
    },
    dispose() {
      for (const seed of seeds) scene.remove(seed.group)
      haloTexture.dispose()
    },
  }
}
