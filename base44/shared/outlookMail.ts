const CONNECTOR_ID = "6aa1b165b701beec4f3cea09";

export async function enviarOutlook(base44, { to, subject, html }) {
  const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(CONNECTOR_ID);
  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "HTML", content: html },
        toRecipients: [{ emailAddress: { address: to } }],
      },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Graph ${res.status}: ${txt}`);
  }
  return true;
}