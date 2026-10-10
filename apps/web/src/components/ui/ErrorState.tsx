import type { ReactNode } from "react";
import { ErrorToast } from "./ErrorToast";

/** A page whose data couldn't load: its still skeleton plus the "can't reach" toast with Retry. */
export function ErrorState({ skeleton }: { skeleton: ReactNode }) {
  return (
    <>
      {skeleton}
      <ErrorToast
        id="page-unavailable"
        title="Can't reach the chain data right now"
        description="Try again in a moment."
      />
    </>
  );
}
