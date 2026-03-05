import { useEffect, useState } from 'react';
import { SpotlightLegacyApp } from './SpotlightLegacyApp.js';
import { SpotlightV3App } from './SpotlightV3App.js';
import { getFlags } from './rpc.js';

type SpotlightAppProps = {
  onRegisterToggle: (toggle: () => void) => void;
};

export function SpotlightApp(props: SpotlightAppProps) {
  const [spotlightV3, setSpotlightV3] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getFlags()
      .then((flags) => {
        if (!cancelled) setSpotlightV3(Boolean(flags.spotlightV3));
      })
      .catch((error) => {
        console.error('Failed to load flags for spotlight:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return spotlightV3 ? <SpotlightV3App {...props} /> : <SpotlightLegacyApp {...props} />;
}
