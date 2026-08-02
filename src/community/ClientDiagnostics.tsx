import { useEffect } from "react";

import { reportClientError } from "./diagnosticsReporter";

export default function ClientDiagnostics() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      reportClientError(event.error || event.message, event.error ? "runtime" : "resource", {
        filename: event.filename?.slice(0, 300),
        line: event.lineno,
        column: event.colno,
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      reportClientError(event.reason, "promise");
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
