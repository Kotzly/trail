"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Mail } from "lucide-react"
import { createSupabaseBrowserClient } from "@/src/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ""

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void
          prompt: () => void
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>,
          ) => void
        }
      }
    }
  }
}

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get("returnTo")

  const gisReady = useRef(false)
  const buttonRef = useRef<HTMLDivElement>(null)
  const credentialRef = useRef<
    (resp: { credential: string }) => Promise<void>
  >(null!)

  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [gisLoaded, setGisLoaded] = useState(false)

  // Google credential handler — kept in a ref so the GIS callback
  // always dispatches through the latest closure.
  credentialRef.current = async (response: { credential: string }) => {
    setError(null)
    setIsLoading(true)

    const supabase = createSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: response.credential,
    })

    if (authError) {
      setIsLoading(false)
      setError(authError.message)
      return
    }

    router.push(returnTo ?? "/trails")
  }

  useEffect(() => {
    if (gisReady.current) return
    gisReady.current = true

    const script = document.createElement("script")
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp: { credential: string }) =>
          credentialRef.current(resp),
        ux_mode: "popup",
      })
      setGisLoaded(true)
    }
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!gisLoaded || !buttonRef.current) return
    window.google?.accounts.id.renderButton(buttonRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "pill",
      width: 280,
    })
  }, [gisLoaded])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const supabase = createSupabaseBrowserClient()
    const redirectTo = new URL("/auth/callback", window.location.origin)
    if (returnTo) {
      redirectTo.searchParams.set("next", returnTo)
    }

    supabase.auth
      .signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo.toString() },
      })
      .then(({ error: otpError }) => {
        setIsLoading(false)
        if (otpError) {
          setError(otpError.message)
          return
        }
        setEmailSent(true)
      })
  }

  function resetEmail() {
    setEmail("")
    setEmailSent(false)
    setError(null)
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Sign in to Trail</CardTitle>
          <CardDescription>
            {emailSent
              ? "Check your inbox for the magic link"
              : "Enter your email to receive a sign-in link"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailSent ? (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-emerald-500/10 p-3">
                <Mail className="h-5 w-5 text-emerald-500" />
              </div>
              <CardDescription className="text-center">
                We sent a link to{" "}
                <span className="font-medium text-foreground">{email}</span>
              </CardDescription>
              <Button variant="ghost" size="sm" onClick={resetEmail}>
                Use a different email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !email.trim()}
                >
                  {isLoading ? "Sending…" : "Continue with Email"}
                </Button>
              </div>
              <div className="relative mt-6 text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                <span className="relative z-10 bg-card px-2 text-muted-foreground">
                  or
                </span>
              </div>
              <div className="mt-6 flex justify-center">
                <div
                  ref={buttonRef}
                  className={isLoading ? "pointer-events-none opacity-50" : ""}
                />
                {!gisLoaded && (
                  <div className="h-10 w-[280px] animate-pulse rounded-full bg-muted" />
                )}
              </div>
            </form>
          )}
          {error && (
            <CardDescription className="mt-4 text-center text-destructive">
              {error}
            </CardDescription>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
