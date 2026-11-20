import * as THREE from 'three';

const SIZE = 1024; // 1K 规范

// 基础噪声生成器 (模拟 FBM)
function generateNoise(ctx, colorBase, noiseIntensity, scale = 1) {
  const imgData = ctx.getImageData(0, 0, SIZE, SIZE);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * noiseIntensity;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise));
    data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);
}

function createBaseCanvas(bgColor) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, SIZE, SIZE);
  return { canvas, ctx };
}

// 1. 环塔石墙 (Stone)
export function createStoneTexture() {
  const { canvas, ctx } = createBaseCanvas('#2a363b');
  // 画不规则石板
  ctx.strokeStyle = '#151d21';
  ctx.lineWidth = 8;
  const rows = 4, cols = 4, w = SIZE / cols, h = SIZE / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.strokeRect(c * w + Math.random() * 10, r * h + Math.random() * 10, w - 20, h - 20);
    }
  }
  generateNoise(ctx, '#2a363b', 40);
  return setupTexture(canvas);
}

// 2. 潮汐青苔 (Moss)
export function createMossTexture() {
  const { canvas, ctx } = createBaseCanvas('#2d3b2d');
  // 斑块
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = `rgba(58, 74, 58, ${Math.random() * 0.5})`;
    ctx.beginPath();
    ctx.arc(Math.random() * SIZE, Math.random() * SIZE, Math.random() * 80, 0, Math.PI * 2);
    ctx.fill();
  }
  generateNoise(ctx, '#2d3b2d', 60);
  return setupTexture(canvas);
}

// 3. 红砖内墙 (Brick)
export function createBrickTexture() {
  const { canvas, ctx } = createBaseCanvas('#4a2e2e');
  ctx.fillStyle = '#6a4242';
  const rows = 8, cols = 4, w = SIZE / cols, h = SIZE / rows;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (w / 2); // 错位
    for (let c = -1; c < cols; c++) {
      ctx.fillRect(c * w + offset + 4, r * h + 4, w - 8, h - 8);
    }
  }
  generateNoise(ctx, '#4a2e2e', 30);
  return setupTexture(canvas);
}

// 4. 陈年木门 (Wood)
export function createWoodTexture() {
  const { canvas, ctx } = createBaseCanvas('#3b2a1e');
  // 纵向木纹
  for (let i = 0; i < 100; i++) {
    ctx.strokeStyle = `rgba(30, 20, 10, ${Math.random() * 0.3})`;
    ctx.lineWidth = Math.random() * 4;
    ctx.beginPath();
    ctx.moveTo(Math.random() * SIZE, 0);
    ctx.bezierCurveTo(
      Math.random() * SIZE, SIZE * 0.3,
      Math.random() * SIZE, SIZE * 0.7,
      Math.random() * SIZE, SIZE
    );
    ctx.stroke();
  }
  generateNoise(ctx, '#3b2a1e', 20);
  return setupTexture(canvas);
}

function setupTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; // 重要：修正颜色
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}