import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";

export function Root() {
  const [isMfaRequired, setIsMfaRequired] = useState(() => {
    const saved = localStorage.getItem("isMfaRequired");
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem("isMfaRequired", JSON.stringify(isMfaRequired));
  }, [isMfaRequired]);

  const environmentId = isMfaRequired
    ? "010daf81-2140-4c94-90c8-ead91415ddc4" // MFA Required
    : "0bf11235-acc3-4be5-87e5-b57fad85c136"; // MFA Optional

  return (
    <StrictMode>
      <div className="env-toggle">
        <button
          onClick={() => setIsMfaRequired(!isMfaRequired)}
          className={isMfaRequired ? "active" : ""}
        >
          {isMfaRequired ? "MFA Required" : "MFA Optional"}
        </button>
      </div>
      <DynamicContextProvider
        settings={{
          environmentId,
          walletConnectors: [EthereumWalletConnectors],
        }}
      >
        <App isMfaRequired={isMfaRequired} />
      </DynamicContextProvider>
    </StrictMode>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
