import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      className="!z-[2147483647]"
      theme="system"
      position="bottom-right"
      visibleToasts={4}
      richColors
      closeButton={true}
    />
  );
}
