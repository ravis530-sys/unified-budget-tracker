import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.7";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface InviteRequest {
    email: string;
    inviteLink: string;
    householdName: string;
}

serve(async (req: Request) => {
    // Handle CORS preflight request
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { email, inviteLink, householdName }: InviteRequest = await req.json();

        if (!email || !inviteLink) {
            return new Response(
                JSON.stringify({ error: "Missing required fields" }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        const smtpHost = Deno.env.get("SMTP_HOST");
        const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
        const smtpUser = Deno.env.get("SMTP_USER");
        const smtpPass = Deno.env.get("SMTP_PASS");
        const clientId = Deno.env.get("SMTP_CLIENT_ID");
        const clientSecret = Deno.env.get("SMTP_CLIENT_SECRET");
        const refreshToken = Deno.env.get("SMTP_REFRESH_TOKEN");

        if (!smtpHost || !smtpUser) {
            console.error("Missing SMTP configuration (Host or User)");
            return new Response(
                JSON.stringify({ error: "Server misconfigured: Missing SMTP host or user" }),
                {
                    status: 500,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        let authConfig: any = {};

        // Check for OAuth2 credentials first
        if (clientId && clientSecret && refreshToken) {
            console.log("Using OAuth2 authentication");
            authConfig = {
                type: "OAuth2",
                user: smtpUser,
                clientId: clientId,
                clientSecret: clientSecret,
                refreshToken: refreshToken,
            };
        } else if (smtpPass) {
            // Fallback to Basic Auth (App Password)
            console.log("Using Basic Authentication");
            authConfig = {
                user: smtpUser,
                pass: smtpPass,
            };
        } else {
            console.error("Missing Auth configuration (Pass or OAuth tokens)");
            return new Response(
                JSON.stringify({ error: "Server misconfigured: Missing SMTP password or OAuth tokens" }),
                {
                    status: 500,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465, // true for 465, false for other ports
            auth: authConfig,
        });

        const mailOptions = {
            from: `"BudgetTrack" <${smtpUser}>`, // sender address
            to: email, // list of receivers
            subject: `Join ${householdName} on BudgetTrack`, // Subject line
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You've been invited!</h2>
          <p>You have been invited to join the <strong>${householdName}</strong> household on BudgetTrack.</p>
          <p>Click the button below to accept the invitation and start tracking finances together:</p>
          <div style="margin: 30px 0;">
            <a href="${inviteLink}" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Accept Invitation</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #666; font-size: 14px;">${inviteLink}</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
          <p style="color: #999; font-size: 12px;">This invitation will expire in 7 days.</p>
        </div>
      `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Message sent: %s", info.messageId);

        return new Response(
            JSON.stringify({ message: "Email sent successfully", messageId: info.messageId }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (error: any) {
        console.error("Error sending email:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
