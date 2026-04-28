import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { i18n } from "#i18n";
import { TooltipProvider } from "@ui/components/ui/tooltip";
import { Toaster } from "@ui/components/ui/sonner";
import { Alert, AlertDescription } from "@ui/components/ui/alert";
import { Button } from "@ui/components/ui/button";
import { Icons } from "@ui/components/icons";
import { LoginForm } from "@ui/components/login-form";
import { SignUpForm } from "@ui/components/signup-form";
import TrailLogo from "@ui/components/trail-logo";
import { useLockFn } from "@ui/hooks/use-lock-fn";
import { useMount } from "@ui/hooks/use-mount";
import {
  cancelPasswordRecovery,
  initAuth,
  requestPasswordReset,
  resendSignupOtp,
  signInWithEmailPassword,
  signInWithGoogle,
  signUpWithEmailPassword,
  subscribeAuthState,
  updatePassword,
  validateEmail,
  validatePassword,
  verifyEmailOtp,
  type AuthState,
  type EmailOtpType,
} from "@shared/auth/auth-orchestrator.js";
import { isSupabaseConfigured } from "@shared/lib/supabase.js";
import { captureError } from "@shared/lib/observability.js";
import { VerifyForm } from "./VerifyForm.js";
import { SetPasswordForm } from "./SetPasswordForm.js";

type Stage =
  | { kind: "signin" }
  | { kind: "signup" }
  | { kind: "verify"; email: string; otpType: EmailOtpType }
  | { kind: "set-password"; email: string };

type StageKey = Stage["kind"] | "signed-in" | "unconfigured";

export default function LoginApp() {
  const [authState, setAuthState] = useState<AuthState>({ status: "signed-out" });
  const [stage, setStage] = useState<Stage>({ kind: "signin" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useMount(() => {
    let active = true;
    void initAuth().then((s) => {
      if (active) setAuthState(s);
    });
    const unsub = subscribeAuthState((next) => {
      if (active) setAuthState(next);
    });
    return () => {
      active = false;
      unsub();
    };
  });

  const closeTab = () => {
    chrome.tabs
      .getCurrent()
      .then((tab) => {
        if (tab?.id != null) return chrome.tabs.remove(tab.id);
        window.close();
      })
      .catch(() => window.close());
  };

  useEffect(() => {
    return () => {
      cancelPasswordRecovery();
    };
  }, []);

  function clearMessages() {
    setOtpError(undefined);
    setConfirmError(undefined);
    setFormError(null);
    setInfo(null);
  }

  async function withPending(fn: () => Promise<void>) {
    setPending(true);
    try {
      await fn();
    } finally {
      setPending(false);
    }
  }

  // ---- Sign-in ---------------------------------------------------------

  const handleSignIn = useLockFn(async () => {
    clearMessages();
    const eErr = validateEmail(email);
    if (eErr) return setFormError(eErr);
    if (!password) return setFormError(i18n.t("login.messages.passwordRequired"));
    await withPending(async () => {
      try {
        await signInWithEmailPassword(email, password);
      } catch (err) {
        captureError(err, { kind: "login_signin" });
        setFormError(err instanceof Error ? err.message : String(err));
      }
    });
  });

  // ---- Sign-up ---------------------------------------------------------

  const handleSignUp = useLockFn(async () => {
    clearMessages();
    const eErr = validateEmail(email);
    if (eErr) return setFormError(eErr);
    const pErr = validatePassword(password);
    if (pErr) return setFormError(pErr);
    await withPending(async () => {
      try {
        const result = await signUpWithEmailPassword(email, password);
        if (result.status === "awaiting-confirmation") {
          setStage({ kind: "verify", email: result.email, otpType: "signup" });
          setInfo(i18n.t("login.messages.signupOtpSent"));
        }
      } catch (err) {
        captureError(err, { kind: "login_signup" });
        setFormError(err instanceof Error ? err.message : String(err));
      }
    });
  });

  // ---- Google ----------------------------------------------------------

  const handleGoogle = useLockFn(async () => {
    clearMessages();
    await withPending(async () => {
      try {
        await signInWithGoogle();
      } catch (err) {
        captureError(err, { kind: "login_google" });
        setFormError(err instanceof Error ? err.message : String(err));
      }
    });
  });

  // ---- Forgot ----------------------------------------------------------

  const handleForgot = useLockFn(async () => {
    clearMessages();
    const eErr = validateEmail(email);
    if (eErr) return setFormError(eErr);
    await withPending(async () => {
      try {
        await requestPasswordReset(email);
        setStage({ kind: "verify", email, otpType: "recovery" });
        setInfo(i18n.t("login.messages.recoveryOtpSent"));
      } catch (err) {
        captureError(err, { kind: "login_forgot" });
        setFormError(err instanceof Error ? err.message : String(err));
      }
    });
  });

  // ---- Mode toggle -----------------------------------------------------

  function goToSignUp() {
    setStage({ kind: "signup" });
    setPassword("");
    clearMessages();
  }

  function goToSignIn() {
    setStage({ kind: "signin" });
    setPassword("");
    clearMessages();
  }

  // ---- Verify ----------------------------------------------------------

  const handleVerify = useLockFn(async () => {
    clearMessages();
    if (stage.kind !== "verify") return;
    if (!/^\d{6}$/.test(otp)) return setOtpError(i18n.t("login.messages.otpInvalidFormat"));
    await withPending(async () => {
      try {
        await verifyEmailOtp(stage.email, otp, stage.otpType);
        if (stage.otpType === "recovery") {
          setStage({ kind: "set-password", email: stage.email });
          setOtp("");
          setPassword("");
          setConfirmPassword("");
          setInfo(i18n.t("login.messages.recoveryCodeAccepted"));
        }
      } catch (err) {
        captureError(err, { kind: "login_verify" });
        setFormError(err instanceof Error ? err.message : String(err));
      }
    });
  });

  const handleResend = useLockFn(async () => {
    if (stage.kind !== "verify") return;
    clearMessages();
    await withPending(async () => {
      try {
        if (stage.otpType === "signup") await resendSignupOtp(stage.email);
        else if (stage.otpType === "recovery") await requestPasswordReset(stage.email);
        setInfo(i18n.t("login.messages.codeResent"));
      } catch (err) {
        captureError(err, { kind: "login_resend" });
        setFormError(err instanceof Error ? err.message : String(err));
      }
    });
  });

  function handleChangeEmail() {
    if (stage.kind === "verify" && stage.otpType === "recovery") cancelPasswordRecovery();
    setStage({ kind: "signin" });
    setOtp("");
    clearMessages();
  }

  // ---- Set password ----------------------------------------------------

  const handleSetPassword = useLockFn(async () => {
    clearMessages();
    if (stage.kind !== "set-password") return;
    const pErr = validatePassword(password);
    if (pErr) return setFormError(pErr);
    if (password !== confirmPassword)
      return setConfirmError(i18n.t("login.messages.passwordsMismatch"));
    await withPending(async () => {
      try {
        await updatePassword(password);
      } catch (err) {
        captureError(err, { kind: "login_set_password" });
        setFormError(err instanceof Error ? err.message : String(err));
      }
    });
  });

  // ---- Stage resolution -----------------------------------------------

  const stageKey: StageKey =
    !isSupabaseConfigured() || authState.status === "unconfigured"
      ? "unconfigured"
      : authState.status === "signed-in"
        ? "signed-in"
        : stage.kind;

  const signedInName =
    authState.status === "signed-in"
      ? (authState.identity.displayName ??
        authState.identity.email ??
        i18n.t("login.headline.signedInFallbackName"))
      : i18n.t("login.headline.signedInFallbackName");

  const eyebrow = (() => {
    switch (stageKey) {
      case "signin":
        return i18n.t("login.eyebrow.signIn");
      case "signup":
        return i18n.t("login.eyebrow.signUp");
      case "verify":
        return i18n.t("login.eyebrow.verify");
      case "set-password":
        return i18n.t("login.eyebrow.setPassword");
      case "signed-in":
        return i18n.t("login.eyebrow.signedIn");
      case "unconfigured":
        return i18n.t("login.eyebrow.unconfigured");
    }
  })();

  const headline = (() => {
    switch (stageKey) {
      case "signin":
        return i18n.t("login.headline.signIn");
      case "signup":
        return i18n.t("login.headline.signUp");
      case "verify":
        return i18n.t("login.headline.verify");
      case "set-password":
        return i18n.t("login.headline.setPassword");
      case "signed-in":
        return i18n.t("login.headline.signedIn", [signedInName]);
      case "unconfigured":
        return i18n.t("login.headline.unconfigured");
    }
  })();

  const subhead = (() => {
    switch (stageKey) {
      case "signin":
        return i18n.t("login.subhead.signIn");
      case "signup":
        return i18n.t("login.subhead.signUp");
      case "verify":
        return i18n.t("login.subhead.verify", [stage.kind === "verify" ? stage.email : ""]);
      case "set-password":
        return i18n.t("login.subhead.setPassword", [
          stage.kind === "set-password" ? stage.email : "",
        ]);
      case "signed-in":
        return i18n.t("login.subhead.signedIn");
      case "unconfigured":
        return i18n.t("login.subhead.unconfigured");
    }
  })();

  // ---- Render ----------------------------------------------------------

  const reduce = useReducedMotion();
  const stageTransition = reduce
    ? { duration: 0 }
    : { duration: 0.18, ease: [0.23, 1, 0.32, 1] as const };
  const stageVariants = reduce
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -4 },
      };

  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={150}>
      <Toaster />
      <h1 className="sr-only">{headline}</h1>
      <div className="login-surface bg-background text-foreground relative min-h-dvh">
        <main className="mx-auto grid w-full max-w-6xl gap-12 px-6 pt-16 pb-16 md:px-10 md:pt-24 lg:grid-cols-[1.05fr_1fr] lg:gap-20 lg:px-14 lg:pt-28 lg:pb-24">
          <section className="flex flex-col items-start gap-10 lg:gap-14">
            <div className="flex items-center gap-3">
              <TrailLogo animated variant="field" className="size-12" label="Trail" />
              <span className="font-serif text-2xl tracking-tight">Trail</span>
            </div>
            <div className="flex flex-col gap-5">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`hero-${stageKey}`}
                  variants={stageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={stageTransition}
                  className="flex flex-col gap-5"
                >
                  <span
                    className="font-mono text-[11px] tracking-[0.18em] uppercase"
                    style={{ color: "var(--trail-ember)" }}
                  >
                    {eyebrow}
                  </span>
                  <h2 className="font-serif text-4xl leading-[1.05] font-normal tracking-tight md:text-5xl">
                    {headline}
                  </h2>
                  <p className="text-muted-foreground max-w-prose text-base leading-relaxed">
                    {subhead}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </section>

          <section className="flex w-full flex-col items-stretch lg:max-w-md lg:justify-self-end">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={stageKey}
                variants={stageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={stageTransition}
                className="flex w-full flex-col gap-4"
              >
                {renderStage()}
              </motion.div>
            </AnimatePresence>
          </section>
        </main>
      </div>
    </TooltipProvider>
  );

  function renderStage() {
    if (stageKey === "signed-in") {
      return (
        <div className="flex flex-col gap-4">
          <Button onClick={closeTab} className="press-feedback w-full sm:w-auto">
            {i18n.t("login.actions.done")}
          </Button>
        </div>
      );
    }

    if (stageKey === "unconfigured") {
      return null;
    }

    if (stage.kind === "verify") {
      return (
        <>
          <VerifyForm
            otp={otp}
            pending={pending}
            otpError={otpError}
            onOtpChange={setOtp}
            onSubmit={handleVerify}
            onResend={handleResend}
            onChangeEmail={handleChangeEmail}
          />
          <Banners formError={formError} info={info} />
        </>
      );
    }

    if (stage.kind === "set-password") {
      return (
        <>
          <SetPasswordForm
            password={password}
            confirmPassword={confirmPassword}
            pending={pending}
            confirmError={confirmError}
            onPasswordChange={setPassword}
            onConfirmChange={setConfirmPassword}
            onSubmit={handleSetPassword}
          />
          <Banners formError={formError} info={info} />
        </>
      );
    }

    if (stage.kind === "signup") {
      return (
        <>
          <SignUpForm
            email={email}
            password={password}
            pending={pending}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onSubmit={handleSignUp}
            onGoogle={handleGoogle}
            onSignIn={goToSignIn}
          />
          <Banners formError={formError} info={info} />
        </>
      );
    }

    return (
      <>
        <LoginForm
          email={email}
          password={password}
          pending={pending}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onSubmit={handleSignIn}
          onGoogle={handleGoogle}
          onForgot={handleForgot}
          onSignUp={goToSignUp}
        />
        <Banners formError={formError} info={info} />
      </>
    );
  }
}

function Banners({ formError, info }: { formError: string | null; info: string | null }) {
  if (formError) {
    return (
      <Alert
        variant="destructive"
        className="animate-in fade-in-0 slide-in-from-top-1 duration-(--dur-base) ease-(--ease-out)"
      >
        <Icons.AlertTriangle aria-hidden />
        <AlertDescription>{formError}</AlertDescription>
      </Alert>
    );
  }
  if (info) {
    return (
      <Alert className="animate-in fade-in-0 slide-in-from-top-1 duration-(--dur-base) ease-(--ease-out)">
        <Icons.Info aria-hidden />
        <AlertDescription>{info}</AlertDescription>
      </Alert>
    );
  }
  return null;
}
