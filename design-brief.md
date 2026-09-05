# chesskids — Design Brief

Reference material and design direction for agents building the chesskids interface.
This document governs look, feel, structure, and interaction. It does not govern chess
logic — see `contracts/board-state.md` for that.

---

## 1. The audience

**Ages 6–8. Not 6–9, not 5–10.**

Nielsen Norman Group's research on children's UX splits kids into three brackets — 3–5,
6–8, and 9–12 — because physical and cognitive ability shift sharply between them. Their
finding that matters most here: children react *negatively* to content pitched even one
school grade off their own. A six-year-old in their testing dismissed a site as being
"for babies."

What 6–8 means concretely:

- **Beginner readers.** They can read, slowly, with effort. Text is a cost, not a free
  channel. Every word on screen must earn its place.
- **Developing fine motor control.** Precision dragging is unreliable. Small targets get
  missed. NN/g recommends roughly double the adult minimum touch target for this group.
- **Concrete thinkers.** They take instructions literally. "Move your knight" works.
  "Consider your options" does not.
- **Short sessions.** Design for 5–10 minutes of productive attention, not 45.
- **Allergic to condescension.** They know when they're being talked down to and they
  resent it.

---

## 2. The reference stack

Three sources, each governing a different layer. When they conflict, the layer wins in
its own domain.

### Duolingo — the skeleton

Structure and flow. This is the primary structural reference.

Take:
- A single linear path. The learner sees where they are, what's next, and nothing else.
- One action per screen. Never a menu of choices mid-lesson.
- A lesson is short and has a definite end, with a celebration at that end.
- Immediate feedback on every attempt.
- Progress is visible and permanent.
- Effectively zero navigation chrome during a lesson.

Do **not** take:
- Hearts / lives. A six-year-old locked out of a lesson is a six-year-old who quits.
- Streaks that punish. Streak-breaking guilt is not appropriate for this age.
- Leaderboards or competitive ranking.
- Notification pressure.

### Toca Boca — the discipline

Brand tightness and restraint. One confident voice, few doors, no dead ends.

Take:
- A small number of destinations. If a screen doesn't move the learner forward, cut it.
- No fail state that feels like failure. Exploration is always safe.
- Confident, saturated color used consistently — not a different accent per section.
- The product has a personality, and it's the same personality everywhere.

### Bluey — the surface

Palette, illustration register, and tone of voice.

Take:
- Warm, sunlit color that is saturated but soft. Not primary-bright, not washed pastel.
- Flat vector illustration with generous rounded forms.
- Tone that is warm and playful without ever being saccharine or babyish. Bluey's whole
  trick is that it respects children as people.

**Do not take, under any circumstances:**
- Character designs, likenesses, or anything derivative of them.
- The Bluey logo or its display typeface.
- Names, episode references, or dialogue.

Bluey is Ludo Studio / BBC Studios intellectual property and is aggressively protected.
This repository is public and serves as a portfolio artifact. The brief is *palette and
emotional register only* — everything drawn must be original.

### Also worth studying

- **Code.org / Blockly Games** — the best onboarding for pre- and beginner readers on the
  web. Teaches by demonstration, requires no account to start.
- **ChessKid** — the incumbent. Study how it presents the board and its bots.
- **PBS Kids, Khan Academy Kids** — ad-free, character-guided, gentle pacing.
- **Pok Pok** — calm interaction design; proof that kid software doesn't have to be loud.
- **Prodigy** — study as a *cautionary* case. Its reward loop is detached from its
  learning content and its upsell pressure is constant. Avoid both.

---

## 3. Locked decisions

These are settled. Do not revisit them.

| Decision | Value |
|---|---|
| Age bracket | 6–8 |
| Structural model | Linear path, Duolingo-style |
| Piece art | Traditional silhouettes, soft flat style |
| Primary interaction | Tap-to-move |
| Device support | Tablet and desktop, equally |
| Bots | Custom named-flaw bots, not weakened Stockfish |
| Fail state | Soft. No lives, no timers, no lockout. |

---

## 4. Structure

```
  PATH  ──▶  LESSON  ──▶  CELEBRATION  ──▶  next node unlocks
                │
                └── 3–6 micro-challenges, one screen each
```

The path is the home screen. There is no other home screen.

A learner arriving at the site sees the path, with their current node lit and everything
after it dimmed. Tapping the current node enters a lesson. Everything else on that screen
is decoration or progress history.

A lesson is 3–6 micro-challenges. Each occupies one screen and asks for exactly one thing.
At the end, a short celebration and the next node unlocks.

Periodically the path offers a **play node** instead of a lesson: a game against one of
the named-flaw bots. The bot's flaw is the skill the preceding lessons taught. This is the
assessment, and it should never be labeled as one.

**Total destinations outside the path: as close to zero as possible.** Settings, if
needed, belong behind a grown-up gate.

---

## 5. Board and pieces

The board is the product. It deserves more care than anything else on screen.

- **Traditional silhouettes.** A child who learns here must recognize a real knight on a
  real board later. Charm comes from color, weight, and animation — not from replacing the
  pieces with animals.
- **Soft flat style.** No gradients, no bevels, no drop shadows imitating depth. Rounded
  forms, generous negative space inside each silhouette, a single flat fill.
- **High contrast between the two sides.** Do not rely on light-vs-dark alone; the two
  sides should differ in hue as well, so the distinction survives poor screens and color
  vision differences.
- **Square colors derive from `board.size`.** Never hardcode a grid. Note the constraint
  already documented in `contracts/board-state.md`: the "bottom-right square is light"
  convention only holds on even-sized boards, so tier-one small boards need an explicit
  decision rather than an inherited assumption.
- **Legal-move affordance.** When a piece is selected, its legal destinations must be
  unmistakable — a filled dot on empty squares, a ring on capturable pieces. This is the
  single most important teaching affordance in the whole product.

### Proposed palette

Original values, in Bluey's register. The agent may adjust, but should stay in this
emotional range — warm, sunlit, saturated-but-soft.

| Token | Hex | Role |
|---|---|---|
| `sand` | `#F6EDDD` | Page ground |
| `heeler` | `#3D6E9E` | Primary structural blue |
| `sky` | `#A8D4E6` | Light accents, dark board square |
| `mango` | `#F2A93B` | Progress, reward, the "yes" color |
| `mint` | `#7FC4A0` | Success |
| `coral` | `#E4574B` | Emphasis only — never for errors |
| `ink` | `#2E3A44` | Text and piece silhouettes |

Board squares: light `#F3E4C8`, dark `#7FA9C4`.

`coral` is deliberately not the error color. Nothing in this product should read as an
error. Wrong answers get a gentle nudge in `heeler`, not a red alarm.

### Typography

Two families, clearly distinct:

- **Display:** a rounded geometric sans with real weight — Baloo 2 or Fredoka.
- **Body / UI:** **Lexend**, which was designed specifically to improve reading
  performance in children.

Avoid: all-caps labels, single-word accenting inside headlines, eyebrow labels above
headings. These read as generic template chrome.

---

## 6. Interaction

**Tap-to-move is primary.** Tap a piece, its legal moves appear, tap a destination.

Drag-and-drop may be layered on as an enhancement for users who reach for it, but the
product must be fully usable without it. Two reasons: fine motor control at this age makes
precision dragging unreliable, and tap-to-move is the only model that behaves identically
on a tablet and on a laptop trackpad. NN/g found that children under nine prefer a
trackpad to a mouse, which makes drag precision worse still.

Other constraints:

- **Touch targets ≥ 64px**, with generous spacing between them. Roughly double the adult
  minimum.
- **Motion answers actions.** A piece moving, a node unlocking, a celebration firing —
  these earn animation. Ambient motion, scroll-triggered fades, and hover effects on
  everything do not.
- **Respect `prefers-reduced-motion`.**
- **Nothing is timed.** No countdowns, no speed bonuses, no pressure.
- **Every action is undoable** during a lesson.

---

## 7. Voice

Short. Concrete. Active. Second person.

- "Move your knight to the star." — good.
- "Try to identify the optimal square for your knight." — bad.

Rules:
- Sentence case everywhere.
- A button says what happens: "Play," not "Submit."
- An action keeps its name through the whole flow.
- Wrong answers get information, not sympathy: *"That square isn't safe — the bishop can
  reach it."* Never "Oops!" and never "Don't worry!"
- No exclamation marks outside of genuine celebration.

**Audio is an open question — see §9.**

---

## 8. Anti-patterns

Kid-design failures:
- Text where a picture or a demonstration would work.
- Rewards detached from learning (see Prodigy).
- Any tone that reads as "for babies."
- Loud, primary-color, rainbow-gradient "fun."
- Ads, upsells, or external links of any kind.

Generic-design failures — these are the tells of templated output:
- Warm cream background + high-contrast serif display + terracotta accent.
- Content chopped into identical rounded cards with the same soft grey shadow.
- Numbered markers (01 / 02 / 03) on content that isn't a sequence.
- Tracked-out all-caps eyebrow labels; meta strings joined with middle dots; "→" appended
  to every button.
- Fade-and-slide-up entrances on every section.

Spend boldness in one place. The board should be the memorable thing; everything around it
stays quiet.

---

## 9. Deliberately left open

The agent has latitude here and should propose rather than ask.

- **Audio and narration.** How much the app reads aloud is unresolved. Beginner readers
  benefit enormously from narration, but it's expensive to produce and can be grating on
  repeat. Propose a position — full narration, instructions-only, or text-only-kept-short
  — with reasoning.
- **The bot cast.** The named-flaw bots are the product's characters. Their names,
  personalities, and visual design are open. The constraint is that each bot's flaw must be
  the skill the preceding lessons taught, and the flaw should be *discoverable by a child*
  — "he never protects his queen" is a flaw a seven-year-old can notice and exploit.
- **The path's visual metaphor.** Duolingo uses a winding road. Something else may fit
  chess better. Open.
- **Celebration design.** What happens at the end of a lesson. Should feel earned, not
  automatic.
- **Illustration style within the flat-vector constraint.** Line weight, character of the
  forms, texture. Take a real position.
- **The grown-up gate.** How parents see progress, if at all.

---

## 10. Quality floor

Not negotiable, and not worth announcing in the UI:

- Responsive to mobile.
- Visible keyboard focus.
- `prefers-reduced-motion` respected.
- Color contrast meets WCAG AA.
- No ads, no third-party trackers, no external links out of the learning flow.
- Works without an account for at least the first lesson.-
-