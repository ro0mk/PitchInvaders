# ⚽ Pitch Invaders

Salta a vedação a meio de um jogo de futebol, invade o relvado e **foge da segurança o máximo de tempo possível**.
Jogo 3D na terceira pessoa: fintas, roletas, saltos e deslizes valem **XP**. O objetivo é bater o recorde de tempo em campo sem ser apanhado.

![Menu](docs/menu.jpg)
![Em jogo](docs/jogo.jpg)

---

## Como jogar

### 1. Executável (Windows / Linux / macOS)

O GitHub Actions gera os executáveis automaticamente a cada push (workflow **Executáveis**):

1. Abre o separador **Actions** do repositório → **Executáveis** → a execução mais recente.
2. Em **Artifacts**, descarrega:
   - **PitchInvaders-Windows**: `PitchInvaders-1.0.0-portable.exe` (corre sem instalar) ou `PitchInvaders-1.0.0-setup.exe` (instalador)
   - **PitchInvaders-Linux**: `PitchInvaders-1.0.0-linux-x86_64.AppImage` (`chmod +x` e executa)
   - **PitchInvaders-macOS**: `.dmg`

Se criares uma tag `v*` (por exemplo `v1.0.0`), os mesmos ficheiros são publicados numa **Release**.

> **Windows:** o executável não está assinado, por isso o SmartScreen pode avisar que "O Windows protegeu o computador". Carrega em **Mais informações → Executar mesmo assim**.
> **macOS:** clica com o botão direito na app → **Abrir**.

### 2. No browser, sem instalar nada

Descarrega [`dist/PitchInvaders.html`](dist/PitchInvaders.html) e abre-o com duplo clique (Chrome, Edge ou Firefox).
É um único ficheiro com o jogo todo e funciona offline.

### 3. A partir do código

```bash
npm install
npm start            # gera o jogo e abre-o na app de ambiente de trabalho (Electron)
npm run build        # só gera dist/PitchInvaders.html
npm run dist:win     # gera os .exe (corre no Windows)
npm run dist:linux   # gera o AppImage
npm run dist:mac     # gera o .dmg (corre no macOS)
```

---

## Controlos

| Tecla | Ação |
|---|---|
| `W` `A` `S` `D` | Correr |
| Rato / `←` `→` | Rodar a câmara (clica no ecrã para capturar o rato) |
| `Shift` | Sprint (gasta energia) |
| `Q` / `E` | **Finta** para a esquerda / direita |
| `F` / botão direito | **Roleta**: és invencível durante o giro |
| `Espaço` | **Salto**: passas por cima das placagens |
| `C` | **Deslize**: passas por baixo dos agarrões |
| `T` | Selfie com um craque ★ |
| `Esc` / `P` | Pausa |
| `F11` | Ecrã inteiro (na app) |

**Comando (Xbox/PlayStation):** stick esquerdo corre, stick direito roda a câmara, A salto, B deslize, X roleta, LB/RB finta, RT sprint, Y selfie, Start pausa.

---

## Perseguidores

Antes de cada ataque aparece um **!** por cima da cabeça do perseguidor. Tens uma fração de segundo para reagir com o truque certo.

| Perseguidor | Ataque | Contra-ataque ideal | Aparece |
|---|---|---|---|
| 🟡 **Segurança** (colete amarelo) | Agarrão (alto) | **Deslize**, Roleta ou Finta | desde o início, em postos à volta do campo |
| 🔴 **Polícia** (farda azul) | Placagem em voo (baixo) | **Salto**, Roleta ou Finta | a partir do nível de alerta 2 |
| 🟠 **Cão polícia** | Salto (alto) | **Roleta**, Finta ou Deslize | a partir do nível de alerta 4 |

- O **nível de alerta** (★ no topo do ecrã) sobe a cada ~28 s e quando fazes combos enormes. Cada nível traz mais perseguidores, mais rápidos.
- Se te agarrarem, carrega **Espaço** repetidamente para fugir. Se outro perseguidor chegar antes de te libertares, foste apanhado. Cada fuga torna a seguinte mais difícil.
- A **energia** gasta-se com o sprint e com os truques. Se a esgotares ficas mais lento até recuperares.
- O radar (canto inferior direito) e as setas nos cantos do ecrã mostram quem vem atrás de ti.

---

## XP

| Jogada | XP base |
|---|---|
| Esquiva simples (o ataque falha) | 30 |
| Finta / Roleta / Salto / Deslize no momento do ataque | 60 / 90 / 80 / 80 |
| **PERFEITO**: o truque salvou-te mesmo no último instante | ×2 + câmara lenta |
| Por um triz (a menos de 0,9 m) | ×1,4 |
| Dupla esquiva (dois ataques seguidos) | +60 |
| **Cueca**: deslizar entre as pernas de um segurança | 130 |
| **Chapéu**: saltar por cima de um polícia | 130 |
| **Choque**: dois perseguidores chocam um contra o outro | 150 |
| Tropeção: um perseguidor placa um jogador | 100 |
| Tornozelos partidos: a finta deita o segurança ao chão | 40 |
| Rasante: passar a correr colado a um perseguidor | 15 |
| **Golo**: chutar a bola para a baliza | 500 |
| **Selfie** com um craque ★ | 250 |
| Escapar de um agarrão | 200 |
| Sobreviver | 2 + 1,5 × nível de alerta por segundo |

- **Combo:** cada jogada seguida (com menos de 4,5 s de intervalo) sobe o multiplicador, de ×1 até **×8**. Se te agarrarem, o combo volta a zero.
- **Variedade:** repetir o mesmo truque rende menos (70 %, 50 %, 35 %), por isso vale a pena alternar.
- **Recordes** de tempo, XP e combo ficam guardados. Todo o XP conta para o teu **nível de carreira**, de *Adepto de Bancada* até *Imparável*.

---

## Estrutura do projeto

```
src/
  main.js       estado do jogo, eventos, XP e recordes
  player.js     invasor: movimento, energia, truques, luta para fugir
  enemies.js    seguranças, polícias e cães: perseguição, ataques, dificuldade
  match.js      jogadores, árbitro e bola (simulação do jogo + golos)
  stadium.js    relvado, balizas, bancadas com público animado, holofotes, ecrã gigante
  character.js  modelos low-poly e animações procedurais
  camera.js     câmara em 3.ª pessoa
  hud.js        HUD, radar, setas de aviso e popups
  scoring.js    XP, combos e estatísticas
  audio.js      som sintetizado (público, apito, efeitos)
  input.js      teclado, rato e comando
electron/main.cjs   app de ambiente de trabalho
scripts/build.mjs   junta tudo num único dist/PitchInvaders.html
```

Feito com [three.js](https://threejs.org/) e [Electron](https://www.electronjs.org/). Todos os gráficos e sons são gerados por código: não há ficheiros externos.
