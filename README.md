# 🔥 Firestudio - Open Source Firebase GUI Client

> A powerful, free, and open-source desktop application for managing Firebase - Firestore, Storage, and Authentication

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)](https://github.com/Flowdesktech/firestudio)
[![Firebase](https://img.shields.io/badge/Firebase-Complete-orange)](https://firebase.google.com/)
[![Electron](https://img.shields.io/badge/Electron-28-47848F)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB)](https://reactjs.org/)
[![CI](https://github.com/Flowdesktech/firestudio/actions/workflows/ci.yml/badge.svg)](https://github.com/Flowdesktech/firestudio/actions/workflows/ci.yml)

**Keywords**: Firebase GUI, Firebase Client, Firebase Admin, Firebase Desktop, Firestore GUI, Firebase Storage GUI, Firebase Auth GUI, Firebase Manager, Firebase Viewer, Firebase Browser, Firebase Editor, NoSQL GUI, Document Database Client, Firebase Desktop App, Firefoo Alternative, Free Firebase Client, Firestudio

## 🎯 What is Firestudio?

Firestudio is a **free and open-source desktop application** for managing your complete Firebase backend. Built with Electron, React, and Material-UI, it provides a powerful and intuitive interface for:

- 📊 **Firestore**: Browse, edit, query, and manage collections & documents
- ☁️ **Storage**: Upload, download, browse, and manage files in Firebase Storage
- 👥 **Authentication**: View, create, and manage Firebase Auth users
- 🔍 **Querying**: Use simple filters or JavaScript for advanced queries
- 📥 **Import/Export**: Bulk operations with JSON files
- 🎨 **Themes**: Dark/Light mode with customizable settings

Perfect for **Firebase developers**, **backend engineers**, **database administrators**, and anyone working with **Google Firebase**.

---

## 📸 Screenshots

### Add Firebase Project

![Add Project Dialog](screenshots/1.png)

### Firestore Table View (Dark Theme)

![Dark Theme Table View](screenshots/2.png)

### Settings Dialog (Light Theme)

![Light Theme with Settings](screenshots/3.png)

---

## ✨ Features

### 🔐 Multiple Authentication Methods

- **Service Account**: Connect using Firebase service account JSON files for full admin access
- **Google Sign-In**: OAuth-based authentication using your Google account

### 📊 Firestore Database Management

| Feature        | Description                                                     |
| -------------- | --------------------------------------------------------------- |
| **Table View** | Spreadsheet-like view with resizable columns and inline editing |
| **Tree View**  | Hierarchical view with Key/Value/Type columns                   |
| **JSON View**  | Raw JSON editor with save support                               |
| **Filtering**  | Filter documents by field values with multiple conditions       |
| **Sorting**    | Sort by any field, ascending or descending                      |
| **JS Query**   | Write JavaScript queries using Firebase Admin SDK syntax        |

### ☁️ Firebase Storage Management

- 📂 **Browse Files & Folders**: Navigate through your Storage bucket
- ⬆️ **Upload Files**: Drag & drop or select files to upload
- ⬇️ **Download Files**: Save files to your local machine
- 🔗 **Get Signed URLs**: Generate shareable URLs with custom expiration
- 🗑️ **Delete Files**: Remove files with confirmation
- 📁 **Create Folders**: Organize your storage structure
- 🎨 **File Type Icons**: Visual icons for images, videos, documents, etc.

### 👥 Firebase Authentication Management

- 📋 **User List**: View all Firebase Auth users with avatars and status
- ➕ **Create Users**: Add new users with email/password/display name
- 🔍 **Search Users**: Filter by email, display name, UID, or phone number
- ✅ **Enable/Disable**: Toggle user account status
- 🗑️ **Delete Users**: Remove users with confirmation
- 📄 **User Details**: View full user info including providers and metadata

### ⚡ Powerful Query Builder with Smart Autocomplete

```javascript
// Example JS Query
async function run() {
  const query = await db
    .collection('users')
    .where('status', '==', 'active')
    .where('age', '>=', 18)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();
  return query;
}
```

**Autocomplete Features:**

- 🔮 **Progressive Completions**: Type `db.c`, `db.co`, or `db.col` → suggests `db.collection('')`
- 📋 **Field Name Suggestions**: Your document fields auto-suggested in `.where()` and `.orderBy()`
- 📂 **Collection Name Suggestions**: All your collections appear in suggestions
- ⌨️ **Keyboard Navigation**: `Tab`/`Enter` to accept, `↑`/`↓` to navigate
- ↩️ **Undo/Redo Support**: `Ctrl+Z` to undo, `Ctrl+Y` to redo

### 🎨 Customizable Interface

- **Themes**: Dark mode, Light mode, or Auto (follows system)
- **Settings**: Configure default document limit, view type, and font size
- **Tabbed Interface**: Open multiple collections in separate tabs
- **Multi-Project**: Connect to multiple Firebase projects simultaneously

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18 or higher
- **pnpm** (`npm install -g pnpm`)
- A **Firebase project**

### Installation

#### Download Pre-built App (Recommended)

Download the latest release for your platform from [GitHub Releases](https://github.com/Flowdesktech/firestudio/releases).

| Platform | Download                          |
| -------- | --------------------------------- |
| Windows  | `.exe` installer or portable      |
| macOS    | `.dmg` (Intel & Apple Silicon)    |
| Linux    | `.AppImage`, `.deb`, or `.tar.gz` |

#### macOS Users: First Launch

Since the app is not signed with an Apple Developer certificate, macOS will show a security warning on first launch.

**To open the app:**

1. Try to open the app (it will show a warning)
2. Go to **System Settings** → **Privacy & Security**
3. Scroll down to see "Firestudio was blocked..."
4. Click **"Open Anyway"**

Or run in Terminal:

```bash
xattr -cr /Applications/Firestudio.app
```

#### Build from Source

```bash
# Clone the repository
git clone https://github.com/Flowdesktech/firestudio.git
cd firestudio

# Install dependencies
pnpm install

# Start the application
pnpm run dev
```

### Connecting to Your Firebase Project

#### Method 1: Service Account (Recommended)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project → ⚙️ Project Settings → Service Accounts
3. Click **"Generate new private key"**
4. Save the JSON file securely
5. In Firestudio, click **"Add Project"** → **Service Account** tab
6. Browse and select your JSON file

#### Method 2: Google Sign-In

See detailed OAuth setup guide in the [Google Sign-In Setup](#google-sign-in-setup) section.

---

## 🛠️ Tech Stack

| Technology                                                         | Purpose                       |
| ------------------------------------------------------------------ | ----------------------------- |
| [Electron](https://www.electronjs.org/)                            | Desktop application framework |
| [React 18](https://reactjs.org/)                                   | User interface                |
| [Material-UI 5](https://mui.com/)                                  | Component library             |
| [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup) | Firebase operations           |
| [Vite](https://vitejs.dev/)                                        | Build tool                    |

---

## 📖 Available Commands

### Development

| Command             | Description                                 |
| ------------------- | ------------------------------------------- |
| `pnpm run dev`      | Start the full Electron app with hot reload |
| `pnpm run dev:vite` | Start browser-only mode (limited features)  |
| `pnpm run build`    | Build the React app for production          |

### Building Releases

| Command                | Description                                        |
| ---------------------- | -------------------------------------------------- |
| `pnpm run build:win`   | Build for Windows (`.exe` installer + portable)    |
| `pnpm run build:mac`   | Build for macOS (`.dmg` + `.zip`)                  |
| `pnpm run build:linux` | Build for Linux (`.AppImage` + `.deb` + `.tar.gz`) |
| `pnpm run build:all`   | Build for all platforms                            |

### Utilities

| Command                  | Description                   |
| ------------------------ | ----------------------------- |
| `pnpm run generate-icon` | Regenerate app icons from SVG |

---

## 📦 Building & Releasing

### Build for Your Platform

```bash
# Windows
pnpm run build:win

# macOS
pnpm run build:mac

# Linux
pnpm run build:linux

# All platforms (requires cross-compilation setup)
pnpm run build:all
```

**Output files are saved to the `release/` directory:**

| Platform | Files Generated                                                                             |
| -------- | ------------------------------------------------------------------------------------------- |
| Windows  | `Firestudio-1.0.0-Windows-x64.exe` (installer), `Firestudio-1.0.0-Windows-x64-portable.exe` |
| macOS    | `Firestudio-1.0.0-macOS-x64.dmg`, `Firestudio-1.0.0-macOS-arm64.dmg` (Apple Silicon)        |
| Linux    | `Firestudio-1.0.0-Linux-x64.AppImage`, `Firestudio-1.0.0-Linux-x64.deb`                     |

### Publishing to GitHub Releases

1. **Set up GitHub Token:**

   ```bash
   # Set environment variable
   export GH_TOKEN=your_github_personal_access_token
   ```

2. **Update version in `package.json`:**

   ```json
   "version": "1.1.0"
   ```

3. **Create a Git tag:**

   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```

4. **Build and publish:**
   ```bash
   pnpm run release
   ```

### Cross-Platform Building Notes

- **Windows → macOS**: Not possible without a Mac (code signing requirements)
- **Windows → Linux**: Works with WSL or Docker
- **macOS → Windows**: Works with Wine
- **macOS → Linux**: Works natively
- **Linux → Windows**: Works with Wine
- **Linux → macOS**: Not possible without a Mac

For cross-platform releases, consider using **GitHub Actions** for CI/CD

---

## 🔒 Security

See [SECURITY.md](SECURITY.md) for security policies and best practices.

⚠️ **Important**: Never commit service account JSON files to version control!

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. 🍴 Fork the repository
2. 🌿 Create a feature branch (`git checkout -b feature/amazing-feature`)
3. 💾 Commit your changes (`git commit -m 'Add amazing feature'`)
4. 📤 Push to the branch (`git push origin feature/amazing-feature`)
5. 🔃 Open a Pull Request

### ✅ Required Checks (Branch Protection)

To ensure code quality, enable branch protection on `main` and require the CI checks to pass on every PR:

1. Go to **Settings → Branches → Add rule**
2. Branch name pattern: `main`
3. Enable **Require a pull request before merging**
4. Enable **Require status checks to pass before merging**
5. Select **CI / checks**
6. (Optional) Enable **Require branches to be up to date before merging**

This matches the local pre-commit hooks (`lint`, `format:check`, `typecheck`) and keeps PRs consistent.

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Inspired by [Firefoo](https://firefoo.app)
- Built with [Electron](https://www.electronjs.org/)
- UI powered by [Material-UI](https://mui.com/)
- Firebase SDK by [Google](https://firebase.google.com/)

---

## ⚠️ Disclaimer

This is an **independent open-source project** and is not affiliated with, endorsed by, or connected to Firefoo or Firebase/Google in any way. "Firebase" and "Firestore" are trademarks of Google LLC.

---

## 📧 Support

Need help or have questions?

- **Email**: [contact@flowdesk.tech](mailto:contact@flowdesk.tech)
- **Help Menu**: In the app, go to **Help > Contact Support**

---

**Made with ❤️ by [Flowdesk](mailto:contact@flowdesk.tech)**

_A free, powerful Firebase GUI for Firestore, Storage, and Authentication_
