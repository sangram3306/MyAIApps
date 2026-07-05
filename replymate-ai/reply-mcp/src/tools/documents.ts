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

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    let attachmentBuffer: Buffer;
    let filename: string;
    let contentType: string;

    if (params.reportType === "pdf") {
      attachmentBuffer = await generatePdfBuffer(String(params.data));
      filename = `Report_${Date.now()}.pdf`;
      contentType = "application/pdf";
    } else {
      if (!Array.isArray(params.data)) {
        throw new Error("Data must be a JSON array for Excel reports.");
      }
      attachmentBuffer = await generateExcelBuffer(params.data);
      filename = `Report_${Date.now()}.xlsx`;
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Tupu chat" <${SMTP_USER}>`,
      to: params.recipientEmail,
      subject: params.subject,
      text: params.bodyText,
      attachments: [
        {
          filename,
          content: attachmentBuffer,
          contentType,
        },
      ],
    });

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
