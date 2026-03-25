# 🐍 Nibbles Pro

> **Snake moderno** com power-ups, sistema de monetização, Web Audio API e suporte PWA.  
> Desenvolvido por [Dione Castro Alves](https://github.com/Foxactive1) · InNovaIdeia

[![Deploy](https://img.shields.io/badge/deploy-Vercel-black?logo=vercel)](https://snake-storm-foxactive1s-projects.vercel.app/)
[![License](https://img.shields.io/badge/license-MIT-blue)](#licença)
[![HTML](https://img.shields.io/badge/HTML-5-orange?logo=html5)](index.html)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-yellow?logo=javascript)](game.js)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-purple?logo=bootstrap)](https://getbootstrap.com)

---

## 🎮 Demo ao vivo

**[snake-storm-foxactive1s-projects.vercel.app](https://snake-storm-foxactive1s-projects.vercel.app/)**

---

## ✨ Funcionalidades

| Funcionalidade | Descrição |
|---|---|
| 🎯 Power-ups | Escudo, Crescer, Lento, 2× Pontos — no campo e na loja |
| 🪙 Moedas | Sistema de moedas com anúncio simulado e loja integrada |
| 💎 Premium | Plano premium: remove anúncios, dobra moedas |
| 🔊 Web Audio | Efeitos sonoros sintéticos (Web Audio API) com controle de volume |
| 📱 Mobile | Suporte completo a swipe e layout responsivo |
| 📦 PWA | Instalável como app (manifest + theme-color) |
| 💾 Persistência | Recorde e preferências salvas no localStorage |
| 📊 Analytics | Eventos de sessão persistidos no sessionStorage |

---

## 🚀 Como rodar localmente

```bash
git clone https://github.com/Foxactive1/snake_storm.git
cd snake_storm

# Qualquer servidor estático funciona — exemplos:
python -m http.server 8000
# ou
npx serve .
```

Abra `http://localhost:8000` no navegador.

> ⚠️ Abrir `index.html` diretamente com `file://` funciona, mas o manifest PWA só é registrado via HTTP(S).

---

## 🎮 Controles

| Ação | Teclado | Mobile |
|---|---|---|
| Mover | `↑ ↓ ← →` ou `W A S D` | Swipe |
| Iniciar / Pausar | `Espaço` | Botão na tela |
| Reiniciar | `R` | Botão na tela |

---

## 🏗️ Arquitetura

O projeto segue arquitetura **modular vanilla JS**, sem dependências de build:

```
snake_storm/
├── index.html      # Estrutura HTML + modais + overlays
├── style.css       # Estilos (variáveis CSS, responsividade)
├── game.js         # Lógica do jogo (8 módulos)
└── manifest.json   # PWA manifest
```

### Módulos em `game.js`

| Módulo | Responsabilidade |
|---|---|
| `Config` | Constantes globais (grid, cores, dificuldades, power-ups) |
| `Utils` | Helpers (randInt, posEqual, roundRect, getValidRandomPosition) |
| `Analytics` | Registro de eventos com persistência em sessionStorage |
| `AudioManager` | Síntese de áudio via Web Audio API |
| `Conta` | Dados do jogador (nome, moedas, premium) com localStorage |
| `Monetization` | Loja, compras simuladas, anúncios |
| `Game` | Estado e lógica do jogo (loop RAF, colisões, power-ups) |
| `UI` | Renderização canvas, DOM, toasts, overlays |

---

## 🐛 Changelog v2.0.0

### Bugs corrigidos
- **Colisão cauda injusta** — check de corpo agora exclui o último segmento (que vai sair no mesmo tick), eliminando mortes falsas ao entrar no espaço que a cauda libera.
- **Slow power-up (stacking)** — reversão ao expirar agora restaura `_prevSpeedMultiplier` (valor anterior), não o valor base. Múltiplos slows simultâneos funcionam corretamente.
- **`alert()` no toast** — substituído por toast Bootstrap nativo, não bloqueia mais a thread nem o game loop.

### Melhorias de performance
- **Game loop: `setInterval` → `requestAnimationFrame` + delta-time** — elimina drift temporal, especialmente perceptível em mobile com frequências de tela variáveis.
- **Swipe sem scroll** — `touchend` mudado para `passive: false` com `preventDefault()` condicional, impedindo que a página role durante o controle do jogo.

### Melhorias de arquitetura
- **Separação de arquivos** — CSS e JS extraídos do HTML para `style.css` e `game.js` (cache do browser, linting, manutenção).
- **Canvas responsivo dinâmico** — `resizeCanvas()` recalcula o grid ao carregar e ao redimensionar a janela, garantindo células inteiras em qualquer viewport.

### Acessibilidade e UX
- `aria-label` em todos os botões de controle.
- Font Awesome movido para `<head>` (elimina flash de ícones).
- `speedBar` reflete o intervalo real após `speedMultiplier`.
- `ensureFoodCount` exclui moedas da contagem mínima de comidas.
- Analytics persiste no `sessionStorage` para diagnóstico de sessão.

### PWA
- `manifest.json` com nome, cores, orientação e ícones.
- Meta tags `theme-color`, `apple-mobile-web-app-capable`.
- `touch-action: none` no canvas via CSS (evita gestos padrão do browser).

---

## 📄 Licença

MIT © 2025 [Dione Castro Alves — InNovaIdeia](mailto:innovaideia2023@gmail.com)
