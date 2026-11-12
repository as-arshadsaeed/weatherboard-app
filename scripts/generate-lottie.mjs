/**
 * Generates WeatherBoard's animated weather icons as Lottie JSON (src/assets/lottie/*.json).
 *
 * The artwork is original and drawn from simple shapes here, so there is no third-party asset or licence to
 * track. Run `npm run lottie` after changing it. Every animation is a seamless 4 s loop (120 frames at 30 fps)
 * on a 96 × 96 canvas. Colours come from the app's design tokens: layers carry a class (wb-sun, wb-cloud, …)
 * that src/styles/globals.css maps to --weather-* variables, so one asset serves both themes. The RGB values
 * below are only a fallback if that CSS is missing.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../src/assets/lottie/', import.meta.url))
const FRAMES = 120
const SIZE = 96
const C = SIZE / 2

const COLORS = {
  sun: [0.98, 0.75, 0.2],
  cloud: [0.6, 0.65, 0.72],
  rain: [0.25, 0.55, 0.95],
  snow: [0.55, 0.78, 0.95],
  storm: [0.55, 0.35, 0.85],
  night: [0.4, 0.4, 0.8],
}

const r2 = (n) => Math.round(n * 10) / 10
const still = (k) => ({ a: 0, k })

// ---- animated properties ---------------------------------------------------------------------
const EASE = { o: 0.42, i: 0.58 }
/** keys: [{t, v}] where v is a number or array. ease: 'linear' | 'ease'. */
function animated(keys, ease = 'linear') {
  const dims = Array.isArray(keys[0].v) ? keys[0].v.length : 1
  const rep = (n) => Array(dims).fill(n)
  return {
    a: 1,
    k: keys.map((key, index) => {
      const value = Array.isArray(key.v) ? key.v.map(r2) : [r2(key.v)]
      const frame = { t: key.t, s: value }
      if (index < keys.length - 1) {
        frame.o = ease === 'ease' ? { x: rep(EASE.o), y: rep(0) } : { x: rep(0), y: rep(0) }
        frame.i = ease === 'ease' ? { x: rep(EASE.i), y: rep(1) } : { x: rep(1), y: rep(1) }
      }
      return frame
    }),
  }
}

/** Gentle back-and-forth that returns to its start (period = whole loop). */
const sway = (center, amplitude) =>
  animated(
    [
      { t: 0, v: center },
      { t: FRAMES / 2, v: Array.isArray(center) ? center.map((c, i) => c + amplitude[i]) : center + amplitude },
      { t: FRAMES, v: center },
    ],
    'ease',
  )

/**
 * A repeating "fall" cycle, offset by `phase` frames, as linear keyframes. Opacity is 0 at the wrap, so the
 * one-frame jump back to the start is invisible. cycle: frames per fall.
 */
function falling({ cycle, phase, from, to, peakOpacity = 100 }) {
  const points = [
    [0, from, 0],
    [0.18, [from[0] + (to[0] - from[0]) * 0.18, from[1] + (to[1] - from[1]) * 0.18], peakOpacity],
    [0.8, [from[0] + (to[0] - from[0]) * 0.8, from[1] + (to[1] - from[1]) * 0.8], peakOpacity],
    [(cycle - 1) / cycle, to, 0],
    [1, from, 0],
  ]
  const at = (u) => {
    for (let i = 0; i < points.length - 1; i++) {
      const [u0, p0, o0] = points[i]
      const [u1, p1, o1] = points[i + 1]
      if (u >= u0 && u <= u1) {
        const f = u1 === u0 ? 0 : (u - u0) / (u1 - u0)
        return { p: [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f], o: o0 + (o1 - o0) * f }
      }
    }
    return { p: from, o: 0 }
  }
  const times = new Set([0, FRAMES])
  for (let start = -phase; start < FRAMES; start += cycle) {
    for (const [u] of points) {
      const t = start + u * cycle
      if (t > 0 && t < FRAMES) times.add(Math.round(t * 100) / 100)
    }
  }
  const sorted = [...times].sort((a, b) => a - b)
  const sample = (t) => at((((t + phase) % cycle) + cycle) % cycle / cycle)
  // t=120 must equal t=0 exactly for a seamless loop.
  return {
    position: animated(sorted.map((t) => ({ t, v: sample(t === FRAMES ? 0 : t).p }))),
    opacity: animated(sorted.map((t) => ({ t, v: sample(t === FRAMES ? 0 : t).o }))),
  }
}

// ---- shapes -------------------------------------------------------------------------------------
const fill = (rgb) => ({ ty: 'fl', c: still([...rgb, 1]), o: still(100), r: 1, nm: 'Fill' })
const groupTransform = (o = {}) => ({
  ty: 'tr',
  p: o.p ?? still([0, 0]),
  a: still([0, 0]),
  s: still([100, 100]),
  r: o.r ?? still(0),
  o: o.o ?? still(100),
  sk: still(0),
  sa: still(0),
})
const group = (items, transform) => ({ ty: 'gr', it: [...items, groupTransform(transform)], nm: 'Group' })
const ellipse = (x, y, d) => ({ ty: 'el', p: still([x, y]), s: still([d, d]), d: 1 })
const roundRect = (x, y, w, h, radius) => ({ ty: 'rc', p: still([x, y]), s: still([w, h]), r: still(radius), d: 1 })
const polygon = (points) => ({
  ty: 'sh',
  ks: still({
    i: points.map(() => [0, 0]),
    o: points.map(() => [0, 0]),
    v: points.map(([x, y]) => [r2(x), r2(y)]),
    c: true,
  }),
})

/** Crescent = circle 1 minus circle 2, sampled as a polygon (fine at icon size). */
function crescent(c1, r1, c2, r2_) {
  const dx = c2[0] - c1[0]
  const dy = c2[1] - c1[1]
  const d = Math.hypot(dx, dy)
  const a = (r1 * r1 - r2_ * r2_ + d * d) / (2 * d)
  const h = Math.sqrt(r1 * r1 - a * a)
  const mx = c1[0] + (a * dx) / d
  const my = c1[1] + (a * dy) / d
  const p1 = [mx + (h * dy) / d, my - (h * dx) / d]
  const p2 = [mx - (h * dy) / d, my + (h * dx) / d]
  const angle = (c, p) => Math.atan2(p[1] - c[1], p[0] - c[0])
  const arc = (c, r, from, to, direction, steps = 28) => {
    let delta = to - from
    if (direction > 0) while (delta < 0) delta += Math.PI * 2
    else while (delta > 0) delta -= Math.PI * 2
    return Array.from({ length: steps + 1 }, (_, i) => [c[0] + r * Math.cos(from + (delta * i) / steps), c[1] + r * Math.sin(from + (delta * i) / steps)])
  }
  // Outer arc the long way round (away from c2), then back along the inner circle.
  const outer = arc(c1, r1, angle(c1, p1), angle(c1, p2), c1[0] < c2[0] ? -1 : 1)
  const inner = arc(c2, r2_, angle(c2, p2), angle(c2, p1), c1[0] < c2[0] ? 1 : -1)
  return polygon([...outer, ...inner])
}

// ---- layers -------------------------------------------------------------------------------------
let layerIndex = 0
function layer({ name, cls, shapes, position = [C, C], scale = 100, rotation = still(0), positionProp, opacity = still(100) }) {
  layerIndex += 1
  return {
    ddd: 0,
    ind: layerIndex,
    ty: 4,
    nm: name,
    cl: cls,
    sr: 1,
    ks: {
      o: opacity,
      r: rotation,
      p: positionProp ?? still([...position, 0]),
      a: still([C, C, 0]),
      s: still([scale, scale, 100]),
    },
    ao: 0,
    shapes,
    ip: 0,
    op: FRAMES,
    st: 0,
    bm: 0,
  }
}

const cloudShapes = (rgb) => [
  group([ellipse(35, 47, 24), ellipse(55, 41, 32), roundRect(48, 56, 60, 20, 10), fill(rgb)]),
]

const cloudLayer = ({ position = [C, C + 2], scale = 100, drift = 3 } = {}) =>
  layer({
    name: 'Cloud',
    cls: 'wb-cloud',
    shapes: cloudShapes(COLORS.cloud),
    positionProp: animated(
      [
        { t: 0, v: [position[0] - drift, position[1], 0] },
        { t: FRAMES / 2, v: [position[0] + drift, position[1], 0] },
        { t: FRAMES, v: [position[0] - drift, position[1], 0] },
      ],
      'ease',
    ),
    scale,
  })

const sunLayers = ({ position = [C, C], scale = 100 } = {}) => {
  const rays = Array.from({ length: 8 }, (_, i) =>
    group([roundRect(0, -31, 6, 13, 3), fill(COLORS.sun)], { p: still([C, C]), r: still(i * 45) }),
  )
  return [
    layer({
      name: 'Sun rays',
      cls: 'wb-sun',
      shapes: rays,
      position,
      scale,
      rotation: animated([{ t: 0, v: 0 }, { t: FRAMES, v: 360 }]),
    }),
    layer({
      name: 'Sun',
      cls: 'wb-sun',
      shapes: [group([ellipse(C, C, 30), fill(COLORS.sun)])],
      position,
      positionProp: undefined,
      scale,
    }),
  ]
}

const moonLayers = ({ position = [C, C], scale = 100 } = {}) => [
  layer({
    name: 'Moon',
    cls: 'wb-night',
    shapes: [group([crescent([46, 50], 22, [58, 40], 19), fill(COLORS.night)])],
    positionProp: undefined,
    position,
    scale,
    rotation: sway(0, 7),
  }),
  ...[
    { x: 70, y: 24, d: 6, phase: 0 },
    { x: 78, y: 44, d: 4, phase: 40 },
  ].map((star, i) =>
    layer({
      name: `Star ${i + 1}`,
      cls: 'wb-night',
      shapes: [group([ellipse(star.x, star.y, star.d), fill(COLORS.night)])],
      position,
      scale,
      opacity: animated([
        { t: 0, v: 40 },
        { t: 30, v: 100 },
        { t: 60, v: 40 },
        { t: 90, v: 100 },
        { t: FRAMES, v: 40 },
      ].map((key) => ({ ...key, t: key.t }))),
    }),
  ),
]

const dropLayers = ({ xs, cycle, length, cls = 'wb-rain', from = 64, to = 88, width = 4, color = COLORS.rain, slant = 0 }) =>
  xs.map((x, i) => {
    const fall = falling({ cycle, phase: (cycle / xs.length) * i, from: [x, from], to: [x + slant, to] })
    return layer({
      name: `Drop ${i + 1}`,
      cls,
      shapes: [group([roundRect(0, 0, width, length, width / 2), fill(color)])],
      positionProp: fall.position,
      opacity: fall.opacity,
    })
  })

// Drops are drawn about their own origin, so the layer anchor must be (0,0) rather than the canvas centre.
function anchored(layers) {
  for (const l of layers) l.ks.a = still([0, 0, 0])
  return layers
}

const flakeLayers = (xs) =>
  anchored(
    xs.map((x, i) => {
      const fall = falling({ cycle: 60, phase: (60 / xs.length) * i, from: [x, 62], to: [x + (i % 2 ? 5 : -5), 88] })
      return layer({
        name: `Flake ${i + 1}`,
        cls: 'wb-snow',
        shapes: [group([ellipse(0, 0, 6), fill(COLORS.snow)])],
        positionProp: fall.position,
        opacity: fall.opacity,
      })
    }),
  )

const hailLayers = (xs) =>
  anchored(
    xs.map((x, i) => {
      const fall = falling({ cycle: 30, phase: (30 / xs.length) * i, from: [x, 62], to: [x + 3, 88] })
      return layer({
        name: `Hail ${i + 1}`,
        cls: 'wb-snow',
        shapes: [group([ellipse(0, 0, 6.5), fill(COLORS.snow)])],
        positionProp: fall.position,
        opacity: fall.opacity,
      })
    }),
  )

const boltLayer = () =>
  layer({
    name: 'Lightning',
    cls: 'wb-sun',
    shapes: [group([polygon([[52, 52], [41, 70], [49, 70], [44, 86], [58, 65], [50, 65], [55, 52]]), fill(COLORS.sun)])],
    opacity: animated([
      { t: 0, v: 100 },
      { t: 50, v: 100 },
      { t: 54, v: 15 },
      { t: 58, v: 100 },
      { t: 63, v: 25 },
      { t: 68, v: 100 },
      { t: FRAMES, v: 100 },
    ]),
  })

const fogLayers = () =>
  [
    { y: 64, w: 50, dx: 5, phase: 0 },
    { y: 74, w: 38, dx: -5, phase: 1 },
    { y: 84, w: 46, dx: 5, phase: 0 },
  ].map((bar, i) =>
    layer({
      name: `Fog ${i + 1}`,
      cls: 'wb-cloud',
      shapes: [group([roundRect(C, bar.y, bar.w, 5, 2.5), fill(COLORS.cloud)])],
      positionProp: animated(
        [
          { t: 0, v: [C - bar.dx, C, 0] },
          { t: FRAMES / 2, v: [C + bar.dx, C, 0] },
          { t: FRAMES, v: [C - bar.dx, C, 0] },
        ],
        'ease',
      ),
      opacity: still(90),
    }),
  )

const snowflakeLayer = () =>
  layer({
    name: 'Snowflake',
    cls: 'wb-snow',
    shapes: [0, 60, 120].map((angle) => group([roundRect(0, 0, 6, 54, 3), fill(COLORS.snow)], { p: still([C, C]), r: still(angle) })),
    rotation: animated([{ t: 0, v: 0 }, { t: FRAMES, v: 360 }]),
  })

// ---- the 13 icons used by describeWeather() ---------------------------------------------------
const ICONS = {
  sun: () => sunLayers(),
  moon: () => moonLayers(),
  'cloud-sun': () => [...sunLayers({ position: [34, 34], scale: 62 }), cloudLayer({ position: [52, 58], scale: 82, drift: 2 })],
  'cloud-moon': () => [...moonLayers({ position: [34, 34], scale: 62 }), cloudLayer({ position: [52, 58], scale: 82, drift: 2 })],
  cloud: () => [cloudLayer({ drift: 4 })],
  fog: () => [cloudLayer({ position: [C, 38], scale: 78 }), ...fogLayers()],
  drizzle: () => [cloudLayer({ position: [C, 40], scale: 88, drift: 2 }), ...anchored(dropLayers({ xs: [36, 48, 60], cycle: 60, length: 7, width: 3, to: 84 }))],
  rain: () => [cloudLayer({ position: [C, 40], scale: 88, drift: 2 }), ...anchored(dropLayers({ xs: [34, 46, 58, 70], cycle: 40, length: 10, width: 4 }))],
  'heavy-rain': () => [cloudLayer({ position: [C, 38], scale: 88, drift: 2 }), ...anchored(dropLayers({ xs: [30, 41, 52, 63, 74], cycle: 24, length: 12, width: 4, slant: -6 }))],
  snow: () => [cloudLayer({ position: [C, 40], scale: 88, drift: 2 }), ...flakeLayers([34, 46, 58, 70])],
  snowflake: () => [snowflakeLayer()],
  thunderstorm: () => [cloudLayer({ position: [C, 36], scale: 88, drift: 2 }), boltLayer()],
  hail: () => [cloudLayer({ position: [C, 40], scale: 88, drift: 2 }), ...hailLayers([34, 46, 58, 70])],
}

await mkdir(OUT, { recursive: true })
for (const [name, build] of Object.entries(ICONS)) {
  layerIndex = 0
  const layers = build().reverse() // Lottie draws the first layer on top; we author back-to-front.
  layers.forEach((l, i) => (l.ind = i + 1))
  const animation = { v: '5.7.0', fr: 30, ip: 0, op: FRAMES, w: SIZE, h: SIZE, nm: `weatherboard-${name}`, ddd: 0, assets: [], layers }
  const json = JSON.stringify(animation)
  await writeFile(`${OUT}${name}.json`, json)
  console.log(name.padEnd(13), `${(json.length / 1024).toFixed(1)} KB`)
}
