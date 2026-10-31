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

// Seção do fluxo: o Argus no centro e as seis etapas girando em volta dele. A etapa que passa pelo
// topo acende e aparece no texto ao lado. O fundo do cartão tem linhas de relevo, desenhadas aqui.
const STEPS = [
  { title: 'Pedido', text: 'Escreva, cole um print ou dite o que precisa.', icon: '<path d="M4 5h16v11H9l-5 4z"/>' },
  { title: 'Plano', text: 'O agente lê o projeto e explica o que vai fazer.', icon: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>' },
  { title: 'Execução', text: 'Ferramentas e subagentes trabalham, e você vê cada passo.', icon: '<path d="M5 7l5 5-5 5M12.5 17H19"/>' },
  { title: 'Permissão', text: 'O que pede aprovação chega no chat. Você decide.', icon: '<path d="M12 3l7 3v5.5c0 4.3-3 7.6-7 9.5-4-1.9-7-5.2-7-9.5V6z"/><path d="M9 12l2 2 4-4"/>' },
  { title: 'Revisão', text: 'O diff de cada arquivo editado, antes e depois.', icon: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M12 8.5v5M9.5 11h5M9.5 16.5h5"/>' },
  { title: 'Pronto', text: 'Notificação no sistema quando termina.', icon: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>' }
]

function topo(card) {
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('class', 'cycle__topo')
  svg.setAttribute('viewBox', '0 0 1200 600')
  svg.setAttribute('preserveAspectRatio', 'none')
  svg.setAttribute('aria-hidden', 'true')
  // Curvas de nível em dois grupos, um em cada canto: a mesma onda deslocada aos poucos.
  const group = (x0, y0, dir) => {
    for (let k = 0; k < 14; k++) {
      let d = ''
      for (let t = 0; t <= 60; t++) {
        const x = x0 + dir * t * 14
        const y = y0 + dir * (k * 9 - t * 5) + Math.sin(t / 7 + k * 0.25) * (26 + k * 2)
        d += (t ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)
      }
      const path = document.createElementNS(NS, 'path')
      path.setAttribute('d', d)
      svg.appendChild(path)
    }
  }
  group(-40, 140, 1)
  group(1240, 470, -1)
  card.prepend(svg)
}

function orbit(el) {
  const card = el.closest('.cycle')
  if (card) topo(card)
  const core = el.querySelector('.orbit__core')
  const PERIOD = 16000 // ms para uma volta inteira
  const items = STEPS.map((s) => {
    const item = document.createElement('span')
    item.className = 'orbit__item'
    item.title = s.title
    item.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${s.icon}</svg>`
    el.appendChild(item)
    return item
  })
  const num = card?.querySelector('[data-cycle-num]')
  const title = card?.querySelector('[data-cycle-title]')
  const text = card?.querySelector('[data-cycle-text]')
  let current = -1
  const show = (i) => {
    if (i === current) return
    current = i
    items.forEach((it, k) => it.classList.toggle('on', k === i))
    if (num) num.textContent = String(i + 1).padStart(2, '0')
    if (title) title.textContent = STEPS[i].title
    if (text) text.textContent = STEPS[i].text
  }

  // Posição de cada etapa no anel de fora: a etapa i começa no topo menos i * 60°, então, girando no
  // sentido horário, a seguinte chega ao topo logo depois dela.
  const place = (turn) => {
    const r = el.clientWidth / 2
    let top = 0
    let best = Infinity
    items.forEach((it, i) => {
      const deg = -90 - i * 60 + turn * 360
      const a = (deg * Math.PI) / 180
      it.style.transform = `translate(${(Math.cos(a) * r).toFixed(1)}px, ${(Math.sin(a) * r).toFixed(1)}px)`
      const fromTop = Math.abs(((((deg + 90) % 360) + 540) % 360) - 180)
      if (fromTop < best) {
        best = fromTop
        top = i
      }
    })
    show(top)
  }
  place(0)
  if (reduceMotion) return

  // O centro se inclina um pouco na direção do mouse.
  card?.addEventListener('pointermove', (e) => {
    const box = core.getBoundingClientRect()
    const dx = e.clientX - (box.left + box.width / 2)
    const dy = e.clientY - (box.top + box.height / 2)
    const d = Math.hypot(dx, dy) || 1
    const k = Math.min(1, d / 300) * 12
    core.style.transform = `translate(${((dx / d) * k).toFixed(1)}px, ${((dy / d) * k).toFixed(1)}px)`
  })
  card?.addEventListener('pointerleave', () => (core.style.transform = ''))

  let visible = false
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(el)
  let turn = 0
  let prev = performance.now()
  ;(function loop(now) {
    if (visible) {
      turn = (turn + (now - prev) / PERIOD) % 1
      place(turn)
    }
    prev = now
    requestAnimationFrame(loop)
  })(prev)
}
document.querySelectorAll('[data-orbit]').forEach(orbit)

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
