import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      theme="system"
      position="bottom-right"
      visibleToasts={4}
      richColors
      closeButton={false}
    />
  );
}
