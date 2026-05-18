import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { i18n } from "#i18n";
import { TooltipProvider } from "@ui/components/ui/tooltip";
import { Toaster } from "@ui/components/ui/sonner";
import { Alert, AlertDescription } from "@ui/components/ui/alert";
import { Button } from "@ui/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@ui/components/ui/empty";
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
  signInWithGitHub,
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
    if (!password) return setFormError(i18n.t("login.passwordRequired"));
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
          setInfo(i18n.t("login.signupOtpSent"));
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

  // ---- GitHub ----------------------------------------------------------

  const handleGithub = useLockFn(async () => {
    clearMessages();
    await withPending(async () => {
      try {
        await signInWithGitHub();
      } catch (err) {
        captureError(err, { kind: "login_github" });
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
        setInfo(i18n.t("login.recoveryOtpSent"));
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
    if (!/^\d{6}$/.test(otp)) return setOtpError(i18n.t("login.otpInvalidFormat"));
    await withPending(async () => {
      try {
        await verifyEmailOtp(stage.email, otp, stage.otpType);
        if (stage.otpType === "recovery") {
          setStage({ kind: "set-password", email: stage.email });
          setOtp("");
          setPassword("");
          setConfirmPassword("");
          setInfo(i18n.t("login.recoveryCodeAccepted"));
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
        setInfo(i18n.t("login.codeResent"));
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
    if (password !== confirmPassword) return setConfirmError(i18n.t("login.passwordsMismatch"));
    await withPending(async () => {
      try {
        await updatePassword(password);
      } catch (err) {
        captureError(err, { kind: "login_set_password" });
        setFormError(err instanceof Error ? err.message : String(err));
      }
    });
  });

  // ---- Render ----------------------------------------------------------

  const reduce = useReducedMotion();
  const stageTransition = reduce
    ? { duration: 0 }
    : { duration: 0.2, ease: [0.23, 1, 0.32, 1] as const };
  const stageVariants = reduce
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, x: 12 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -8 },
      };

  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={150}>
      <Toaster />
      <div className="bg-muted text-foreground flex min-h-[100dvh] items-center justify-center p-6 md:p-10">
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
          <div className="flex items-center gap-3">
            <TrailLogo animated variant="field" className="size-8" />
            <span className="text-2xl tracking-tight">Trail</span>
          </div>
          <div className="flex w-full flex-col gap-4">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={stage.kind}
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
          </div>
        </div>
      </div>
    </TooltipProvider>
  );

  function renderStage() {
    if (authState.status === "signed-in") {
      const name =
        authState.identity.displayName ??
        authState.identity.email ??
        i18n.t("login.signedInFallbackName");
      return (
        <Empty>
          <EmptyHeader>
            <EmptyMedia
              variant="icon"
              className="size-12 rounded-full [&_svg:not([class*='size-'])]:size-6"
            >
              <Icons.Check aria-hidden />
            </EmptyMedia>
            <EmptyTitle className="text-lg">{i18n.t("login.signedInTitle", [name])}</EmptyTitle>
            <EmptyDescription>{i18n.t("login.signedInDescription")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={closeTab}>{i18n.t("login.done")}</Button>
          </EmptyContent>
        </Empty>
      );
    }

    if (!isSupabaseConfigured() || authState.status === "unconfigured") {
      return (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icons.CloudOff aria-hidden />
            </EmptyMedia>
            <EmptyTitle className="text-lg">{i18n.t("login.cloudUnconfiguredTitle")}</EmptyTitle>
            <EmptyDescription>{i18n.t("login.cloudUnconfiguredDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    if (stage.kind === "verify") {
      return (
        <>
          <VerifyForm
            email={stage.email}
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
            email={stage.email}
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
            onGithub={handleGithub}
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
          onGithub={handleGithub}
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
