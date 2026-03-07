# macOS Signing and Notarization Notes

Saved on 2026-03-07 for later implementation.

This document captures the intended future flow for signing and notarizing the Electron companion app. It is not implemented yet.

## Goal

Turn the local packaged app into a distributable macOS app that passes Gatekeeper more cleanly.

Current local package:

- `/Users/iwa/repos/ableton-live-wizard/release/Ableton Live Wizard-darwin-arm64/Ableton Live Wizard.app`

## Recommended approach

Keep the current custom offline packaging flow and add signing/notarization scripts on top of it.

Do not switch to Xcode, Electron Forge, or electron-builder just for this step.

## Required prerequisites

- Apple Developer Program membership
- Xcode installed
- `Developer ID Application` certificate installed in Keychain
- Apple `Team ID`
- notarization credentials

Recommended local auth strategy:

- `xcrun notarytool store-credentials ...`
- keep credentials in Keychain

Possible CI auth strategy later:

- App Store Connect API key

## Planned repo additions

- `build/macos/entitlements.plist`
- `build/macos/entitlements.inherit.plist`
- `scripts/sign-macos-app.mjs`
- `scripts/notarize-macos-app.mjs`
- `scripts/verify-macos-app.mjs`
- npm scripts:
  - `sign:mac`
  - `notarize:mac`
  - `release:mac`

## Planned flow

1. Package the app:
   - `npm run package:mac`
2. Sign the packaged `.app` and nested helpers/frameworks with:
   - `codesign`
   - Hardened Runtime enabled
   - timestamp enabled
3. Zip the `.app`
4. Submit with:
   - `xcrun notarytool submit ... --wait`
5. Staple the ticket:
   - `xcrun stapler staple`
6. Verify:
   - `codesign --verify --deep --strict`
   - `spctl --assess --type execute -vvv`
   - `xcrun stapler validate`

## Electron-specific note

For current Electron versions, start with `allow-jit` in entitlements.

Do not add `allow-unsigned-executable-memory` by default unless runtime behavior proves it is required.

## Known blocker

Actual signing/notarization cannot be completed without local Apple credentials and certificates on this Mac.

## Reference sources

- Apple Developer ID:
  - https://developer.apple.com/developer-id/
- Apple notarization workflow:
  - https://developer.apple.com/documentation/security/customizing-the-notarization-workflow
- Electron code signing docs:
  - https://www.electronjs.org/docs/latest/tutorial/code-signing
- Electron notarization package docs:
  - https://packages.electronjs.org/notarize/main/index.html
