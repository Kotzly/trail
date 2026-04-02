"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resetOnboarding } from "./mutations";

export function ResetOnboardingButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleReset = () => {
    startTransition(async () => {
      const result = await resetOnboarding();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Onboarding reset — you'll see it on next login");
        router.refresh();
      }
    });
  };

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleReset}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <RotateCcw className="h-4 w-4 mr-2" />
      )}
      Reset onboarding
    </Button>
  );
}
