import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Mail, Loader2, CheckCircle2, Unlink } from "lucide-react";

const CONNECTOR_ID = "6aa1b165b701beec4f3cea09";

export default function OutlookConnect() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [profile, setProfile] = useState(null);

  const fetchStatus = async () => {
    try {
      const res = await base44.functions.invoke("statusOutlook", {});
      setConnected(!!res.data.connected);
      setProfile(res.data.profile || null);
    } catch {
      setConnected(false);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleConnect = async () => {
    const url = await base44.connectors.connectAppUser(CONNECTOR_ID);
    const popup = window.open(url, "_blank");
    const timer = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(timer);
        fetchStatus();
      }
    }, 500);
  };

  const handleDisconnect = async () => {
    await base44.connectors.disconnectAppUser(CONNECTOR_ID);
    setConnected(false);
    setProfile(null);
  };

  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;

  if (connected) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
        <CheckCircle2 className="w-4 h-4" />
        <span className="font-medium truncate max-w-[180px]">Outlook: {profile?.email || "conectado"}</span>
        <button onClick={handleDisconnect} className="ml-1 hover:text-emerald-900" title="Desconectar Outlook">
          <Unlink className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button onClick={handleConnect} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700">
      <Mail className="w-4 h-4" /> Conectar Outlook
    </button>
  );
}