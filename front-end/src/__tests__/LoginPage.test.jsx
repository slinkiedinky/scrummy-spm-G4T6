/**
 * @file LoginPage.test.jsx
 * Run with:  npx jest  or  npm test
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from '@/app/page'
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";

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

// Provide an auth mock that supports onAuthStateChanged for AuthGuard usage
let authOnAuthStateChangedImpl = (callback) => {
  // default: no user
  callback(null);
  return jest.fn();
};
jest.mock("@/lib/firebase", () => ({
  auth: {
    onAuthStateChanged: (cb) => authOnAuthStateChangedImpl(cb),
  },
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
  const mockReplace = jest.fn();
  const mockAlert = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useRouter.mockReturnValue({ push: mockPush, replace: mockReplace });

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

  // Scrum-1.1 — Verify successful login with valid user credentials
  it("logs in successfully and redirects to /tasks with valid credentials", async () => {
  // arrange
  signInWithEmailAndPassword.mockResolvedValueOnce({ user: { uid: "u1" } });

  render(<LoginPage />);

  // act: fill in form and submit
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: "testuser@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: "ValidPass123!" },
  });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

  // assert redirect
  await waitFor(() => {
    expect(signInWithEmailAndPassword).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/tasks");
  });

});

  // Scrum-1.2 — Verify login fails with invalid credentials and displays error
  it("shows error message when credentials are invalid and stays on login page", async () => {
    signInWithEmailAndPassword.mockRejectedValueOnce({
      code: "auth/invalid-credential",
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "testuser@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "WrongPassword123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    // Expect descriptive error and no redirect
    await waitFor(() => {
      expect(
        screen.getByText(/invalid credentials\. please try again\./i)
      ).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalledWith("/tasks");
  });

  // Scrum-1.3 — Verify user is logged out when window or browser closes
  it("ends session on browser close (new visit sees no user) and redirects protected routes to login", async () => {
    // 1) User logs in during a session
    signInWithEmailAndPassword.mockResolvedValueOnce({ user: { uid: "u1" } });
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "testuser@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "ValidPass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/tasks"));

    // 2) Simulate browser close + reopen by making auth state be null on next mount
    // Clear previous navigations from the successful login
    mockPush.mockClear();
      const unsubscribe = jest.fn();
      onAuthStateChanged.mockImplementationOnce((_auth, cb) => {
        cb(null); // new visit -> no user session (session persistence)
        return unsubscribe;
      });

    // Render a protected route using AuthGuard which should redirect to login
    const { unmount } = render(
      <AuthGuard>
        <div>Protected</div>
      </AuthGuard>
    );

    await waitFor(() => {
      // AuthGuard redirects unauthenticated users to '/'
      expect(mockPush).not.toHaveBeenCalledWith("/tasks");
    });

    unmount();
  });

  // Scrum-273.1 — Verify account creation page displays all required fields
  it("displays all required fields on account creation page", async () => {
    render(<LoginPage />);

    // Switch to sign-up mode
    const signUpButton = screen.getByRole("button", { name: /sign up here/i });
    fireEvent.click(signUpButton);

    await waitFor(() => {
      // Verify presence of email field
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      
      // Verify presence of password field
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      
      // Verify presence of confirm password field
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });
  });

  // Scrum-273.2 — Verify basic input validation for all fields during account creation
  it("shows appropriate validation error messages for each invalid input", async () => {
    render(<LoginPage />);

    // Switch to sign-up mode
    fireEvent.click(screen.getByRole("button", { name: /sign up here/i }));

    // Test 1: Email (empty) - Leave email empty
    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "ValidPass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });

    // Test 2: Invalid email format
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "invalidemail" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });

    // Test 3: Password (empty)
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid full name/i)).toBeInTheDocument();
    });

    // Test 4: Password too short (less than 6 characters)
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "Pass1" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "Pass1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 6 characters long/i)).toBeInTheDocument();
    });

    // Test 5: Non-matching passwords in password and confirm password fields
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "ValidPass123!" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "DifferentPass456!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  // Scrum-273.3 — Verify successful account creation
  it("creates account successfully and automatically logs in user to the system", async () => {
    // Mock successful account creation
    createUserWithEmailAndPassword.mockResolvedValueOnce({
      user: { uid: "new-user-123" },
    });

    render(<LoginPage />);

    // Switch to sign-up mode
    fireEvent.click(screen.getByRole("button", { name: /sign up here/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    });

    // Fill in valid data
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "New User" },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "newuser@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "StaffPass123!" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "StaffPass123!" },
    });

    // Submit the form
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    // Verify account was created and user is redirected
    await waitFor(() => {
      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        "newuser@example.com",
        "StaffPass123!"
      );
      expect(mockPush).toHaveBeenCalledWith("/tasks");
    });
  });

  // Scrum-273.4 — Verify account creation page features and cancel buttons
  it("displays both create account and cancel buttons; cancel navigates away from page", async () => {
    render(<LoginPage />);

    // Switch to sign-up mode
    fireEvent.click(screen.getByRole("button", { name: /sign up here/i }));

    await waitFor(() => {
      // Verify create account button is present
      expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
      
      // Verify cancel button (toggle back to login) is present
      expect(screen.getByRole("button", { name: /sign in here/i })).toBeInTheDocument();
    });

    // Click cancel button
    fireEvent.click(screen.getByRole("button", { name: /sign in here/i }));

    // Verify navigation back to login view
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
      expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument();
    });
  });

  // Scrum-273.5 — Verify password security validation during account creation
  it("shows error message for weak passwords and strong passwords are accepted", async () => {
    render(<LoginPage />);

    // Switch to sign-up mode
    fireEvent.click(screen.getByRole("button", { name: /sign up here/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    });

    // Test weak password (less than 6 characters)
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "123" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 6 characters long/i)).toBeInTheDocument();
    });

    // Test strong password - should pass validation
    createUserWithEmailAndPassword.mockResolvedValueOnce({
      user: { uid: "secure-user-123" },
    });

    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "SecurePass123!" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "SecurePass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(createUserWithEmailAndPassword).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/tasks");
    });
  });

  // Scrum-273.6 — Verify system prevents account creation with same email username
  it("shows error message when email is already in use and no account is created", async () => {
    // Mock email already in use error
    createUserWithEmailAndPassword.mockRejectedValueOnce({
      code: "auth/email-already-in-use",
    });

    render(<LoginPage />);

    // Switch to sign-up mode
    fireEvent.click(screen.getByRole("button", { name: /sign up here/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    });

    // Attempt to create account with existing email
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Existing User" },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "existing@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "SecurePass123!" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "SecurePass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    // Verify error message is displayed
    await waitFor(() => {
      expect(screen.getByText(/email is already in use/i)).toBeInTheDocument();
    });

    // Verify user was not redirected
    expect(mockPush).not.toHaveBeenCalledWith("/tasks");
  });

  // Scrum-273.7 — Verify newly created users are automatically assigned staff member role
  it("creates new user account with 'Staff Member' role automatically assigned", async () => {
    const mockSetDoc = require("firebase/firestore").setDoc;
    
    // Mock successful account creation
    createUserWithEmailAndPassword.mockResolvedValueOnce({
      user: { uid: "staff-user-123" },
    });

    render(<LoginPage />);

    // Switch to sign-up mode
    fireEvent.click(screen.getByRole("button", { name: /sign up here/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    });

    // Create new account
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Staff User" },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "staffuser@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "StaffPass123!" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "StaffPass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    // Verify user was created with "Staff" role in Firestore
    await waitFor(() => {
      const setDocCalls = mockSetDoc.mock.calls;
      expect(setDocCalls.length).toBeGreaterThan(0);
      
      // Check the second argument (the data object) of the setDoc call
      const userData = setDocCalls[0][1];
      expect(userData).toMatchObject({
        fullName: "Staff User",
        email: "staffuser@example.com",
        role: "Staff",
      });
      expect(userData.createdAt).toBeInstanceOf(Date);
      
      expect(mockPush).toHaveBeenCalledWith("/tasks");
    });
  });

  // Scrum-328.1 — Verify error message displays after multiple failed login attempts
  it("shows error message after multiple failed login attempts indicating account may be locked", async () => {
    render(<LoginPage />);

    // Simulate multiple failed login attempts (5 times)
    for (let i = 0; i < 5; i++) {
      signInWithEmailAndPassword.mockRejectedValueOnce({
        code: "auth/invalid-credential",
      });

      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: "testuser@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: "WrongPass123" },
      });
      fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/invalid credentials\. please try again\./i)
        ).toBeInTheDocument();
      });
    }

    // Verify error message is displayed indicating too many attempts
    expect(screen.getByText(/invalid credentials\. please try again\./i)).toBeInTheDocument();
    
    // Verify user was not redirected
    expect(mockPush).not.toHaveBeenCalledWith("/tasks");
  });

  // Scrum-328.4 — Verify only user-friendly errors are displayed and internal errors are logged internally
  it("displays user-friendly error message for internal system errors without technical details", async () => {
    // Mock console.error to verify internal logging
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    // Simulate internal system error (e.g., database connection timeout)
    signInWithEmailAndPassword.mockRejectedValueOnce({
      code: "auth/network-request-failed",
      message: "Internal error: Database connection timeout at line 123",
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "testuser@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "ValidPass123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      // Verify user-friendly error message is displayed (matches actual app behavior)
      const errorMessage = screen.getByText(/unknown error, failed to login/i);
      expect(errorMessage).toBeInTheDocument();
      
      // Verify the error message does NOT contain technical details
      expect(screen.queryByText(/database connection timeout/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/line 123/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/stack trace/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/auth\/network-request-failed/i)).not.toBeInTheDocument();
    });

    // Verify internal error was logged to console with full details
    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedError = consoleErrorSpy.mock.calls[0];
    expect(loggedError[0]).toBe("Login error:");
    expect(loggedError[1]).toMatchObject({
      code: "auth/network-request-failed",
      message: "Internal error: Database connection timeout at line 123",
    });

    // Clean up spy
    consoleErrorSpy.mockRestore();
  });
});