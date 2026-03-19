# TaskFlow — How to Deploy as a Real App

This guide covers three paths: running it locally, hosting it as a web app
(with Add to Home Screen on your phone), and packaging it as a real native app.

---

## What you'll need first

- **Node.js** — download from nodejs.org, install the LTS version
- **VS Code** — download from code.visualstudio.com (or any editor)
- **Git** — download from git-scm.com
- A free **GitHub** account — github.com
- A free **Vercel** account — vercel.com (sign up with GitHub)

---

## PART 1 — Run it on your computer

### Step 1: Set up the project folder

The project files you downloaded are already set up correctly.
Your folder structure should look like this:

```
taskflow-project/
├── index.html
├── vite.config.js
├── package.json
├── .gitignore
├── public/
│   ├── manifest.json
│   └── icon.svg
└── src/
    ├── main.jsx
    └── App.jsx
```

### Step 2: Install dependencies

Open a terminal (on Mac: Terminal app, on Windows: PowerShell or CMD).
Navigate to the folder and run:

```bash
cd taskflow-project
npm install
```

This downloads React and Vite. Takes about 30 seconds.

### Step 3: Start the dev server

```bash
npm run dev
```

It'll print something like:
  Local:   http://localhost:5173/

Open that URL in your browser. TaskFlow is running! Any changes you make
to App.jsx will instantly hot-reload in the browser.

To stop it: press Ctrl+C in the terminal.

---

## PART 2 — Host it online (free, forever)

### Step 1: Put your project on GitHub

In the taskflow-project folder, run:

```bash
git init
git add .
git commit -m "Initial TaskFlow commit"
```

Then go to github.com, click the + button → New repository.
Name it "taskflow", make it Public, click Create Repository.

GitHub will show you commands — copy and run the ones under
"push an existing repository":

```bash
git remote add origin https://github.com/YOURUSERNAME/taskflow.git
git branch -M main
git push -u origin main
```

Your code is now on GitHub.

### Step 2: Deploy to Vercel

1. Go to vercel.com and click "Add New Project"
2. Click "Import Git Repository" and connect your GitHub account
3. Select your "taskflow" repository
4. Leave all settings as default — Vercel auto-detects Vite
5. Click Deploy

In about 60 seconds you'll get a live URL like:
  https://taskflow-abc123.vercel.app

That's your app, live on the internet, for free. Every time you push
changes to GitHub, Vercel automatically re-deploys.

### Step 3: Install it on your phone (PWA)

On iPhone (Safari only — Chrome won't work for this):
1. Open your Vercel URL in Safari
2. Tap the Share button (box with arrow pointing up)
3. Scroll down and tap "Add to Home Screen"
4. Name it "TaskFlow" and tap Add

On Android (Chrome):
1. Open your Vercel URL in Chrome
2. Tap the three dots menu → "Add to Home Screen"
3. Or Chrome will show a banner automatically after a few seconds

You now have a TaskFlow icon on your home screen that opens full-screen
with no browser chrome, just like a native app. Data saves to the phone.

---

## PART 3 — Package as a real native app (iOS/Android)

This uses Capacitor, which wraps your web app in a native shell.

### Prerequisites

For iOS: You need a Mac with Xcode installed (free from App Store).
  Xcode is large (~15GB) so start this download early.
  You also need an Apple Developer account ($99/year) to publish to App Store.
  You can sideload to your own iPhone for free with just Xcode.

For Android: Works on any OS. Android Studio is free. Google Play
  has a one-time $25 registration fee to publish.

### Step 1: Build the app

```bash
npm run build
```

This creates a `dist/` folder with your compiled app.

### Step 2: Install Capacitor

```bash
npm install @capacitor/core @capacitor/cli
npx cap init TaskFlow com.yourname.taskflow --web-dir dist
```

For iOS:
```bash
npm install @capacitor/ios
npx cap add ios
```

For Android:
```bash
npm install @capacitor/android
npx cap add android
```

### Step 3: Sync your built app into the native project

Every time you make changes and rebuild, run:

```bash
npm run build
npx cap sync
```

### Step 4: Open in Xcode or Android Studio

For iOS:
```bash
npx cap open ios
```
Xcode opens. Connect your iPhone, select it as the target, hit the Play button.
Your app installs on your phone.

For Android:
```bash
npx cap open android
```
Android Studio opens. Connect your Android phone (enable USB debugging
in Developer Options), click the Play button. App installs on your phone.

### Step 5: Publish to App Store / Play Store

**Google Play Store:**
In Android Studio: Build → Generate Signed Bundle/APK → Android App Bundle
Upload the .aab file to play.google.com/console

**Apple App Store:**
In Xcode: Product → Archive → Distribute App → App Store Connect
Requires an Apple Developer account and filling out App Store metadata
(screenshots, description, etc.) at appstoreconnect.apple.com

---

## Giving the app a real icon

Right now the icon is a simple SVG. For a proper icon:

1. Create a 1024x1024 PNG image (use Canva, Figma, or any image editor)
   — dark background (#0F0F14), your logo or initials in the center
2. Go to appicon.co (free)
3. Upload your 1024x1024 PNG
4. Download the generated icon pack
5. Replace the icons in:
   - ios/App/App/Assets.xcassets/AppIcon.appiconset/ (for iOS)
   - android/app/src/main/res/ (for Android, multiple sizes)
   - public/ (for the web PWA version)

---

## Quick reference — commands you'll use most

```bash
npm run dev          # Start local dev server
npm run build        # Build for production
npx cap sync         # Sync built files to iOS/Android
npx cap open ios     # Open iOS project in Xcode
npx cap open android # Open Android project in Android Studio
git add . && git commit -m "update" && git push  # Deploy to Vercel
```

---

## Troubleshooting

**"npm: command not found"**
→ Node.js isn't installed. Go to nodejs.org and install it.

**App shows blank screen on phone**
→ Open Safari/Chrome dev tools and check the console for errors.
→ Most common cause: a JS error in the app itself.

**Capacitor sync fails**
→ Make sure you ran `npm run build` first. Capacitor needs the dist/ folder.

**Can't install on iPhone without paying $99**
→ You can still run it on your own device for free via Xcode.
→ Go to Xcode → Preferences → Accounts → add your Apple ID (free).
→ Select your device, change the Team to your personal team, hit Run.
→ It installs for 7 days before needing to be re-signed (annoying but free).

**Vercel deploy fails**
→ Check the build log on Vercel's dashboard. 99% of the time it's a
   missing dependency — add it to package.json and redeploy.

---

## Summary — Recommended path for you

1. Run `npm install` and `npm run dev` to see it locally (5 min)
2. Push to GitHub and deploy to Vercel (15 min)
3. Add to Home Screen on your phone from Vercel URL (2 min)
4. If you want a real app icon on the App Store later, set up Capacitor

The PWA route (Steps 1-3) gets you 90% of the way to a "real app"
experience with basically zero extra work. Most users won't be able to
tell the difference between a PWA and a native app.
