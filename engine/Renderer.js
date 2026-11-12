// engine/Renderer.js
// Configura o Three.js: cena, câmera, materiais dos chunks (shader próprio), céu, sol/lua e ciclo dia/noite.
// Iluminação "estilo Minecraft": cada vértice carrega luz do céu e luz de bloco (calculadas na CPU).
// No shader, luzDoCéu é multiplicada pelo "daylight" (0 à noite, 1 ao meio-dia) → escurecer o mundo
// inteiro ao anoitecer custa só mudar 1 uniform, sem recalcular nenhum chunk.
import * as THREE from 'three';
import { createAtlas } from './Textures.js';

export const DAY_LENGTH = 24000; // ticks (20 min reais, como no Minecraft)

const VERT = /* glsl */`
attribute vec3 tint;
attribute vec2 light;
varying vec2 vUv;
varying vec3 vTint;
varying vec2 vLight;
#include <fog_pars_vertex>
void main() {
  vUv = uv; vTint = tint; vLight = light;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */`
uniform sampler2D map;
uniform float daylight;
uniform float ambient;
uniform float alphaCut;
uniform float opacity;
uniform float gamma;
uniform vec3 blockTint;
varying vec2 vUv;
varying vec3 vTint;
varying vec2 vLight;
#include <fog_pars_fragment>
// Curva do lightmap do Minecraft: nível/(3·(1-nível)+1), clareada pela opção "Brilho" (gamma)
float curve(float l) {
  float f = l / ((1.0 - l) * 3.0 + 1.0);
  float g = 1.0 - pow(1.0 - f, 4.0);
  return mix(f, g, gamma);
}
void main() {
  vec4 tex = texture2D(map, vUv);
  if (tex.a < alphaCut) discard;
  float sky = curve(vLight.x * daylight);
  float blk = min(1.0, curve(vLight.y) * 1.15);   // luz de tocha/glowstone um pouco mais forte
  float b = max(max(sky, blk), curve(ambient));
  b = max(b, 0.03 + gamma * 0.03);
  vec3 lc = mix(vec3(1.0), blockTint, clamp((blk - sky) * 1.6, 0.0, 1.0)); // luz de tocha é amarelada
  gl_FragColor = vec4(tex.rgb * vTint * b * lc, tex.a * opacity);
  #include <fog_fragment>
}`;

export class Renderer {
  constructor(container) {
    THREE.ColorManagement.enabled = false;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 1000);
    this.scene.add(this.camera);
    this.scene.fog = new THREE.Fog(0x9fc8ff, 40, 100);

    this.atlas = createAtlas();
    const base = {
      map: { value: this.atlas.texture }, daylight: { value: 1 }, ambient: { value: 0 },
      alphaCut: { value: 0.5 }, opacity: { value: 1 }, gamma: { value: 0.5 }, blockTint: { value: new THREE.Color(1.0, 0.88, 0.7) },
    };
    this.uniforms = base;
    const fogU = THREE.UniformsLib.fog;
    // daylight/ambient/blockTint são objetos compartilhados → mudar um muda os dois materiais
    this.materials = {
      opaque: new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([fogU, {}]), vertexShader: VERT, fragmentShader: FRAG, fog: true,
      }),
      translucent: new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([fogU, {}]), vertexShader: VERT, fragmentShader: FRAG, fog: true,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
      }),
    };
    for (const [k, m] of Object.entries(this.materials)) {
      Object.assign(m.uniforms, { map: base.map, daylight: base.daylight, ambient: base.ambient, gamma: base.gamma, blockTint: base.blockTint });
      m.uniforms.alphaCut = { value: k === 'opaque' ? 0.5 : 0.02 };
      m.uniforms.opacity = { value: 1 };
    }

    // Luzes só para os mobs (MeshLambertMaterial)
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1.2);
    this.sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.scene.add(this.hemi, this.sunLight);

    this.buildSky();
    this.buildClouds();
    this.buildSelection();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  buildSky() {
    const mk = (draw) => {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      draw(c.getContext('2d'));
      const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.NoColorSpace;
      return t;
    };
    const sunTex = mk((g) => { g.fillStyle = '#fff6b0'; g.fillRect(6, 6, 20, 20); g.fillStyle = '#ffe36a'; g.fillRect(9, 9, 14, 14); });
    const moonTex = mk((g) => { g.fillStyle = '#e8ecf5'; g.fillRect(8, 8, 16, 16); g.fillStyle = '#b8c0d0'; g.fillRect(11, 11, 4, 4); g.fillRect(18, 16, 3, 3); });
    const mat = (t) => new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: false, depthWrite: false });
    this.sun = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mat(sunTex));
    this.moon = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), mat(moonTex));
    const starsG = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 900; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      pts.push(r * Math.cos(th) * 400, u * 400, r * Math.sin(th) * 400);
    }
    starsG.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.stars = new THREE.Points(starsG, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false }));
    this.skyGroup = new THREE.Group();
    this.skyGroup.add(this.sun, this.moon, this.stars);
    for (const o of [this.sun, this.moon, this.stars]) o.renderOrder = -1;
    this.scene.add(this.skyGroup);
  }

  buildSelection() {
    const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
    this.selection = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, fog: false }));
    this.selection.visible = false;
    this.crack = new THREE.Mesh(new THREE.BoxGeometry(1.006, 1.006, 1.006), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.crack.visible = false;
    this.scene.add(this.selection, this.crack);
  }

  setSelection(hit, progress = 0) {
    if (!hit) { this.selection.visible = false; this.crack.visible = false; return; }
    this.selection.visible = true;
    this.selection.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    this.crack.visible = progress > 0;
    this.crack.position.copy(this.selection.position);
    this.crack.material.opacity = Math.min(0.65, progress * 0.65);
  }

  buildClouds() {
    // textura em blocos (cada pixel = um "nuvem-bloco" de 8x8), repetida e deslizando com o vento
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 260; i++) {
      const x = Math.floor(rnd() * 128), y = Math.floor(rnd() * 128), w = 2 + Math.floor(rnd() * 7), h = 2 + Math.floor(rnd() * 5);
      g.fillStyle = 'rgba(255,255,255,0.82)';
      for (const [ox, oy] of [[0, 0], [-128, 0], [0, -128], [-128, -128]]) g.fillRect(x + ox, y + oy, w, h);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.NoColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true });
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(1024, 1024), mat);
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.renderOrder = 2;
    this.cloudsEnabled = true;
    this.scene.add(this.clouds);
  }

  setBrightness(v) { this.uniforms.gamma.value = v; }
  setRenderScale(k) { this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5) * k); this.resize(); }
  setFov(fov) { this.baseFov = fov; }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setRenderDistance(chunks) {
    this.viewDist = chunks * 16;
    this.scene.fog.near = this.viewDist * 0.55;
    this.scene.fog.far = this.viewDist * 0.95;
    this.camera.far = this.viewDist * 2 + 500;
    this.camera.updateProjectionMatrix();
  }

  // time: 0..24000 (0 = nascer do sol, 6000 = meio-dia, 18000 = meia-noite)
  updateSky(time, dimension, underwater = false) {
    const ang = (time / DAY_LENGTH) * Math.PI * 2;
    const sunH = Math.sin(ang);
    let daylight = Math.max(0, Math.min(1, sunH * 2.2 + 0.45));
    daylight = daylight * daylight * (3 - 2 * daylight);
    const aether = dimension === 'aether';
    const dl = aether ? 0.55 + daylight * 0.45 : 0.2 + daylight * 0.8;
    const u = this.uniforms;
    let sky, fog;
    if (dimension === 'nether') {
      u.daylight.value = 0; u.ambient.value = 0.55;
      sky = new THREE.Color(0.22, 0.04, 0.03); fog = sky;
      this.skyGroup.visible = false;
      this.hemi.intensity = 0.9; this.sunLight.intensity = 0.2;
      this.scene.fog.near = 10; this.scene.fog.far = Math.min(this.viewDist * 0.8, 70);
    } else {
      u.daylight.value = dl; u.ambient.value = 0;
      const day = aether ? new THREE.Color(0.68, 0.86, 1.0) : new THREE.Color(0.53, 0.75, 1.0);
      const night = aether ? new THREE.Color(0.16, 0.2, 0.36) : new THREE.Color(0.01, 0.015, 0.04);
      const dusk = aether ? new THREE.Color(0.95, 0.75, 0.85) : new THREE.Color(0.95, 0.5, 0.3);
      sky = night.clone().lerp(day, daylight);
      const duskAmt = Math.max(0, 1 - Math.abs(sunH) * 4) * 0.55;
      fog = sky.clone().lerp(dusk, duskAmt);
      this.skyGroup.visible = true;
      this.hemi.intensity = 0.25 + daylight * 1.0; this.sunLight.intensity = daylight * 0.8;
      this.scene.fog.near = this.viewDist * 0.55; this.scene.fog.far = this.viewDist * 0.95;
      // sol e lua giram em volta da câmera
      const cp = this.camera.position;
      this.skyGroup.position.copy(cp);
      this.sun.position.set(Math.cos(ang) * 300, Math.sin(ang) * 300, 0);
      this.moon.position.set(-Math.cos(ang) * 300, -Math.sin(ang) * 300, 0);
      this.sun.lookAt(cp); this.moon.lookAt(cp);
      this.stars.material.opacity = Math.max(0, 1 - daylight * 2.5);
      this.sunLight.position.set(Math.cos(ang) * 100, Math.max(10, Math.sin(ang) * 100), 30);
      if (aether) this.stars.material.opacity *= 0.5;
    }
    // nuvens: camada acima do Overworld; no Aether ficam lá embaixo, entre as ilhas
    this.clouds.visible = this.cloudsEnabled && dimension !== 'nether';
    if (this.clouds.visible) {
      const cp = this.camera.position;
      this.clouds.position.set(cp.x, aether ? 22 : 112, cp.z);
      const tex = this.clouds.material.map;
      tex.offset.set((cp.x + time * 0.03) / 1024 % 1, -(cp.z / 1024) % 1);
      this.clouds.material.color.setScalar(0.35 + dl * 0.65);
    }
    if (underwater) { fog = new THREE.Color(0.08, 0.18, 0.45).multiplyScalar(dl); this.scene.fog.near = 1; this.scene.fog.far = 24; }
    this.renderer.setClearColor(fog);
    this.scene.fog.color.copy(fog);
    this.daylight = dimension === 'nether' ? 0 : dl;
    return this.daylight;
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
