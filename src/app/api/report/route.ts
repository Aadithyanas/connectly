import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { reporterName, reportedName, reason, description, reporterEmail } = await req.json();

    const { data, error } = await resend.emails.send({
      from: 'Connectly <onboarding@resend.dev>', // Use a verified domain or resend default for testing
      to: ['adithyanas2694@gmail.com'],
      subject: `🚨 NEW REPORT: ${reportedName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #f4f4f4; padding: 20px; border-radius: 10px;">
          <h2 style="color: #ea0038; border-bottom: 2px solid #ea0038; padding-bottom: 10px;">New Conduct Report</h2>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin-top: 20px; border: 1px solid #ddd;">
            <p><strong>Reported User:</strong> <span style="background-color: #fdf2f2; color: #ea0038; padding: 2px 6px; border-radius: 4px;">${reportedName}</span></p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p><strong>Description:</strong></p>
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; font-style: italic; color: #555; border-left: 4px solid #ea0038;">
              ${description || 'No additional details provided.'}
            </div>
          </div>

          <div style="margin-top: 20px; font-size: 0.9em; color: #666;">
            <p><strong>Reporter:</strong> ${reporterName} (${reporterEmail})</p>
            <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <div style="margin-top: 30px; text-align: center; font-size: 0.8em; color: #999;">
            This security notification was generated automatically by Connectly Safety Systems.
          </div>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
