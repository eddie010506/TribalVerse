import Mailjet from 'node-mailjet';

// Check if Mailjet keys are available
if (!process.env.MJ_APIKEY_PUBLIC || !process.env.MJ_APIKEY_PRIVATE) {
  console.warn('Warning: Mailjet API keys (MJ_APIKEY_PUBLIC and MJ_APIKEY_PRIVATE) environment variables are not set. Email functionality will not work.');
}

// Initialize Mailjet if API keys are available
let mailjet: Mailjet.Client | null = null;
if (process.env.MJ_APIKEY_PUBLIC && process.env.MJ_APIKEY_PRIVATE) {
  mailjet = Mailjet.apiConnect(
    process.env.MJ_APIKEY_PUBLIC,
    process.env.MJ_APIKEY_PRIVATE
  );
}

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Send an email using Mailjet
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!mailjet) {
    console.error('Cannot send email: Mailjet API keys are not set');
    return false;
  }

  try {
    const senderEmail = process.env.EMAIL_FROM || 'noreply@chatterbox.com';
    const senderName = 'ChatterBox';
    
    const request = await mailjet.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: senderEmail,
            Name: senderName
          },
          To: [
            {
              Email: options.to,
            }
          ],
          Subject: options.subject,
          TextPart: options.text,
          HTMLPart: options.html
        }
      ]
    });
    
    console.log(`Email sent to ${options.to}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

/**
 * Send a verification email to a user
 */
export async function sendVerificationEmail(email: string, username: string, token: string): Promise<boolean> {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  const verificationUrl = `${baseUrl}/api/verify-email?token=${token}`;
  
  const emailOptions: EmailOptions = {
    to: email,
    subject: 'Verify your email address - ChatterBox',
    text: `Hi ${username},\n\nPlease verify your email address by clicking the link below:\n\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nThank you,\nThe ChatterBox Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4a5568;">Verify your ChatterBox account</h2>
        <p>Hi ${username},</p>
        <p>Please verify your email address by clicking the button below:</p>
        <p style="margin: 20px 0;">
          <a href="${verificationUrl}" style="background-color: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a>
        </p>
        <p>Or copy and paste this link in your browser:</p>
        <p style="color: #718096; word-break: break-all;">
          ${verificationUrl}
        </p>
        <p>This link will expire in 24 hours.</p>
        <p>Thank you,<br>The ChatterBox Team</p>
      </div>
    `,
  };

  return sendEmail(emailOptions);
}