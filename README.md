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

## Fresh every attempt

- **Maths (29 question types)** and most **logic** (truth/lie, seating, ordering, codes, directions, odd-one-out, letter series, days): generated with new numbers, names and layouts each time, with the answer and explanation worked out automatically.
- **Hand-written pools:** 20 syllogisms, 12 if-then puzzles, 12 family riddles, and 240 vocabulary items (synonyms, opposites, meanings, spelling, analogies, odd-one-out). That's enough for 15 full tests with no repeated vocabulary.
- **Visual:** random shapes, angles, mirror-image tasks and 5 kinds of picture pattern.
- **Fluency:** random categories and a random letter.
- Answer options are shuffled every time, and the questions you've seen least come first (tracked in your browser; reset under ⚙ Settings).

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

- `generators.js`: question generators for maths and logic
- `questions.js`: hand-written question pools with plain-language explanations (edit this to add questions)
- `coach.js`: AI coach (DeepSeek streaming chat, guiding prompt)
- `scratch.js`: pen scratch paper
- `app.js`: test engine (timers, memory tasks, visual question generator, results)
- `styles.css`: styling, with light and dark modes

## VMware prep (`vmware/`)

A second app in this repo, with the same look and the same DeepSeek coach: learn VMware vSphere, storage and server hardware from the basics, using one real environment as the example.

**Run it:** open `vmware/index.html`, or on GitHub Pages go to `/vmware/`. It shares your saved DeepSeek key with the aptitude test.

- **7 lessons:** hardware, vSphere and clusters, storage, networking, VMs and housekeeping, performance, and "my environment".
- **86 quiz questions** (options shuffled every time), with an explanation after each one. Quiz by module, mixed, **weak spots** (what you got wrong), or a 20-question **interview round** with no hints.
- **20 scenario challenges:** write your answer, get an AI review, then tick the points of a rubric and compare with the model answer.
- **13 interactive diagrams** inside the lessons and in the **Visual lab**: tap parts of a server, drag NUMA/CPU/datastore/snapshot sliders, fail a host, a storage path or a network uplink and watch what survives, step through a vMotion and tick what would block it, walk through retiring a VMFS 5 datastore, and follow a "the VM is slow" decision tree.
- **Pictures in quiz questions:** 13 questions show a diagram, and some show a labelled version after you check your answer.
- **AI coach** on every lesson, question and challenge. It guides before you answer and explains fully after. A free **tutor** page can run a mock interview.
- **My environment:** the headline numbers to learn by heart. Hostnames, IPs and company names are left out on purpose (this repo is public).
- Progress is saved only in your browser (⚙ Settings to reset).

Files: `vmware/diagrams.js` and `diagrams-more.js` (interactive diagrams and quiz pictures), `vmware/data-lessons.js` (lessons and environment facts), `data-questions.js` (question bank, correct answer listed first), `data-challenges.js` (scenarios), `coach.js`, `app.js`, `vmware.css`.
