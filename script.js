// Frases do hero trocando a cada poucos segundos.
const items = [...document.querySelectorAll('#ticker li')]
let current = 0
if (items.length) {
  items[0].classList.add('is-on')
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setInterval(() => {
      const prev = items[current]
      current = (current + 1) % items.length
      prev.classList.replace('is-on', 'is-off')
      setTimeout(() => prev.classList.remove('is-off'), 450)
      items[current].classList.add('is-on')
    }, 2600)
  }
}

// Seções aparecem ao entrar na tela.
const targets = document.querySelectorAll('.section .wrap > *, .final .wrap > *')
targets.forEach((el) => el.classList.add('reveal'))
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      entry.target.classList.add('is-visible')
      observer.unobserve(entry.target)
    }
  },
  { threshold: 0.12 }
)
targets.forEach((el) => observer.observe(el))
