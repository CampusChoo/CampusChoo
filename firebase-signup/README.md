# Firebase Sign-Up

Standalone vanilla HTML/JS sign-up form using Firebase Authentication (email/password) and Firestore.

## Files

| File | Purpose |
|---|---|
| `index.html` | Form markup (Name, Email, Phone, Password) |
| `styles.css` | Styling |
| `app.js` | Validation, Firebase Auth + Firestore logic |
| `firebase-config.js` | **You fill this in** — your Firebase project keys |

## Setup (5 minutes)

### 1. Create a Firebase project
- Go to https://console.firebase.google.com
- Click **Add project**, name it, accept defaults

### 2. Enable Email/Password authentication
- In your project → **Build** → **Authentication** → **Get started**
- Under **Sign-in method**, click **Email/Password**, toggle **Enable**, save

### 3. Create the Firestore database
- **Build** → **Firestore Database** → **Create database**
- Start in **test mode** (fine for local development; tighten rules before production)
- Pick a location closest to your users

### 4. Register a Web App and copy the config
- Project home → click the **Web** icon `</>` to add a web app
- Give it a nickname (e.g. "Sign-Up Demo"), skip Hosting
- Firebase shows a config object — copy it
- Open `firebase-config.js` and replace the placeholders with your real values

### 5. Tighten Firestore security rules (recommended)
In **Firestore → Rules**, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow create: if request.auth != null && request.auth.uid == userId;
      allow read, update: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

This guarantees a signed-in user can only read/write **their own** profile document.

### 6. Authorize your local domain
- **Authentication → Settings → Authorized domains**
- `localhost` is added by default — that's all you need for local testing

## Run

Firebase auth needs an `http://` or `https://` origin (it does **not** work from `file://`).

Quickest way to serve locally:

```bash
# From inside the firebase-signup/ folder:

# If you have Python:
python -m http.server 5500

# Or with Node:
npx serve .

# Or with PHP:
php -S localhost:5500
```

Then open http://localhost:5500 in your browser.

## What happens on submit

1. Client-side validation runs (name length, email format, phone digits, password ≥ 6 chars)
2. `createUserWithEmailAndPassword(auth, email, password)` — creates the auth user
3. `updateProfile(user, { displayName })` — sets the auth display name
4. `setDoc(doc(db, "users", uid), { name, email, phone, createdAt })` — writes to Firestore
5. Success message shown / form resets

If anything fails, Firebase error codes are mapped to friendly messages (e.g. `auth/email-already-in-use` → "An account with this email already exists.")

## Common issues

| Symptom | Fix |
|---|---|
| "Email/Password sign-up is disabled" error | Step 2 above — enable it in the Firebase console |
| Form does nothing on submit, console shows CORS / fetch errors | You opened `index.html` via `file://` — serve it over `http://` (see Run section) |
| `auth/api-key-not-valid` | Check `firebase-config.js` — values were copied incorrectly |
| Firestore writes fail with `Missing or insufficient permissions` | Apply the security rules from step 5, or temporarily run in test mode |
