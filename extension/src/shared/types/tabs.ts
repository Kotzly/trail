export type TabSoundState = {
  muted?: boolean;
  audible?: boolean;
};

export type TabState = {
  sound: TabSoundState;
};
