"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FiLogIn, FiLogOut, FiMessageSquare, FiPackage, FiRepeat, FiSettings, FiUser } from "react-icons/fi";
import { DropdownMenu, DropdownMenuButton, DropdownMenuItem, DropdownMenuItemLink, DropdownMenuItems, DropdownMenuSeparator, Tooltip, toast } from "@ryanmeetup/ui";
import type { CustomerAccountStatus } from "@/lib/customer-account/account-status";
import { customerSignedInNoticeCookie } from "@/lib/customer-account/notice";
import { reviewSignInUrl } from "@/lib/review-sign-in";
import { SignInDialog } from "./sign-in-dialog";

type MenuStatus = CustomerAccountStatus | { status: "loading" };

// Set before leaving for Shopify's logout, so the storefront it returns to
// can go straight on to a fresh sign-in.
const switchingKey = "store-switching-account";

function takeSwitching() {
  try {
    const switching = sessionStorage.getItem(switchingKey) === "1";
    sessionStorage.removeItem(switchingKey);
    return switching;
  } catch { return false; }
}

function takeSignedInNotice() {
  const present = document.cookie.split("; ").some((entry) => entry === `${customerSignedInNoticeCookie}=1`);
  if (present) document.cookie = `${customerSignedInNoticeCookie}=; Max-Age=0; Path=/; Secure; SameSite=Lax`;
  return present;
}

/** Shopify's account pages live under the account URL; profile edits sit beside order history. */
function accountPage(accountUrl: string, page: string) {
  return new URL(page, accountUrl.endsWith("/") ? accountUrl : `${accountUrl}/`).href;
}

/**
 * The header's account menu. Sign-in goes through Shopify and comes back to
 * this page; orders, tracking, returns and account details stay on Shopify's
 * own customer account pages. Pages stay cached: who is signed in is read
 * from a private endpoint after load.
 */
export function AccountMenu({ accountUrl }: { accountUrl: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [account, setAccount] = useState<MenuStatus>({ status: "loading" });
  const [signingOut, setSigningOut] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [switching, setSwitching] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  async function switchAccount() {
    setSwitching(true);
    try {
      const response = await fetch("/api/reviews/auth/switch", { method: "POST" });
      if (!response.ok) throw new Error("Switch failed");
      const { shopifyLogoutUrl } = (await response.json()) as { shopifyLogoutUrl: string | null };
      if (shopifyLogoutUrl) {
        try { sessionStorage.setItem(switchingKey, "1"); } catch { /* Without storage, the shopper signs in again by hand. */ }
        window.location.assign(shopifyLogoutUrl);
      } else {
        window.location.assign(reviewSignInUrl(pathname));
      }
    } catch {
      setSwitching(false);
      toast.error("Couldn't switch accounts. Please try again.", { id: "switch-account-failed" });
    }
  }

  useEffect(() => {
    let current = true;
    fetch("/api/account", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<CustomerAccountStatus>) : { status: "unavailable" as const }))
      .catch(() => ({ status: "unavailable" as const }))
      .then((status) => {
        if (!current) return;
        setAccount(status);
        // Back from Shopify's logout while switching: sign in again, now with no remembered account.
        if (takeSwitching() && status.status === "signed-out") window.location.assign(reviewSignInUrl(window.location.pathname));
        // Just back from signing in: say who, with an easy way out if Shopify remembered someone else.
        if (takeSignedInNotice() && status.status === "signed-in") {
          toast.custom((t) => (
            <span className="text-sm">
              Signed in as <span className="font-semibold">{status.email ?? "your store account"}</span>.{" "}
              <button type="button" className="rounded-sm underline decoration-current/50 underline-offset-2 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                onClick={() => { toast.dismiss(t.id); void switchAccount(); }}>Not you? Use a different account</button>
            </span>
          ), { id: "signed-in-as", duration: 10_000 });
        }
      });
    return () => { current = false; };
    // Runs once per page load; switchAccount only reads stable values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    setSigningOut(true);
    try {
      const response = await fetch("/api/reviews/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign-out failed");
      setAccount({ status: "signed-out" });
      startTransition(() => router.refresh());
    } catch {
      // The menu has closed by now, so say it where the shopper will see it.
      toast.error("Couldn't sign you out. Please try again.", { id: "sign-out-failed" });
    } finally {
      setSigningOut(false);
    }
  }

  const signedIn = account.status === "signed-in";
  if (!accountUrl && account.status !== "signed-in" && account.status !== "signed-out") return null;
  const label = signedIn ? `Account, signed in as ${account.email ?? "your store account"}` : "Account";

  return (
    <DropdownMenu as="div" className="relative">
      <Tooltip content={signedIn ? "Your account" : "Account"} placement="bottom">
        <DropdownMenuButton
          unstyled
          aria-label={label}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/15 bg-white/70 shadow-sm transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 dark:border-white/20 dark:bg-white/10 dark:hover:bg-white/15 dark:focus-visible:ring-white/40"
        >
          <FiUser aria-hidden className="text-base" />
          {/* Signed in is also said in the button's name; the dot is only a glanceable echo. */}
          {signedIn && <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-black" />}
        </DropdownMenuButton>
      </Tooltip>
      <DropdownMenuItems className="w-64">
        {signedIn && (
          <div className="px-3 pb-1 pt-2">
            <p className="text-xs text-black/70 dark:text-white/70">Signed in as</p>
            <p className="truncate text-sm font-semibold" title={account.email ?? undefined}>{account.email ?? "Your store account"}</p>
          </div>
        )}
        {account.status === "signed-out" && (
          <DropdownMenuItem onClick={() => setSignInOpen(true)}>
            <FiLogIn aria-hidden /> Sign in
          </DropdownMenuItem>
        )}
        {(signedIn || account.status === "signed-out") && accountUrl && <DropdownMenuSeparator />}
        {accountUrl && (
          <DropdownMenuItemLink href={accountUrl}>
            <FiPackage aria-hidden /> Your orders
          </DropdownMenuItemLink>
        )}
        {signedIn && accountUrl && (
          <DropdownMenuItemLink href={accountPage(accountUrl, "profile")}>
            <FiSettings aria-hidden /> Account details
          </DropdownMenuItemLink>
        )}
        {signedIn && account.reviews && (
          <DropdownMenuItemLink href="/reviews/mine">
            <FiMessageSquare aria-hidden /> My reviews
          </DropdownMenuItemLink>
        )}
        {signedIn && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={switching} onClick={() => void switchAccount()}>
              <FiRepeat aria-hidden /> {switching ? "Switching…" : "Use a different account"}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={signingOut || refreshing} onClick={() => void signOut()}>
              <FiLogOut aria-hidden /> {signingOut || refreshing ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuItems>
      <SignInDialog open={signInOpen} setOpen={setSignInOpen} returnTo={pathname} />
    </DropdownMenu>
  );
}
