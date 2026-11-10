# aptitudetest

A 1-hour aptitude test that runs in the browser. It needs no install and no build step.

**Run it:** open `index.html` in any browser, or turn on GitHub Pages for this repo.

## Sections (~61 min)

| # | Section | Time | What it tests |
|---|---------|------|---------------|
| 1 | Verbal fluency | 3 × 60 s | Name languages, words starting with S, animals |
| 2 | Number sequence memory | ~6 min | Repeat digit sequences forwards, then in reverse |
| 3 | Mathematics | 15 min | 15 questions: percentages to probability and expected value |
| 4 | Logical reasoning | 10 min | Truth/lie, seating order, syllogisms, codes, directions |
| 5 | Visual reasoning | 8 min | Rotated-shape matching (spot the mirror image) and picture patterns |
| 6 | Symbol–letter matching | 2 × 90 s | Symbol → letter, then letter → symbol |
| 7 | Dot sequence (Simon says) | ~5 min | Click lit dots in order, then in reverse |
| 8 | Words & meanings | 6 min | Synonyms, opposites, context, spelling, analogies |
| 9 | Reflection | ~3 min | Written notes for the discussion with the assessor |

## AI coach (DeepSeek)

Every question has a **Coach** panel. Tell it how you are thinking, and it says what's right, points to the first step that goes wrong, and asks a guiding question. It won't give the answer away until you've locked yours in.

- The first time, paste your DeepSeek API key (from platform.deepseek.com). It is saved only in your browser's localStorage and sent only to `api.deepseek.com`.
- Change the model (`deepseek-chat` or `deepseek-reasoner`) or remove the key under ⚙ Settings.

## Pen & phone

- **Scratch paper** under each question: pressure-sensitive pen, palm rejection, and the S Pen side button erases.
- On Samsung phones you can write straight into the coach's text box with the S Pen (S Pen to text).
- Big tap targets, and the Back/Next bar stays at the bottom of the screen. Light/dark follows your phone setting.

## Modes

- **Exam**: sections are timed, and answers with explanations are shown at the end.
- **Practice**: questions are untimed, and a step-by-step explanation with a "simple trick" appears right after each answer.

You can tick or untick sections on the start screen to practise only some of them.

## Files

- `questions.js`: question bank with plain-language explanations (edit this to add questions)
- `coach.js`: AI coach (DeepSeek streaming chat, guiding prompt)
- `scratch.js`: pen scratch paper
- `app.js`: test engine (timers, memory tasks, visual question generator, results)
- `styles.css`: styling, with light and dark modes
