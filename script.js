const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

// Fundo de caracteres ASCII que se mexe devagar, como uma névoa (hero, infra e rodapé).
const CHARS = ' .·:-=+*#%@'
function ascii(canvas) {
  const ctx = canvas.getContext('2d')
  const cell = 14
  let cols = 0
  let rows = 0
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.font = `11px "Geist Mono", monospace`
    ctx.textBaseline = 'top'
    cols = Math.ceil(width / cell)
    rows = Math.ceil(height / cell)
  }
  function draw(t) {
    const { width, height } = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, width, height)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // Ondas somadas: mais densas à direita e em cima, como no fundo da referência.
        const v =
          Math.sin(x * 0.11 + t * 0.0004) +
          Math.sin(y * 0.17 - t * 0.0003) +
          Math.sin((x + y) * 0.07 + t * 0.0002)
        const fade = (x / cols) * 0.9 + (1 - y / rows) * 0.4
        const n = ((v + 3) / 6) * fade
        const i = Math.max(0, Math.min(CHARS.length - 1, Math.floor(n * CHARS.length)))
        if (i === 0) continue
        ctx.fillStyle = `rgba(247,247,247,${0.05 + n * 0.22})`
        ctx.fillText(CHARS[i], x * cell, y * cell)
      }
    }
  }
  resize()
  addEventListener('resize', resize)
  if (reduceMotion) return draw(0)
  let visible = false
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas)
  let last = 0
  ;(function loop(t) {
    // ~20 quadros por segundo bastam e poupam a bateria.
    if (visible && t - last > 50) {
      draw(t)
      last = t
    }
    requestAnimationFrame(loop)
  })(0)
}
document.querySelectorAll('[data-ascii]').forEach(ascii)

// Fundo do hero: grade de pontos que o cursor atrai. Perto do mouse os pontos crescem, acendem em
// laranja e deixam uma linha até o lugar de origem; mexer o mouse ou clicar solta uma onda que
// empurra os pontos para fora enquanto se espalha.
const GRID = {
  gap: 34, // distância entre os pontos
  dot: 1, // raio do ponto parado (2px de diâmetro)
  reach: 190, // até onde o cursor atrai
  pull: 22, // quanto o ponto anda na direção do cursor
  waveSpeed: 4.2, // px por quadro
  waveWidth: 110, // espessura do anel da onda
  wavePush: 14, // quanto a onda empurra
  waveLife: 110, // quadros até a onda sumir
  rest: [58, 58, 58], // cor do ponto parado
  lit: [215, 117, 82] // laranja do logo
}

function rippleGrid(canvas) {
  const host = canvas.parentElement
  const ctx = canvas.getContext('2d')
  let w = 0
  let h = 0
  let points = []
  const waves = []
  const mouse = { x: 0, y: 0, in: false }
  let lastWave = 0

  const smooth = (t) => t * t * (3 - 2 * t)
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    w = host.clientWidth
    h = host.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    points = []
    const offX = (w % GRID.gap) / 2
    const offY = (h % GRID.gap) / 2
    for (let y = offY; y <= h; y += GRID.gap) for (let x = offX; x <= w; x += GRID.gap) points.push({ x, y })
    if (reduceMotion) draw()
  }

  function addWave(x, y) {
    waves.push({ x, y, r: 0, age: 0 })
    if (waves.length > 8) waves.shift()
  }

  // O canvas fica atrás do conteúdo (sem receber o mouse): a posição vem do hero inteiro.
  const local = (e) => {
    const box = canvas.getBoundingClientRect()
    return { x: e.clientX - box.left, y: e.clientY - box.top }
  }
  host.addEventListener('pointermove', (e) => {
    Object.assign(mouse, local(e), { in: true })
    const now = performance.now()
    if (now - lastWave > 160) {
      addWave(mouse.x, mouse.y)
      lastWave = now
    }
  })
  host.addEventListener('pointerdown', (e) => {
    const p = local(e)
    addWave(p.x, p.y)
  })
  host.addEventListener('pointerleave', () => (mouse.in = false))

  function draw(step = 1) {
    ctx.clearRect(0, 0, w, h)
    for (let i = waves.length - 1; i >= 0; i--) {
      const wave = waves[i]
      wave.r += GRID.waveSpeed * step
      wave.age += step
      if (wave.age >= GRID.waveLife) waves.splice(i, 1)
    }
    for (const p of points) {
      let x = p.x
      let y = p.y
      // Atração do cursor: 1 em cima dele, 0 na borda do alcance.
      let near = 0
      if (mouse.in) {
        const dx = mouse.x - p.x
        const dy = mouse.y - p.y
        const d = Math.hypot(dx, dy)
        if (d < GRID.reach && d > 0.01) {
          near = 1 - d / GRID.reach
          x += (dx / d) * near * GRID.pull
          y += (dy / d) * near * GRID.pull
        }
      }
      // Ondas: o ponto perto do anel é empurrado para fora.
      let wave = 0
      for (const wv of waves) {
        const dx = p.x - wv.x
        const dy = p.y - wv.y
        const d = Math.hypot(dx, dy)
        const off = Math.abs(d - wv.r)
        if (d < 0.01 || off > GRID.waveWidth) continue
        const k = (1 - smooth(off / GRID.waveWidth)) * (1 - smooth(wv.age / GRID.waveLife))
        wave = Math.max(wave, k)
        x += (dx / d) * k * GRID.wavePush * 0.35
        y += (dy / d) * k * GRID.wavePush * 0.35
      }
      const glow = Math.max(near, wave * 0.85)
      if (glow > 0.01) {
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(x, y)
        ctx.strokeStyle = rgba(GRID.lit, glow * 0.4)
        ctx.lineWidth = 0.75 + glow * 0.8
        ctx.stroke()
      }
      const r = GRID.dot * (1 + glow * 0.5)
      if (glow > 0.05) {
        const halo = ctx.createRadialGradient(x, y, 0, x, y, r * (3 + glow * 4))
        halo.addColorStop(0, rgba(GRID.lit, 0.13 * glow))
        halo.addColorStop(1, rgba(GRID.lit, 0))
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(x, y, r * (3 + glow * 4), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = rgba(mix(GRID.rest, GRID.lit, glow), 0.45 + glow * 0.55)
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    // Brilho suave em volta do cursor e o contorno de cada onda.
    if (mouse.in) {
      const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, GRID.reach * 0.5)
      g.addColorStop(0, rgba(GRID.lit, 0.07))
      g.addColorStop(1, rgba(GRID.lit, 0))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(mouse.x, mouse.y, GRID.reach * 0.5, 0, Math.PI * 2)
      ctx.fill()
    }
    for (const wv of waves) {
      ctx.strokeStyle = rgba(GRID.lit, (1 - wv.age / GRID.waveLife) * 0.12)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(wv.x, wv.y, wv.r, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  resize()
  new ResizeObserver(resize).observe(host)
  if (reduceMotion) return
  let visible = true
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(host)
  let prev = performance.now()
  ;(function loop(now) {
    // Passo em quadros de 60 Hz, para a onda andar igual em telas de 120 Hz.
    const step = Math.min(now - prev, 50) / 16.67
    prev = now
    if (visible) draw(step)
    requestAnimationFrame(loop)
  })(prev)
}
document.querySelectorAll('[data-ripple-grid]').forEach(rippleGrid)

// Seção do fluxo: as seis etapas nos vértices de um hexágono (o formato do logo). O selo com o
// ícone do Argus anda de etapa em etapa; a atual fica em destaque e aparece no texto ao lado.
const STEPS = [
  { title: 'Pedido', text: 'Escreva, cole um print ou dite o que precisa.' },
  { title: 'Plano', text: 'O agente lê o projeto e explica o que vai fazer.' },
  { title: 'Execução', text: 'Ferramentas e subagentes trabalham, e você vê cada passo.' },
  { title: 'Permissão', text: 'O que pede aprovação chega no chat. Você decide.' },
  { title: 'Revisão', text: 'O diff de cada arquivo editado, antes e depois.' },
  { title: 'Pronto', text: 'Notificação no sistema quando termina.' }
]

function cycle(svg) {
  const NS = 'http://www.w3.org/2000/svg'
  const R = 150
  const MOVE = 900 // ms andando de uma etapa para a outra
  const HOLD = 1500 // ms parado em cada etapa
  const corner = (i, r) => {
    const a = ((-90 + 60 * i) * Math.PI) / 180
    return { x: r * Math.cos(a), y: r * Math.sin(a) }
  }
  const poly = (r) => STEPS.map((_, i) => corner(i, r)).map((p) => `${p.x},${p.y}`).join(' ')
  const add = (tag, attrs, parent = svg) => {
    const el = document.createElementNS(NS, tag)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    parent.appendChild(el)
    return el
  }

  add('polygon', { class: 'ring', points: poly(212) })
  add('polygon', { class: 'ring', points: poly(186) })
  add('polygon', { class: 'shape', points: poly(R) })
  add('polygon', { class: 'edge', points: poly(R) })
  const trail = add('line', { class: 'trail' })
  const points = STEPS.map((_, i) => corner(i, R))
  points.forEach((p) => add('circle', { class: 'node', cx: p.x, cy: p.y, r: 4.5 }))
  const labels = STEPS.map((s, i) => {
    const p = corner(i, 196)
    // Os de cima e de baixo ficam um pouco mais longe, para não encostar no vértice.
    const y = i === 0 ? p.y - 12 : i === 3 ? p.y + 12 : p.y
    const x = p.x + Math.sign(Math.round(p.x)) * 22
    const t = add('text', { class: 'label', x, y })
    t.textContent = s.title
    return t
  })
  const token = add('g', {})
  add('circle', { r: 27, fill: '#181818' }, token)
  add('image', { href: 'assets/icone-argus-laranja.svg', x: -12, y: -14, width: 24, height: 28 }, token)

  const box = svg.closest('.cycle')
  const num = box?.querySelector('[data-cycle-num]')
  const title = box?.querySelector('[data-cycle-title]')
  const text = box?.querySelector('[data-cycle-text]')
  const place = (p) => token.setAttribute('transform', `translate(${p.x} ${p.y})`)
  const arrive = (i) => {
    labels.forEach((l, k) => l.classList.toggle('on', k === i))
    if (num) num.textContent = String(i + 1).padStart(2, '0')
    if (title) title.textContent = STEPS[i].title
    if (text) text.textContent = STEPS[i].text
  }

  let at = 0
  place(points[0])
  arrive(0)
  if (reduceMotion) return
  let visible = false
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(svg)
  let phaseStart = performance.now()
  let moving = false
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
  ;(function loop(now) {
    if (!visible) phaseStart = now // fora da tela, a contagem espera
    const elapsed = now - phaseStart
    if (!moving && elapsed > HOLD) {
      moving = true
      phaseStart = now
    } else if (moving) {
      const from = points[at]
      const to = points[(at + 1) % points.length]
      const t = Math.min(1, elapsed / MOVE)
      const k = ease(t)
      const p = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k }
      place(p)
      trail.setAttribute('x1', from.x)
      trail.setAttribute('y1', from.y)
      trail.setAttribute('x2', p.x)
      trail.setAttribute('y2', p.y)
      if (t === 1) {
        moving = false
        at = (at + 1) % points.length
        arrive(at)
        phaseStart = now
      }
    }
    requestAnimationFrame(loop)
  })(phaseStart)
}
document.querySelectorAll('[data-cycle]').forEach(cycle)

// Seções aparecem ao entrar na tela.
const targets = document.querySelectorAll('.section .container > *, .outro__inner > *')
if (!reduceMotion) {
  targets.forEach((el) => el.classList.add('reveal'))
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        e.target.classList.add('is-in')
        io.unobserve(e.target)
      }
    },
    { threshold: 0.1 }
  )
  targets.forEach((el) => io.observe(el))
}
