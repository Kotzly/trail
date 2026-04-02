"use client"

import { useState, type FormEvent } from "react"
import { useSearchParams } from "next/navigation"
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

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const searchParams = useSearchParams()
  const returnTo = searchParams.get("returnTo")

  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  function buildCallbackUrl(next?: string | null) {
    const callbackUrl = new URL("/auth/callback", window.location.origin)
    if (next) callbackUrl.searchParams.set("next", next)
    return callbackUrl.toString()
  }

  async function handleGoogleSignIn() {
    setError(null)
    setIsLoading(true)

    const supabase = createSupabaseBrowserClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: buildCallbackUrl(returnTo),
      },
    })

    if (oauthError) {
      setIsLoading(false)
      setError(oauthError.message)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const supabase = createSupabaseBrowserClient()
    supabase.auth
      .signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: buildCallbackUrl(returnTo) },
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
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isLoading}
                  onClick={handleGoogleSignIn}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continue with Google
                </Button>
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
