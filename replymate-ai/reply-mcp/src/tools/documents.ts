import { Request, Response } from "express";
import { z } from "zod";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import nodemailer from "nodemailer";

const toolSchema = z.object({
  reportType: z.enum(["pdf", "excel"]),
  recipientEmail: z.string().email(),
  subject: z.string(),
  bodyText: z.string(),
  data: z.any().describe("Markdown string for PDF, or JSON array of objects for Excel"),
});

export async function generateAndEmailReportTool(payload: any) {
  try {
    const params = toolSchema.parse(payload);

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      throw new Error("SMTP configuration is missing on the server.");
    }

    let attachmentBuffer: Buffer;
    let filename: string;
    let contentType: string;

    if (params.reportType === "pdf") {
      attachmentBuffer = await generatePdfBuffer(String(params.data));
      filename = `Report_${Date.now()}.pdf`;
      contentType = "application/pdf";
    } else {
      let excelData = params.data;

      // Try to parse if it's a string
      if (typeof excelData === "string") {
        // Strip markdown formatting if the LLM wrapped the JSON in backticks
        let cleanedString = excelData.trim();
        if (cleanedString.startsWith("```")) {
          const lines = cleanedString.split("\n");
          if (lines[0].startsWith("```")) lines.shift();
          if (lines[lines.length - 1].startsWith("```")) lines.pop();
          cleanedString = lines.join("\n").trim();
        }

        // Fix over-escaped quotes (e.g. LLM generated [{\"Country\":... instead of [{"Country":...)
        cleanedString = cleanedString.replace(/\\"/g, '"');
        
        try {
          excelData = JSON.parse(cleanedString);
        } catch (e) {
          throw new Error(`Could not parse Excel data string as JSON. Cleaned string: ${cleanedString.substring(0, 100)}...`);
        }
      }

      // If it's an object with a single array property (LLMs do this often)
      if (!Array.isArray(excelData) && typeof excelData === "object" && excelData !== null) {
        const values = Object.values(excelData);
        const arrayVal = values.find((v) => Array.isArray(v));
        if (arrayVal) {
          excelData = arrayVal;
        }
      }

      if (!Array.isArray(excelData)) {
        throw new Error(`Data must be a JSON array for Excel reports. Instead got: ${typeof excelData}`);
      }

      attachmentBuffer = await generateExcelBuffer(excelData);
      filename = `Report_${Date.now()}.xlsx`;
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }

    if (SMTP_HOST.includes("resend.com")) {
      // Render free tier blocks outbound SMTP ports, so we use Resend's REST API directly
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SMTP_PASS}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: process.env.SMTP_FROM || `"Tupu chat" <onboarding@resend.dev>`,
          to: [params.recipientEmail],
          subject: params.subject,
          text: params.bodyText,
          attachments: [
            {
              filename,
              content: attachmentBuffer.toString("base64")
            }
          ]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Resend API error: ${response.status} ${errText}`);
      }
    } else {
      // Fallback to nodemailer for other providers (may be blocked by Render)
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"Tupu chat" <onboarding@resend.dev>`,
        to: params.recipientEmail,
        subject: params.subject,
        text: params.bodyText,
        attachments: [{ filename, content: attachmentBuffer, contentType }],
      });
    }

    return { success: true, message: `Report generated and emailed to ${params.recipientEmail}` };
  } catch (error) {
    console.error("[generateAndEmailReportTool] Error:", error);
    throw error;
  }
}

async function generatePdfBuffer(markdownText: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      doc.fontSize(20).text("SP ONE AI Report", { align: "center" });
      doc.moveDown();

      // Simplistic markdown parsing for PDF
      const lines = markdownText.split("\n");
      for (const line of lines) {
        if (line.startsWith("# ")) {
          doc.fontSize(16).text(line.replace("# ", ""), { underline: true });
        } else if (line.startsWith("## ")) {
          doc.fontSize(14).text(line.replace("## ", ""));
        } else if (line.startsWith("- ")) {
          doc.fontSize(12).text(`• ${line.replace("- ", "")}`, { indent: 20 });
        } else if (line.trim() === "") {
          doc.moveDown();
        } else {
          doc.fontSize(12).text(line);
        }
        doc.moveDown(0.5);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function generateExcelBuffer(data: Record<string, any>[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");

  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    sheet.columns = headers.map((h) => ({ header: h.toUpperCase(), key: h, width: 20 }));
    sheet.addRows(data);
    sheet.getRow(1).font = { bold: true };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
