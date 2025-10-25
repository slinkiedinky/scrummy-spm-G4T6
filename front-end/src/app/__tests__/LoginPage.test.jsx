/**
 * @file LoginPage.test.jsx
 * Run with:  npx jest  or  npm test
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "../page.jsx"; // adjust path
import { useRouter } from "next/navigation";

// ─── Mocks ───────────────────────────────────────────────────────────
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

// Mock all firebase modules used in the page
jest.mock("firebase/auth", () => ({
  setPersistence: jest.fn(),
  browserSessionPersistence: {},
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  updateProfile: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  setDoc: jest.fn(),
}));

jest.mock("@/lib/firebase", () => ({
  auth: {},
  db: {},
}));

// ─── Test Setup ───────────────────────────────────────────────────────
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from "firebase/auth";

describe("LoginPage", () => {
  const mockPush = jest.fn();
  const mockAlert = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useRouter.mockReturnValue({ push: mockPush });

    // Mock window.alert
    global.alert = mockAlert;

    // Mock onAuthStateChanged to simulate no user logged in
    // ALWAYS return a function for cleanup
    onAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(null); // means "no user"
      return jest.fn(); // return mock unsubscribe function
    });
  });

  afterEach(() => {
    // Clean up alert mock
    delete global.alert;
  });

  // ── 1. Redirect check ───────────────────────────────────────────────
  test("redirects to /tasks if user already signed in", () => {
    onAuthStateChanged.mockImplementation((_auth, cb) => {
      cb({ uid: "user1" }); // simulate signed-in user
      return jest.fn(); // return mock unsubscribe function
    });

    render(<LoginPage />);
    expect(mockPush).toHaveBeenCalledWith("/tasks");
  });

  test("renders login form when no user", async () => {
    onAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(null);
      return jest.fn(); // return mock unsubscribe function
    });
    render(<LoginPage />);
    expect(await screen.findByText(/Sign in to your account/i)).toBeInTheDocument();
  });

  // ── 2. Validation tests ─────────────────────────────────────────────
  test("shows error for invalid email format", async () => {
    onAuthStateChanged.mockImplementation((_a, cb) => {
      cb(null);
      return jest.fn();
    });
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: "invalid" } });
    // Use getByRole with name to be more specific
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));
    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
  });

  // ── 3. Successful login ─────────────────────────────────────────────
  test("calls firebase login and redirects on success", async () => {
    onAuthStateChanged.mockImplementation((_a, cb) => {
      cb(null);
      return jest.fn();
    });
    signInWithEmailAndPassword.mockResolvedValue({ user: { uid: "abc" } });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => expect(signInWithEmailAndPassword).toHaveBeenCalled());
    expect(mockPush).toHaveBeenCalledWith("/tasks");
  });

  // ── 4. Failed login ─────────────────────────────────────────────────
  test("displays Invalid credentials on auth/wrong-password", async () => {
    onAuthStateChanged.mockImplementation((_a, cb) => {
      cb(null);
      return jest.fn();
    });
    signInWithEmailAndPassword.mockRejectedValue({ code: "auth/wrong-password" });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "bad" } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    expect(await screen.findByText(/Invalid credentials/i)).toBeInTheDocument();
  });

  // ── 5. Forgot password ──────────────────────────────────────────────
  test("requires email before sending reset", async () => {
    onAuthStateChanged.mockImplementation((_a, cb) => {
      cb(null);
      return jest.fn();
    });
    render(<LoginPage />);
    fireEvent.click(screen.getByText(/Forgot your password/i));
    expect(await screen.findByText(/enter your email address first/i)).toBeInTheDocument();
  });

  test("calls sendPasswordResetEmail with valid email", async () => {
    onAuthStateChanged.mockImplementation((_a, cb) => {
      cb(null);
      return jest.fn();
    });
    sendPasswordResetEmail.mockResolvedValue();

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByText(/Forgot your password/i));

    await waitFor(() => expect(sendPasswordResetEmail).toHaveBeenCalledWith(expect.any(Object), "a@b.com"));
    expect(mockAlert).toHaveBeenCalledWith('Password reset email sent! Check your inbox.');
  });

  // ── 6. Sign-up flow ─────────────────────────────────────────────────
  test("switches to sign-up mode when clicking Sign up here", () => {
    onAuthStateChanged.mockImplementation((_a, cb) => {
      cb(null);
      return jest.fn();
    });
    render(<LoginPage />);
    fireEvent.click(screen.getByText(/Sign up here/i));
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
  });

  test("creates account successfully and redirects", async () => {
    onAuthStateChanged.mockImplementation((_a, cb) => {
      cb(null);
      return jest.fn();
    });
    createUserWithEmailAndPassword.mockResolvedValue({ user: { uid: "newUser" } });

    render(<LoginPage />);
    fireEvent.click(screen.getByText(/Sign up here/i));
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "John Doe" } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "abcdef" } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: "abcdef" } });

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    await waitFor(() => expect(createUserWithEmailAndPassword).toHaveBeenCalled());
    expect(mockPush).toHaveBeenCalledWith("/tasks");
  });

  test("shows error when email already in use", async () => {
    onAuthStateChanged.mockImplementation((_a, cb) => {
      cb(null);
      return jest.fn();
    });
    createUserWithEmailAndPassword.mockRejectedValue({ code: "auth/email-already-in-use" });

    render(<LoginPage />);
    fireEvent.click(screen.getByText(/Sign up here/i));
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "John Doe" } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "abcdef" } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: "abcdef" } });
    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(await screen.findByText(/Email is already in use/i)).toBeInTheDocument();
  });
});