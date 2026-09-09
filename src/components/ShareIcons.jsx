import React from "react";
import { MessageCircle, Mail } from "lucide-react";

export default function ShareIcons({ title, signUrl }) {
  const body = `Assine o documento "${title}"${signUrl ? " em: " + signUrl : ""}`;
  const encoded = encodeURIComponent(body);
  const wa = `https://wa.me/?text=${encoded}`;
  const outlook = `https://outlook.office.com/mail/deeplink/compose?subject=${encodeURIComponent(
    "Documento para assinatura: " + title
  )}&body=${encoded}`;
  return (
    <div className="flex gap-1">
      <a
        href={wa}
        target="_blank"
        rel="noreferrer"
        className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-600 transition-colors"
        title="Enviar pelo WhatsApp"
        onClick={(e) => e.stopPropagation()}
      >
        <MessageCircle className="w-4 h-4" />
      </a>
      <a
        href={outlook}
        target="_blank"
        rel="noreferrer"
        className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 transition-colors"
        title="Enviar pelo Outlook"
        onClick={(e) => e.stopPropagation()}
      >
        <Mail className="w-4 h-4" />
      </a>
    </div>
  );
}