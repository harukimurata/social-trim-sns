import { atom } from "jotai";

export type AvatarState = {
  initial: string;
  displayUrl: string;
};

export const avatarAtom = atom<AvatarState>({ initial: "?", displayUrl: "" });
