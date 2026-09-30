const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

/**
 * Sends a push notification via OneSignal API.
 * @param {string} heading - The title of the notification
 * @param {string} content - The body of the notification
 * @param {string[]} [externalIds] - Array of external user IDs to send to. If omitted, sends to all.
 */
async function sendNotification(heading, content, externalIds = []) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    console.warn("OneSignal credentials missing in .env, notification not sent.");
    return;
  }

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    contents: { en: content, tr: content },
    headings: { en: heading, tr: heading },
  };

  // If specific users are targeted by their employee/user ID (external_id in OneSignal)
  if (externalIds && externalIds.length > 0) {
    payload.include_aliases = { external_id: externalIds };
    payload.target_channel = "push";
  } else {
    // Otherwise broadcast to all subscribers
    payload.included_segments = ["All"];
  }

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("OneSignal API Error:", errorData);
    } else {
      const data = await response.json();
      console.log("OneSignal Notification sent successfully:", data);
    }
  } catch (error) {
    console.error("Failed to send OneSignal Notification:", error);
  }
}

module.exports = {
  sendNotification
};
