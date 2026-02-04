import { Resend } from 'resend';

export interface SendMagicLinkEmailParams {
  to: string;
  magicLink: string;
}

export async function sendMagicLinkEmail({ to, magicLink }: SendMagicLinkEmailParams): Promise<void> {
  // If no API key is configured, log to console instead (development mode)
  if (!process.env.RESEND_API_KEY) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`[EMAIL] Magic Link (Development Mode)`);
    console.log(`[EMAIL] To: ${to}`);
    console.log(`[EMAIL] Link: ${magicLink}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    return;
  }

  // Initialize Resend client only when API key is available
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      from: 'RepCompanion <noreply@repcompanion.se>', // TODO: Update with your verified domain
      to,
      subject: 'Din inloggningslänk till RepCompanion',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Logga in till RepCompanion</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">RepCompanion</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Din träningskompanjon</p>
            </div>
            
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin-top: 0;">Logga in på RepCompanion</h2>
              <p style="color: #666; font-size: 16px;">Klicka på knappen nedan för att logga in. Länken är giltig i 15 minuter.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${magicLink}" 
                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 25px; font-weight: 600; font-size: 16px;">
                  Logga in nu
                </a>
              </div>
              
              <p style="color: #999; font-size: 14px; margin-top: 30px;">
                Om du inte begärde denna inloggning kan du ignorera detta mejl.
              </p>
              
              <p style="color: #999; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
                Fungerar inte knappen? Kopiera och klistra in denna länk i din webbläsare:<br>
                <span style="color: #667eea; word-break: break-all;">${magicLink}</span>
              </p>
            </div>
          </body>
        </html>
      `,
      text: `
Logga in på RepCompanion

Klicka på länken nedan för att logga in. Länken är giltig i 15 minuter.

${magicLink}

Om du inte begärde denna inloggning kan du ignorera detta mejl.
      `.trim(),
    });

    console.log(`[EMAIL] Magic link sent successfully to ${to}`);
  } catch (error) {
    console.error('[EMAIL] Failed to send magic link:', error);
    throw new Error('Failed to send email');
  }
}
