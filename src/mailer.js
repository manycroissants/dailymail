// src/mailer.js — Sends the HTML digest via Resend API
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendDailyBrief(htmlContent) {
  const dateStr = new Date().toLocaleDateString("en-SG", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Singapore",
  });

  console.log("\n📬 Sending email via Resend...");

  const result = await resend.emails.send({
    from: "Daily Brief <onboarding@resend.dev>",
    to: ["chanzeming@hotmail.com"],
    subject: `📰 Your Daily Intelligence Brief — ${dateStr}`,
    html: htmlContent,
  });

  if (result.error) {
    throw new Error(`Resend error: ${JSON.stringify(result.error)}`);
  }

  console.log(`  ✓ Email sent! ID: ${result.data?.id}`);
  return { success: true, id: result.data?.id };
}

module.exports = { sendDailyBrief };
