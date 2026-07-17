# Baby Colors

Baby Colors is a gentle matching game designed for little learners. It opens
with three game modes:

- **Letters** matches uppercase letters from A through Z.
- **Numbers** matches digits from 0 through 9.
- **Shapes** matches colorful familiar shapes.

Each mode begins with one pair and gradually grows to five. Children can drag a
piece to its target or select a piece and target using touch, mouse, or keyboard.
Soft music-box background music begins after a mode is selected. Correct and
mismatched targets have short instrumental feedback sounds with subtle
mode-specific variations. A sound button in the game header controls all audio.
Progress and sound preferences last only for the current page session, and the
game does not use accounts, cookies, or browser storage.

## Requirements

- Node.js 22.13 or newer

## Development

Install dependencies and start the local development server:

```bash
npm install
npm run dev
```

## Validation

Run the production build and automated tests:

```bash
npm test
```

Run the code-quality checks separately:

```bash
npm run lint
```

Regenerate the committed audio assets without external tools or dependencies:

```bash
npm run audio:generate
```

To create only the production build:

```bash
npm run build
```

## Docker Deployment

Build the production image and start the app in the background:

```bash
docker compose up -d --build
```

Open `http://<server-ip>:9707` in a browser. Check the container and follow its
logs with:

```bash
docker compose ps
docker compose logs -f baby-colors
```

After updating the repository checkout, rebuild and replace the running
container:

```bash
docker compose up -d --build
```

Stop and remove the deployment with:

```bash
docker compose down
```

## Project Structure

- `app/GameBoard.tsx` contains mode selection and matching interactions.
- `app/use-game-audio.ts` contains session-only music and feedback playback.
- `app/game-logic.ts` contains deterministic level and difficulty generation.
- `app/globals.css` contains the responsive game visuals.
- `scripts/generate-audio.mjs` deterministically creates the committed WAV files.
- `tests/` contains level-generation and rendered-page checks.
