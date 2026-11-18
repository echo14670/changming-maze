(function (global) {
  'use strict';

  const Changming = (global.Changming = global.Changming || {});

  function hashSeed(input) {
    let h = 1779033703 ^ String(input).length;
    const text = String(input);
    for (let i = 0; i < text.length; i += 1) {
      h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function hash() {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function random() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createRandom(seed) {
    const hash = hashSeed(seed);
    const random = mulberry32(hash());
    random.range = function range(min, max) {
      return min + (max - min) * random();
    };
    random.int = function int(min, max) {
      return Math.floor(random.range(min, max + 1));
    };
    random.pick = function pick(list) {
      return list[Math.floor(random() * list.length)];
    };
    random.chance = function chance(probability) {
      return random() < probability;
    };
    return random;
  }

  function shuffle(list, random) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  Changming.Random = Object.freeze({
    createRandom,
    shuffle
  });
})(typeof window !== 'undefined' ? window : globalThis);
