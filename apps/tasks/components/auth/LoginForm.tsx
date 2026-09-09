"use client";

import { useState, type FormEvent } from "react";
import {
  Button,
  Card,
  FieldError,
  Heading,
  IconButton,
  Input,
  Tooltip,
} from "@ryanmeetup/ui";
import { FiEye, FiEyeOff } from "react-icons/fi";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { InstanceWordmark, ThemeToggle } from "@/components/global";

export function LoginForm({ notice = "" }: { notice?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(notice);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missingEmail = !email.trim();
    const missingPassword = !password;
    setEmailError(missingEmail);
    setPasswordError(missingPassword);
    if (missingEmail || missingPassword) {
      setMessage(
        missingEmail && missingPassword
          ? "Error: username and password are required"
          : missingEmail
            ? "Error: username is required"
            : "Error: password is required",
      );
      return;
    }
    setLoading(true);
    setMessage("");
    const supabase = createClient();
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      setLoading(false);
      setEmailError(true);
      setPasswordError(true);
      setMessage("Error: username or password is incorrect");
      return;
    }
    // A document load, not `router.push`. Everything this page prefetched was
    // answered for a signed-out visitor, so the router cached `/` as a redirect
    // back here; replaying that after signing in bounces the two routes off
    // each other for as long as the tab is open, painting nothing but the
    // footer. The client-side cache cannot be told that the session changed
    // under it, so the sign-in leaves it behind entirely. `replace` keeps this
    // form out of history, where going back would only redirect forward again.
    // The form stays in its loading state until the workspace paints.
    window.location.replace("/");
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="fixed right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-lg" size="lg">
        <div className="mb-8">
          <Heading
            size="h1"
            className="mb-6 whitespace-nowrap text-center text-3xl uppercase tracking-[0.08em] sm:text-5xl"
          >
            <InstanceWordmark />
          </Heading>
        </div>
        <form className="space-y-5" onSubmit={submit} noValidate>
          <Input
            label="Username"
            name="email"
            type="email"
            required
            value={email}
            error={emailError}
            onChange={(event) => {
              setEmail(event.target.value);
              setEmailError(false);
              setMessage("");
            }}
            placeholder="you@example.com"
          />
          <Input
            label="Password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            value={password}
            error={passwordError}
            onChange={(event) => {
              setPassword(event.target.value);
              setPasswordError(false);
              setMessage("");
            }}
            placeholder="Enter your password"
            trailingAction={
              <Tooltip
                content={showPassword ? "Hide password" : "Show password"}
                placement="left"
              >
                <IconButton
                  tooltip={false}
                  label={showPassword ? "Hide password" : "Show password"}
                  variant="plain"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <FiEyeOff aria-hidden />
                  ) : (
                    <FiEye aria-hidden />
                  )}
                </IconButton>
              </Tooltip>
            }
          />
          <div className="-mt-2 flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm font-semibold text-black/65 underline-offset-4 hover:text-black hover:underline focus:outline-none focus:ring-2 focus:ring-black/30 dark:text-white/65 dark:hover:text-white dark:focus:ring-white/30"
            >
              Forgot password?
            </Link>
          </div>
          <FieldError>{message}</FieldError>
          <Button
            type="submit"
            size="md"
            fullWidth
            loading={loading}
            loadingText="Signing in..."
          >
            Sign in
          </Button>
        </form>
      </Card>
    </main>
  );
}
