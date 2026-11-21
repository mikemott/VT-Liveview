# Mobile testing

How we check the app on phones and tablets (VTL-93). Playwright only emulates a
phone: the screen size, user agent and touch. It does **not** reproduce
browser toolbars that come and go, in-app browsers, the on-screen keyboard,
notches, or real iOS Safari. So the checks come in layers.

## 1. Automated, on every PR (CI)

| Project | Device | Engine | Screen |
|---|---|---|---|
| `chromium` | Desktop Chrome | Chromium | 1280×720 |
| `webkit` | Desktop Safari | WebKit | 1280×720 |
| `mobile` | Pixel 7 | Chromium | 412×839 |
| `iphone-se` | iPhone SE (1st gen, the smallest iPhone) | WebKit | 320×568 |
| `iphone` | iPhone 15 | WebKit | 393×659 |
| `android-small` | Galaxy S8 | Chromium | 360×740 |

- The three new phone projects run functional tests only. Visual baselines
  stay on the first three (ADR 0002).
- **`e2e/layout.spec.ts`** checks that the floating controls are on screen and
  don't overlap each other. The controls are the search bar, chip strip, ☰,
  map controls, scale bar, map credit, weather card, theme/share buttons and
  side panel.
  - It runs at every project's own screen size.
  - On phones it runs again 80px shorter, the room a browser toolbar takes.
  - In desktop Chromium it also runs at the smallest iPhone (with and without a
    toolbar), a phone in landscape, two tablets and a small laptop.
  - Add a size there when a new device class matters.
- **`src/__tests__/viewportUnits.test.ts`** fails any CSS that uses `vh`
  without a `dvh` override in the same rule. `vh` is the height with the
  toolbars hidden, so it puts things behind them on iOS Safari and in-app
  browsers.

Phone layout applies when the screen is ≤768px wide **or** ≤500px tall (a phone
in landscape). `useIsMobile` and the CSS media queries must agree.

Run locally: `npm run test:e2e`, or one project with `--project=iphone-se`. On
the NixOS agent box, see `PROJECT.md` → Environment. WebKit projects only run
in CI.

## 2. Real devices (BrowserStack)

Each PR gets a Cloudflare preview (`https://<branch>.vt-liveview.pages.dev`,
linked in the PR's Cloudflare comment). BrowserStack Live opens that link on
real iPhones and Android phones from the browser.

Setup (Mike, one time):
1. Apply to BrowserStack's free open-source program:
   https://www.browserstack.com/open-source. The repo is public and MIT
   licensed, which it requires.
2. Once approved, use **Live** (manual testing) with the preview URL. No code
   changes are needed for this.
3. Optional, later: add `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY`
   as GitHub secrets. Then a CI job can run a few key Playwright specs on real
   Android devices. Check BrowserStack's current Playwright device support
   first, because iOS real-device support for Playwright has been limited.

Devices to cover for UI changes:
- iPhone SE (2nd/3rd gen), Safari
- a current iPhone, Safari
- a current iPhone, Chrome
- a Pixel, Chrome
- a Samsung Galaxy, Samsung Internet
- an iPad, Safari

## 3. Manual phone checklist (for UI PRs)

On the Cloudflare preview, on a real phone:
- [ ] Safari and Chrome: the search bar and chip strip are fully visible at the bottom
- [ ] An in-app browser (open the link from Messages or Slack)
- [ ] Rotate to landscape: still the phone layout, nothing overlapping
- [ ] Tap search, type with the keyboard up: results show above the bar
- [ ] Swipe the chip strip; toggle a chip, then open ☰ and check it matches
- [ ] Open a detail panel (tap a marker): the bottom isn't cut off

## Debugging on a real phone
- **Android:** USB debugging on, plug in, open `chrome://inspect` in desktop
  Chrome for full dev tools on the phone.
- **iPhone:** needs a Mac. Turn on Settings → Safari → Advanced → Web
  Inspector, plug in, then use Safari's Develop menu on the Mac. The Xcode iOS
  Simulator runs real Mobile Safari.
