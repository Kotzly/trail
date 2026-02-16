import { Composition } from "remotion";
import { TrailDemo } from "./TrailDemo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="TrailDemo"
      component={TrailDemo}
      durationInFrames={1710}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
