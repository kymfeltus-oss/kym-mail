import twilio from "twilio";
import { getTwilioEnv, hasTwilioEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/logger";
import { liveReplyAlert } from "@/lib/mail/follow-up";

export async function sendLiveReplySms(_name: string, _company: string) {
  if (!hasTwilioEnv()) {
    log("warn", "mail.live_reply_sms_unconfigured", {});
    return false;
  }
  const env = getTwilioEnv();
  if (env.TWILIO_FROM_NUMBER === env.OWNER_ALERT_PHONE) {
    log("error", "mail.live_reply_sms_same_number", {});
    throw new AppError("CONFIGURATION", "The Twilio number and the alert phone must be different.");
  }
  try {
    const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      body: liveReplyAlert(),
      from: env.TWILIO_FROM_NUMBER,
      to: env.OWNER_ALERT_PHONE
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    log("error", "mail.live_reply_sms_failed", {});
    throw new AppError("PROVIDER_UNAVAILABLE", "The text alert could not be sent.");
  }
  log("info", "mail.live_reply_sms_sent", {});
  return true;
}
