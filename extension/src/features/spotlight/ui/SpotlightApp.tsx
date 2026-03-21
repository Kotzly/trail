import { SpotlightRoot } from "./SpotlightRoot.js";

type SpotlightAppProps = {
  onRegisterToggle: (toggle: () => void) => void;
};

export function SpotlightApp(props: SpotlightAppProps) {
  return <SpotlightRoot {...props} />;
}
