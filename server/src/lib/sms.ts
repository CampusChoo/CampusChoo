const ARKESEL_URL = 'https://sms.arkesel.com/api/v2/sms/send';
const SENDER = 'CampusChoo';

export async function sendSms(to: string, message: string): Promise<void> {
  const apiKey = process.env.ARKESEL_API_KEY;
  if (!apiKey) {
    console.warn('[SMS] ARKESEL_API_KEY not set — skipping.');
    return;
  }

  try {
    const res = await fetch(ARKESEL_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: SENDER, message, recipients: [to] }),
    });
    if (!res.ok) console.error('[SMS] Send failed:', await res.text());
  } catch (err) {
    console.error('[SMS] Network error:', err);
  }
}

// ─── Message templates ────────────────────────────────────────────────────────

export const smsTemplates = {
  orderPlacedBuyer: (orderId: string, vendorName: string) =>
    `Hi! Your CampusChoo order ${orderId} from ${vendorName} has been placed. We'll text you when it's on its way. 🍱`,

  orderPlacedVendor: (orderId: string, itemsSummary: string, location: string) =>
    `📦 New order ${orderId} on CampusChoo!\nItems: ${itemsSummary}\nDeliver to: ${location}\nOpen your portal to confirm.`,

  orderDelivered: (orderId: string) =>
    `✅ Your CampusChoo order ${orderId} has been delivered! Enjoy your meal. Rate your experience in the app.`,
};
