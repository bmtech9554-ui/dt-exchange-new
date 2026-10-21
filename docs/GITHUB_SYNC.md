# Windows and macOS development

This repository contains only the active dt-exchange-new source. Older source copies are not included.
Target: https://github.com/bmtech9554-ui/dt-exchange-new (creation and initial upload must be confirmed separately).

## First Mac setup (after the initial upload)

Install Git/Xcode Command Line Tools, Flutter, Android Studio with Android SDK and its supported JDK, and Node/package managers matching this project's configuration. Install Xcode and CocoaPods if building iOS. Use local development databases; never copy production databases into Git.

```sh
git clone https://github.com/bmtech9554-ui/dt-exchange-new.git
cd dt-exchange-new
git config pull.ff only
git config fetch.prune true
git config core.autocrlf false
git switch -c mac/first-task
```

In Codex choose This Computer and open this cloned folder. Select GPT-6 Astra in the model picker if available. Keep credentials in locally configured, ignored files. Never commit signing keys.

## Windows

Open the existing source folder in Codex. Once the first main commit exists, create a task branch with `git switch -c windows/task-name`. Use a different branch for each simultaneous task or device. Git synchronizes committed source, not Codex conversations or local credentials.

## Synchronization

Start from current main: `git switch main` then `git pull --ff-only origin main`. Create a task branch. Review `git status` and `git diff`, run relevant tests, and commit only reviewed files. Push the task branch with `git push -u origin HEAD` and open a pull request into main. Do not force-push shared branches. Initial source upload requires the owner's separate approval.

To update a task branch, run `git fetch origin` then `git merge origin/main`. For conflicts, inspect both versions, resolve deliberately, run tests, stage resolved files and complete the merge. Use `git merge --abort` if unsure; do not overwrite files wholesale to silence conflicts.

## Local dependencies

DT Exchange uses the root .nvmrc and npm lockfile: `npm ci`; Flutter is in mobile. Belora uses pnpm-lock.yaml: `pnpm install --frozen-lockfile`; Flutter is in apps/mobile. Run `flutter pub get` inside the relevant mobile folder; Flutter regenerates ignored platform bootstrap files. Follow the existing README for local services and environment setup. Never run production migrations or deployments as part of workstation setup.
