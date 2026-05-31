// ─── Firebase imports (Firebase JS SDK v10, modular, via CDN) ───────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

// ─── Init ────────────────────────────────────────────────────────────────────
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ─── DOM refs ────────────────────────────────────────────────────────────────
const form      = document.getElementById("signup-form");
const submitBtn = document.getElementById("submit-btn");
const status    = document.getElementById("form-status");

const fields = ["name", "email", "phone", "password"].reduce((acc, id) => {
  acc[id] = {
    input: document.getElementById(id),
    error: document.getElementById(`${id}-error`),
  };
  return acc;
}, {});

// ─── Validation ──────────────────────────────────────────────────────────────
function validate(values) {
  const errors = {};

  if (!values.name || values.name.trim().length < 2) {
    errors.name = "Please enter your full name.";
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(values.email)) {
    errors.email = "Enter a valid email address.";
  }

  // 10–15 digits, optional leading +; spaces and dashes allowed in input.
  const phoneDigits = values.phone.replace(/[\s-]/g, "");
  if (!/^\+?\d{10,15}$/.test(phoneDigits)) {
    errors.phone = "Enter a valid phone number (10–15 digits).";
  }

  if (!values.password || values.password.length < 6) {
    errors.password = "Password must be at least 6 characters.";
  }

  return errors;
}

function showErrors(errors) {
  for (const id of Object.keys(fields)) {
    const msg = errors[id] || "";
    fields[id].error.textContent = msg;
    fields[id].input.classList.toggle("invalid", Boolean(msg));
  }
}

// Map Firebase Auth error codes to user-friendly messages.
function friendlyAuthError(code) {
  const map = {
    "auth/email-already-in-use":  "An account with this email already exists.",
    "auth/invalid-email":         "That email address is invalid.",
    "auth/weak-password":         "Password is too weak (use at least 6 characters).",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
    "auth/operation-not-allowed": "Email/Password sign-up is disabled. Enable it in Firebase Console → Authentication → Sign-in method.",
    "auth/too-many-requests":     "Too many attempts. Please wait a moment and try again.",
  };
  return map[code] || "Could not create account. Please try again.";
}

// ─── Submit handler ──────────────────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const values = {
    name:     fields.name.input.value.trim(),
    email:    fields.email.input.value.trim(),
    phone:    fields.phone.input.value.trim(),
    password: fields.password.input.value,
  };

  // Client-side validation first
  const errors = validate(values);
  showErrors(errors);
  if (Object.keys(errors).length > 0) return;

  // Lock UI
  submitBtn.disabled  = true;
  submitBtn.textContent = "Creating account…";
  status.textContent  = "";
  status.className    = "form-status";

  try {
    // 1. Create the auth user
    const cred = await createUserWithEmailAndPassword(auth, values.email, values.password);
    const user = cred.user;

    // 2. Set their display name on the auth profile
    await updateProfile(user, { displayName: values.name });

    // 3. Mirror profile data to Firestore at /users/{uid}
    await setDoc(doc(db, "users", user.uid), {
      uid:       user.uid,
      name:      values.name,
      email:     values.email,
      phone:     values.phone,
      createdAt: serverTimestamp(),
    });

    status.className   = "form-status success";
    status.textContent = `✓ Welcome, ${values.name}! Your account is ready.`;
    form.reset();
    showErrors({});
  } catch (err) {
    console.error("[signup]", err);
    status.className   = "form-status error";
    status.textContent = friendlyAuthError(err && err.code);
  } finally {
    submitBtn.disabled  = false;
    submitBtn.textContent = "Create Account";
  }
});

// Live-clear field errors as the user fixes them.
for (const id of Object.keys(fields)) {
  fields[id].input.addEventListener("input", () => {
    if (fields[id].error.textContent) {
      fields[id].error.textContent = "";
      fields[id].input.classList.remove("invalid");
    }
  });
}
