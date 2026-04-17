import { useEffect } from "react";
import { createEffectWithTarget } from "@ui/lib/create-effect-with-target";

export const useEffectWithTarget = createEffectWithTarget(useEffect);
