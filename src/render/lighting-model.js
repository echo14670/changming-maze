import * as THREE from 'three'

function toPhongMaterial(source) {
  const color = source.color || new THREE.Color(0xffffff)
  const emissive = source.emissive || new THREE.Color(0x000000)
  const opacity = source.opacity == null ? 1 : source.opacity
  const fallback = new THREE.MeshPhongMaterial({
    color: color.clone(),
    map: source.map || null,
    bumpMap: source.bumpMap || null,
    bumpScale: source.bumpScale == null ? 0.04 : source.bumpScale,
    normalMap: source.normalMap || null,
    normalScale: source.normalScale ? source.normalScale.clone() : new THREE.Vector2(1, 1),
    emissive: emissive.clone(),
    emissiveMap: source.emissiveMap || null,
    emissiveIntensity: source.emissiveIntensity == null ? 1 : source.emissiveIntensity,
    alphaMap: source.alphaMap || null,
    transparent: Boolean(source.transparent),
    opacity,
    side: source.side,
    depthWrite: source.depthWrite,
    depthTest: source.depthTest,
    shininess: source.roughness == null ? 52 : Math.max(8, 84 * (1 - source.roughness)),
    specular: new THREE.Color(0x6d7f82),
  })
  fallback.name = `${source.name || 'Material'}-BlinnPhong`
  fallback.userData.fallbackFor = source.uuid
  return fallback
}

/**
 * Replaces PBR materials with reversible Blinn-Phong fallbacks.
 * Shader and basic materials are intentionally left untouched.
 */
export function createLightingModelController(scene) {
  if (!scene) throw new Error('createLightingModelController: scene is required')

  const slots = []
  const fallbacks = []
  const seenObjects = new Set()

  function register(object) {
    if (!object?.isMesh || seenObjects.has(object)) return
    if (object.userData.lightingModel === 'fixed') return
    seenObjects.add(object)

    if (Array.isArray(object.material)) {
      object.material.forEach((material, index) => registerMaterial(object, material, index))
      return
    }
    registerMaterial(object, object.material, null)
  }

  function registerMaterial(object, material, index) {
    if (!material || !material.isMeshStandardMaterial) return
    if (material.isShaderMaterial || material.userData?.fixedLightingModel) return
    const fallback = toPhongMaterial(material)
    fallbacks.push(fallback)
    slots.push({
      object,
      index,
      pbrMaterial: material,
      fallbackMaterial: fallback,
    })
  }

  function refresh() {
    scene.traverse(register)
  }

  function setPbr(enabled) {
    slots.forEach((slot) => {
      const next = enabled ? slot.pbrMaterial : slot.fallbackMaterial
      if (slot.index == null) slot.object.material = next
      else slot.object.material[slot.index] = next
    })
  }

  function dispose() {
    fallbacks.forEach((material) => material.dispose())
    slots.length = 0
    seenObjects.clear()
  }

  refresh()

  return {
    refresh,
    setPbr,
    dispose,
    getMaterialCount: () => slots.length,
  }
}
