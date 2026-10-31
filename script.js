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
