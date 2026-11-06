import React, { useEffect, useState } from "react";
import { ariaAnnouncer, type AnnouncePayload } from "../accessibility/ariaAnnouncer";

export const AriaLiveRegion: React.FC = () => {
  const [politeAnnouncement, setPoliteAnnouncement] = useState<string>("");
  const [assertiveAnnouncement, setAssertiveAnnouncement] = useState<string>("");

  useEffect(() => {
    return ariaAnnouncer.subscribe((payload: AnnouncePayload) => {
      if (payload.priority === "assertive") {
        setAssertiveAnnouncement("");
        // Brief timeout ensures screen reader registers DOM node mutation
        setTimeout(() => setAssertiveAnnouncement(payload.message), 50);
      } else {
        setPoliteAnnouncement("");
        setTimeout(() => setPoliteAnnouncement(payload.message), 50);
      }
    });
  }, []);

  return (
    <div
      className="sr-only"
      style={{
        position: "absolute",
        width: "1px",
        height: "1px",
        padding: "0",
        margin: "-1px",
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        border: "0",
      }}
    >
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="aria-polite-region"
      >
        {politeAnnouncement}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        data-testid="aria-assertive-region"
      >
        {assertiveAnnouncement}
      </div>
    </div>
  );
};
