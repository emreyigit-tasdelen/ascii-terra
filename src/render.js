// Renderer, kamera, gün döngüsü, yağmur ve ASCII son-işleme geçişi.
// Ekrandaki HER piksel bir glifin parçasıdır: sahne önce render hedefine çizilir,
// sonra malzeme kimliğine (alfa kanalı) göre uygun glif setiyle karakterlere çevrilir.
import { THREE, $, clamp, lerp, smooth, MID, tag } from './core.js';

export const canvas = $('c');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070d);
scene.fog = new THREE.Fog(0x05070d, 30, 170);
export const camera = new THREE.PerspectiveCamera(40, 1, .5, 900);
export const VIEW = { cellW: 5, cellH: 9, dpr: 1 };

const rt = new THREE.WebGLRenderTarget(16, 16, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat, depthBuffer: true });

/* ---------------- glif setleri ---------------- */
const SETS = {
  GEN: " .':;-~ilrcvxzjtJCZqpdbhaowmQ&8#@",
  STONE: " .:+oaeswqpdbmOQ0&%$#@MW",
  LEAF: " .,;:*o%&8@#",
  WATER: " .,-~=*",
  FINE: " .':;!/|\\(){}ox%#8@",
  ACTOR: " .:;+=xoO0Q8%#@",
  WOOD: " .:-=|#H",
  GROUND: " .,:;'",
  FIRE: " .*+o%#&@",
  FLOWER: "o*+o.",
  GLOW: "+x*#@",
  RAIN: "/'/",
  GRASS: "-~_/'/|!l\\`\\",   // 4 yön kovası x 3 varyant: yatay, /, dikey, \
  EDGE: "-/|\\"
};
let GLYPHS = '', defs = '';
{ let o = 0; for (const k in SETS) { const n = SETS[k].length; defs += `#define ${k} ${o}.,${n}.\n#define ${k}_O ${o}.\n#define ${k}_N ${n}.\n`; GLYPHS += SETS[k]; o += n; } }
const ROWS = Math.ceil(GLYPHS.length / 16);

const atlases = {};
function buildAtlas(key, cw, ch) {
  const c = document.createElement('canvas'); c.width = 16 * cw; c.height = ROWS * ch;
  const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = (ch >= 14 ? 'bold ' : '') + Math.round(ch * 1.02) + 'px Consolas,"Courier New",monospace';
  GLYPHS.split('').forEach((g, i) => x.fillText(g, (i % 16) * cw + cw / 2, Math.floor(i / 16) * ch + ch * .55));
  if (atlases[key]) atlases[key].dispose();
  const t = atlases[key] = new THREE.CanvasTexture(c); t.flipY = false; t.generateMipmaps = false;
  t.minFilter = t.magFilter = THREE.NearestFilter;
  return t;
}

const U = {
  tScene: { value: rt.texture }, tFont: { value: null }, tFine: { value: null }, res: { value: new THREE.Vector2(1, 1) },
  cpx: { value: new THREE.Vector2(5, 9) }, atlas: { value: new THREE.Vector2(80, 99) },
  fpx: { value: new THREE.Vector2(3, 6) }, fatlas: { value: new THREE.Vector2(48, 66) },
  uTime: { value: 0 }, uHurt: { value: 0 }, uExp: { value: 1.15 }
};
const asciiMat = new THREE.ShaderMaterial({
  uniforms: U, depthTest: false, depthWrite: false,
  vertexShader: 'void main(){gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader: defs + `
  uniform sampler2D tScene,tFont,tFine;uniform vec2 res,cpx,atlas,fpx,fatlas;uniform float uTime,uHurt,uExp;
  float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
  bool isD(float a,float v){return abs(a-v)<.02;}
  bool isGrass(float a){return a<.3;}
  bool isFig(float a){return isD(a,.65)||isD(a,.7);}            // karakter / yaratık: ince ızgara
  bool isThin(float a){return isD(a,.5)||isD(a,.55)||isD(a,.6);} // çiçek, yağmur, parlak
  vec4 S(vec2 p){return texture2D(tScene,p/res);}
  float pick(float o,float n,float l,float h,float j){return o+clamp(floor(pow(l,.6)*(n-1.)+(h-.5)*j+.5),l>.02?1.:0.,n-1.);}
  float glyphN(float s,vec2 lp){
    float col=mod(s,16.),row=floor(s/16.);
    vec2 t=vec2(col*cpx.x+floor(lp.x)+.5,row*cpx.y+(cpx.y-1.-floor(lp.y))+.5);
    return texture2D(tFont,t/atlas).r;
  }
  float glyphF(float s,vec2 lp){
    float col=mod(s,16.),row=floor(s/16.);
    vec2 t=vec2(col*fpx.x+floor(lp.x)+.5,row*fpx.y+(fpx.y-1.-floor(lp.y))+.5);
    return texture2D(tFine,t/fatlas).r;
  }
  void main(){
    vec2 fc=gl_FragCoord.xy;
    vec4 own=S(fc);float a=own.a;vec3 o;
    if(isFig(a)){
      // karakterler ve yaratıklar: küçük hücreli ince ızgara
      bool cre=isD(a,.7);
      vec2 cp=fpx,cell=floor(fc/cp),base=cell*cp,lp=mod(fc,cp);
      vec3 acc=vec3(0.);float n=0.;
      for(int j=0;j<3;j++){for(int i=0;i<3;i++){
        vec4 s=S(base+cp*vec2((float(i)+.5)/3.,(float(j)+.5)/3.));
        if(isFig(s.a)){acc+=s.rgb;n+=1.;}
      }}
      vec3 c=(n>0.?acc/n:own.rgb)*uExp;
      float l=clamp(lum(c),0.,1.),hc=h21(cell+vec2(37.,11.));
      float sl=cre?pick(FINE,l*1.25,hc,2.):pick(ACTOR,l*1.2,hc,1.5);
      o=c*glyphF(sl,lp)*2.4+c*.1;
    }else{
      vec2 cp=cpx,cell=floor(fc/cp),base=cell*cp,lp=mod(fc,cp);
      vec4 cen=S(base+cp*.5);
      vec3 acc=vec3(0.),gacc=vec3(0.),tcol=vec3(0.);float n=0.,gn=0.,gang=0.,gbest=-1.,mcat=1.,thin=0.;float L[9];
      for(int j=0;j<3;j++){for(int i=0;i<3;i++){
        vec4 s=S(base+cp*vec2((float(i)+.5)/3.,(float(j)+.5)/3.));
        L[j*3+i]=lum(s.rgb)*uExp;
        if(isGrass(s.a)){gacc+=s.rgb;gn+=1.;float sl=lum(s.rgb);if(sl>gbest){gbest=sl;gang=(s.a-.02)/.26;}}
        else if(isD(s.a,.6)){thin=3.;tcol=s.rgb;}
        else if(isD(s.a,.55)){if(thin<3.){thin=2.;tcol=s.rgb;}}
        else if(isD(s.a,.5)){if(thin<2.){thin=1.;tcol=s.rgb;}}
        else if(!isFig(s.a)){acc+=s.rgb;n+=1.;mcat=s.a;}
      }}
      float m=(isGrass(cen.a)||isThin(cen.a)||isFig(cen.a))?mcat:cen.a;
      float hc=h21(cell),sl,k=1.8,bg=.07;vec3 c;
      if(thin>2.5){c=tcol*uExp;sl=GLOW_O+clamp(floor(lum(c)*GLOW_N+(hc-.5)),0.,GLOW_N-1.);k=1.7;bg=.12;}
      else if(thin>1.5){c=tcol*uExp;sl=RAIN_O+floor(hc*RAIN_N);k=1.6;bg=0.;}
      else if(thin>.5){c=tcol*uExp;sl=FLOWER_O+floor(hc*FLOWER_N);k=1.5;bg=0.;}
      else if(gn>=2.){c=gacc/gn*uExp;sl=GRASS_O+mod(floor(gang*4.+.5),4.)*3.+floor(hc*3.);k=2.3;bg=.03;}
      else{
        c=n>0.?acc/n*uExp:vec3(0.);
        float l=clamp(lum(c),0.,1.);
        if(isD(m,.95)){
          if(c.b>c.g*1.04&&l>.03){sl=pick(STONE,l*1.2,hc,5.);k=1.8;}
          else{sl=pick(GROUND,l*2.5,hc,1.);k=1.5;bg=.05;}
        }
        else if(isD(m,.9)){sl=pick(STONE,l,hc,7.);k=1.9;bg=.09;}
        else if(isD(m,.85)){sl=pick(WOOD,l,hc,1.5);k=1.8;bg=.08;}
        else if(isD(m,.8)){sl=pick(LEAF,l*1.3,hc,2.5);k=1.9;bg=.08;}
        else if(isD(m,.75)){sl=pick(WATER,l*1.4,hc,1.);k=1.8;bg=.05;}
        else if(isD(m,.4)){sl=pick(FIRE,l,h21(cell+floor(uTime*12.)),3.);k=1.7;bg=.25;}
        else{
          float gx=(L[2]+2.*L[5]+L[8])-(L[0]+2.*L[3]+L[6]);
          float gy=(L[6]+2.*L[7]+L[8])-(L[0]+2.*L[1]+L[2]);
          float mag=length(vec2(gx,gy))/4.;
          if(mag>.09+.12*l&&l>.03){float an=atan(-gx,gy);if(an<0.)an+=3.14159265;sl=EDGE_O+mod(floor(an/.785398+.5),4.);}
          else sl=pick(GEN,l,hc,4.);
        }
      }
      o=c*glyphN(sl,lp)*k+c*bg;
    }
    o=o*(1.+uHurt*vec3(.15,-.25,-.25));
    vec2 q=fc/res-.5;o*=1.-dot(q,q)*.6;
    gl_FragColor=vec4(o,1.);
  }`
});
const quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), asciiMat));

const _bs = new THREE.Vector2();
export function resize() {
  const W = innerWidth, H = innerHeight; VIEW.dpr = Math.min(devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(VIEW.dpr); renderer.setSize(W, H);
  renderer.getDrawingBufferSize(_bs); rt.setSize(_bs.x, _bs.y);
  const cw = Math.max(3, Math.round(VIEW.cellW * VIEW.dpr)), ch = Math.max(5, Math.round(VIEW.cellH * VIEW.dpr));
  const fw = Math.max(3, Math.round(cw * .65)), fh = Math.max(5, Math.round(ch * .65));
  U.res.value.copy(_bs);
  U.cpx.value.set(cw, ch); U.atlas.value.set(cw * 16, ch * ROWS); U.tFont.value = buildAtlas('n', cw, ch);
  U.fpx.value.set(fw, fh); U.fatlas.value.set(fw * 16, fh * ROWS); U.tFine.value = buildAtlas('f', fw, fh);
  camera.aspect = W / H; camera.updateProjectionMatrix();
}
export function renderFrame(t, hurt) {
  U.uTime.value = t; U.uHurt.value = hurt;
  renderer.setRenderTarget(rt); renderer.render(scene, camera);
  renderer.setRenderTarget(null); renderer.render(quadScene, quadCam);
}

/* ---------------- ışık + gün döngüsü ---------------- */
export const sun = new THREE.DirectionalLight(0xfff0d0, .85); scene.add(sun);
export const moon = new THREE.DirectionalLight(0x8899ff, .45); scene.add(moon);
export const hemi = new THREE.HemisphereLight(0x8899bb, 0x101410, .5); scene.add(hemi);
export const ENV = { dayT: .3, night: 0, raining: false, light: new THREE.Vector3(1, 1, 1), sky: new THREE.Color(0x05070d), shadow: new THREE.Vector2(.3, .3) };
const _a = new THREE.Color(), _b = new THREE.Color();
export function updateDay(dt, len) {
  ENV.dayT = (ENV.dayT + dt / len) % 1;
  const a = (ENV.dayT - .25) * Math.PI * 2, e = Math.sin(a), D = smooth(-.12, .3, e), N = 1 - D, rain = ENV.raining ? 1 : 0;
  ENV.night = N;
  sun.position.set(Math.cos(a) * .75, e, .5).multiplyScalar(100); sun.intensity = .85 * D * (1 - .4 * rain);
  sun.color.setRGB(1, lerp(.6, .95, smooth(0, .4, e)), lerp(.4, .85, smooth(0, .4, e)));
  moon.position.copy(sun.position).multiplyScalar(-1); moon.intensity = .5 * N;
  hemi.color.setRGB(lerp(.25, .55, D), lerp(.3, .62, D), lerp(.5, .75, D)); hemi.groundColor.setRGB(.06, .08, .06);
  _a.setRGB(.01, .015, .035); _b.setRGB(.06, .085, .12); ENV.sky.copy(_a).lerp(_b, D);
  if (rain) ENV.sky.lerp(_b.setRGB(.05, .055, .065), .5);
  scene.background.copy(ENV.sky); scene.fog.color.copy(ENV.sky);
  const s = e > 0 ? 1 : -1; ENV.shadow.set(-Math.cos(a) * .75 * s, -.5 * s).normalize();
  ENV.light.set(lerp(.2, sun.color.r * .95, D), lerp(.24, sun.color.g * .95, D), lerp(.4, sun.color.b * .95, D)).multiplyScalar(1 - .3 * rain);
}

/* ---------------- yağmur ---------------- */
const RN = 1800, rainPos = new Float32Array(RN * 6), rainGeo = new THREE.BufferGeometry(), rainD = [];
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, tag(new THREE.LineBasicMaterial({ color: 0x8f9aaa }), MID.RAIN));
rain.frustumCulled = false; rain.visible = false; scene.add(rain);
for (let i = 0; i < RN; i++) rainD.push({ x: Math.random() * 80 - 40, y: Math.random() * 40, z: Math.random() * 80 - 40 });
export function updateRain(dt, px, py, pz) {
  rain.visible = ENV.raining; if (!ENV.raining) return;
  for (let i = 0; i < RN; i++) {
    const d = rainD[i]; d.y -= 38 * dt;
    if (d.y < 0) { d.y = 40; d.x = Math.random() * 80 - 40; d.z = Math.random() * 80 - 40; }
    const o = i * 6, x = px + d.x, y = py + d.y, z = pz + d.z;
    rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z; rainPos[o + 3] = x + .35; rainPos[o + 4] = y - 1.6; rainPos[o + 5] = z + .15;
  }
  rainGeo.attributes.position.needsUpdate = true;
}
