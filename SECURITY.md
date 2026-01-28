# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of Firefoo Clone seriously. If you have discovered a security vulnerability, please report it responsibly.

### How to Report

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Email details to the project maintainers (or open a private security advisory on GitHub)
3. Include as much information as possible:
   - Type of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Resolution**: Depends on severity and complexity

## Security Best Practices

### Service Account Files

⚠️ **CRITICAL**: Service account JSON files provide full admin access to your Firebase project.

- **NEVER** commit service account files to version control
- **NEVER** share service account files publicly
- Store service account files in a secure location on your system
- Consider using environment variables for automated deployments
- Regularly rotate service account keys
- Use the principle of least privilege - create service accounts with minimal required permissions

### Recommended `.gitignore` entries:

```gitignore
# Service account files
*-firebase-adminsdk-*.json
serviceAccount*.json
firebase-credentials.json

# Environment files
.env
.env.local
.env.*.local

# Build outputs
dist/
dist-electron/
```

### Google OAuth Credentials

If using Google Sign-In:

- Keep `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` secure
- Never commit these to version control
- Use environment variables or secure secret management
- Restrict OAuth consent screen to necessary scopes
- Review authorized redirect URIs regularly

### Data Handling

1. **Sensitive Data**: Be cautious when viewing/exporting collections containing sensitive user data
2. **Export Files**: JSON exports may contain sensitive data - handle appropriately
3. **Clipboard**: Be aware that copying data places it in your system clipboard
4. **Logs**: The logs panel may display sensitive information during operations

### Network Security

- The application connects to Firebase/Google services over HTTPS
- Google OAuth uses localhost callback (port 8085) during sign-in
- No data is sent to third-party servers (except Firebase/Google APIs)

### Electron Security

This application follows Electron security best practices:

- `contextIsolation: true` - Renderer process is isolated from Node.js
- `nodeIntegration: false` - No direct Node.js access in renderer
- `preload script` - Controlled IPC bridge for specific operations
- No `remote` module usage

### Permissions

The application requires:

- **File System Access**: For reading service account JSON files and import/export
- **Network Access**: For connecting to Firebase services
- **Clipboard Access**: For copy functionality

### Local Storage

The application stores the following in local storage:

- Theme preference
- Default settings (document limit, view type, font size)
- UI preferences

No credentials or sensitive data are stored in local storage.

## Security Updates

Security patches will be released as soon as possible after a vulnerability is confirmed. Users should:

1. Watch the repository for releases
2. Update to the latest version promptly
3. Review the changelog for security-related updates

## Third-Party Dependencies

This project depends on several npm packages. We recommend:

- Running `npm audit` regularly to check for vulnerabilities
- Keeping dependencies updated
- Reviewing dependency changes before updating

### Key Dependencies

| Package | Purpose |
|---------|---------|
| `firebase-admin` | Firebase backend operations |
| `electron` | Desktop application framework |
| `react`, `react-dom` | UI framework |
| `@mui/material` | UI components |
| `node-fetch` | HTTP requests for OAuth |

## Compliance

Users are responsible for ensuring their use of this application complies with:

- Their organization's security policies
- Data protection regulations (GDPR, CCPA, etc.)
- Firebase Terms of Service
- Google Cloud Platform Terms of Service

## Disclaimer

This software is provided "as is" without warranty. The maintainers are not responsible for any data loss, security breaches, or other damages resulting from the use of this software.

---

Thank you for helping keep Firefoo Clone and its users safe!
