import { useEffect, useRef, useState } from "react";
import dynamicLogo from "./assets/dynamic.svg";
import "./App.css";
import {
  DynamicWidget,
  useDynamicContext,
  useDynamicEvents,
  useMfa,
  useSyncMfaFlow,
} from "@dynamic-labs/sdk-react-core";
import {
  MfaBackupCodeAcknowledgement,
  MFADevice,
} from "@dynamic-labs/sdk-api-core";
import QRCode from "qrcode";

// Add prop type
interface AppProps {
  isMfaRequired: boolean;
}

function App({ isMfaRequired }: AppProps) {
  const { user, userWithMissingInfo } = useDynamicContext();

  return (
    <>
      <div>
        <a href="https://dynamic.xyz" target="_blank">
          <img src={dynamicLogo} className="logo" alt="Dynamic logo" />
        </a>
      </div>
      <h1>Dynamic Headless MFA</h1>
      <div className="card">
        <DynamicWidget />
        {(user || userWithMissingInfo) && (
          <MfaView isMfaRequired={isMfaRequired} />
        )}
      </div>
    </>
  );
}

function MfaView({ isMfaRequired }: AppProps) {
  const [devices, setDevices] = useState<MFADevice[]>([]);
  const [mfaRegisterData, setMfaRegisterData] = useState<{
    secret: string;
    uri: string;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const [backupCodesModalOpen, setBackupCodesModalOpen] = useState(false);
  const handleCopyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
  };

  const [intent, setIntent] = useState<{
    action: "delete" | "setup";
    deviceId?: string;
  } | null>(null);

  const [otp, setOtp] = useState("");

  const { userWithMissingInfo } = useDynamicContext();

  const [deleteOtpModalOpen, setDeleteOtpModalOpen] = useState(false);
  const [deleteOtp, setDeleteOtp] = useState("");

  const [addDeviceModalOpen, setAddDeviceModalOpen] = useState(false);

  const [verifyOtpModalOpen, setVerifyOtpModalOpen] = useState(false);
  const [verificationOtp, setVerificationOtp] = useState("");

  useSyncMfaFlow({
    handler: async () => {
      if (userWithMissingInfo?.scope?.includes("requiresAdditionalAuth")) {
        const devices = await getUserDevices();
        if (devices.length === 0) {
          const { uri, secret } = await addDevice();
          setMfaRegisterData({ secret, uri });
          setAddDeviceModalOpen(true);
        } else {
          setVerifyOtpModalOpen(true);
        }
      } else {
        getRecoveryCodes().then((codes) => {
          setBackupCodes(codes);
          setBackupCodesModalOpen(true);
        });
      }
    },
  });

  const {
    getUserDevices,
    authDevice,
    addDevice,
    getRecoveryCodes,
    completeAcknowledgement,
    deleteUserDevice,
  } = useMfa();

  useEffect(() => {
    getUserDevices().then((devices) => {
      setDevices(devices);
    });
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !mfaRegisterData) {
      return;
    }

    QRCode.toCanvas(canvasRef.current, mfaRegisterData.uri);
  }, [mfaRegisterData]);

  const handleAddDevice = async () => {
    const { uri, secret } = await addDevice();
    setMfaRegisterData({ secret, uri });
    setAddDeviceModalOpen(true);
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOtp(e.target.value);
  };

  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await authDevice(otp);
    setAddDeviceModalOpen(false);
    setOtp("");

    const devices = await getUserDevices();
    setDevices(devices);

    if (
      userWithMissingInfo?.mfaBackupCodeAcknowledgement ===
      MfaBackupCodeAcknowledgement.Pending
    ) {
      const codes = await getRecoveryCodes();
      setBackupCodes(codes);
      setBackupCodesModalOpen(true);
    }
  };

  const handleAcknowledgeBackupCodes = async () => {
    await completeAcknowledgement();
    const devices = await getUserDevices();
    setDevices(devices);
  };

  useDynamicEvents("mfaCompletionSuccess", async ({ mfaToken }) => {
    if (!intent || !mfaToken) return;

    if (intent.action === "delete") {
      await deleteUserDevice(intent.deviceId!, mfaToken);
      const updatedDevices = await getUserDevices();
      setDevices(updatedDevices);
    }

    setIntent(null);
  });

  const handleDeleteDevice = async (deviceId: string) => {
    // Prevent deletion if MFA is required and this is the last device
    if (isMfaRequired && devices.length <= 1) {
      return;
    }

    setIntent({ action: "delete", deviceId });
    setDeleteOtpModalOpen(true);
  };

  const handleDeleteOtpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await authDevice(deleteOtp);
    setDeleteOtpModalOpen(false);
    setDeleteOtp("");
  };

  const handleVerificationOtpSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    await authDevice(verificationOtp);
    setVerifyOtpModalOpen(false);
    setVerificationOtp("");
  };

  return (
    <>
      <div className="devices-section">
        <div className="devices-label">Devices</div>
        {devices.map((device) => (
          <div key={device.id} className="device-container">
            <button
              className="icon-button delete-button"
              onClick={() => handleDeleteDevice(device.id!)}
              title="Delete device"
              disabled={isMfaRequired && devices.length <= 1}
            >
              <TrashIcon />
            </button>
            <pre>{JSON.stringify(device, null, 2)}</pre>
          </div>
        ))}
      </div>
      {devices.length === 0 && (
        <button onClick={handleAddDevice}>Add Device</button>
      )}
      {addDeviceModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Add Authentication Device</h2>
            <p>
              {userWithMissingInfo?.scope?.includes("requiresAdditionalAuth")
                ? "MFA setup is required to proceed. "
                : ""}
              Scan the QR code with your authenticator app, then enter the code
              to verify.
            </p>
            <form className="mfa-form" onSubmit={handleVerifyOtp}>
              <canvas ref={canvasRef} />
              <div className="otp-input-container">
                <input
                  disabled={!mfaRegisterData}
                  placeholder="Enter OTP"
                  className="otp-input"
                  type="text"
                  name="otp"
                  value={otp}
                  onChange={handleOtpChange}
                />
              </div>
              <div className="modal-buttons">
                <button
                  type="button"
                  onClick={() => {
                    setAddDeviceModalOpen(false);
                    setMfaRegisterData(null);
                    setOtp("");
                  }}
                >
                  Cancel
                </button>
                <button disabled={!mfaRegisterData} type="submit">
                  Verify
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {userWithMissingInfo?.mfaBackupCodeAcknowledgement ===
        MfaBackupCodeAcknowledgement.Pending && (
        <button onClick={() => setBackupCodesModalOpen(true)}>
          View Backup Codes
        </button>
      )}
      {backupCodesModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Your Backup Codes</h2>
            <p>
              Store these codes in a safe place. Each code can only be used
              once.
            </p>
            <div className="backup-codes">
              {backupCodes.map((code, index) => (
                <div key={index} className="backup-code">
                  {code}
                </div>
              ))}
            </div>
            <div className="modal-buttons">
              <button onClick={handleCopyBackupCodes}>Copy Codes</button>
              <button
                onClick={() => {
                  handleAcknowledgeBackupCodes();
                  setBackupCodesModalOpen(false);
                }}
              >
                I've Saved These Codes
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteOtpModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Verify Device Deletion</h2>
            <p>
              Please enter the OTP from your authenticator app to confirm device
              deletion.
            </p>
            <form onSubmit={handleDeleteOtpSubmit}>
              <div className="otp-input-container">
                <input
                  type="text"
                  value={deleteOtp}
                  onChange={(e) => setDeleteOtp(e.target.value)}
                  placeholder="Enter OTP"
                  className="otp-input"
                />
              </div>
              <div className="modal-buttons">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteOtpModalOpen(false);
                    setIntent(null);
                    setDeleteOtp("");
                  }}
                >
                  Cancel
                </button>
                <button type="submit">Verify & Delete</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {verifyOtpModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Verify Your Identity</h2>
            <p>Please enter the OTP from your authenticator app to proceed.</p>
            <form onSubmit={handleVerificationOtpSubmit}>
              <div className="otp-input-container">
                <input
                  type="text"
                  value={verificationOtp}
                  onChange={(e) => setVerificationOtp(e.target.value)}
                  placeholder="Enter OTP"
                  className="otp-input"
                />
              </div>
              <div className="modal-buttons">
                <button
                  type="button"
                  onClick={() => {
                    setVerifyOtpModalOpen(false);
                    setVerificationOtp("");
                  }}
                >
                  Cancel
                </button>
                <button type="submit">Verify</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const TrashIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

export default App;
