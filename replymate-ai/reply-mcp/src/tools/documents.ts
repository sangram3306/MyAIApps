import { Request, Response } from "express";
import { z } from "zod";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import nodemailer from "nodemailer";

const pdfSchema = z.object({
  markdownData: z.string().describe("The markdown string to render into the PDF"),
  recipientEmail: z.string().email().optional().describe("If the user explicitly asks to email the report, provide their email address."),
  subject: z.string().optional().describe("The subject of the email, if emailing"),
  bodyText: z.string().optional().describe("The body of the email, if emailing"),
});

const excelSchema = z.object({
  jsonData: z.any().describe("A VALID JSON array of objects representing rows and columns. Example: '[{\"Name\":\"Project A\"}]'. DO NOT abbreviate or truncate."),
  recipientEmail: z.string().email().optional().describe("If the user explicitly asks to email the report, provide their email address."),
  subject: z.string().optional().describe("The subject of the email, if emailing"),
  bodyText: z.string().optional().describe("The body of the email, if emailing"),
});

async function sendEmailHelper(recipientEmail: string, subject: string, bodyText: string, filename: string, buffer: Buffer, mimeType: string) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP configuration is missing on the server.");
  }
  
  if (SMTP_HOST.includes("resend.com")) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${SMTP_PASS}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.SMTP_FROM || `"Tupu chat" <onboarding@resend.dev>`,
        to: [recipientEmail],
        subject: subject || "Your Report",
        text: bodyText || "Please find your requested report attached.",
        attachments: [{ filename, content: buffer.toString("base64") }]
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Resend API error: ${response.status} ${errText}`);
    }
  } else {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Tupu chat" <onboarding@resend.dev>`,
      to: recipientEmail,
      subject: subject || "Your Report",
      text: bodyText || "Please find your requested report attached.",
      attachments: [{ filename, content: buffer, contentType: mimeType }],
    });
  }
}

export async function generatePdfTool(payload: any) {
  try {
    const params = pdfSchema.parse(payload);
    const buffer = await generatePdfBuffer(params.markdownData);
    const filename = `Report_${Date.now()}.pdf`;
    const mimeType = "application/pdf";
    
    if (params.recipientEmail) {
      await sendEmailHelper(params.recipientEmail, params.subject || "Your PDF Report", params.bodyText || "Here is your PDF report.", filename, buffer, mimeType);
    }
    
    return {
      filename,
      mimeType,
      base64: buffer.toString("base64"),
      emailedTo: params.recipientEmail || null
    };
  } catch (error) {
    console.error("[generatePdfTool] Error:", error);
    throw error;
  }
}

export async function generateExcelTool(payload: any) {
  try {
    const params = excelSchema.parse(payload);
    let excelData = params.jsonData;

    if (typeof excelData === "string") {
      let cleanedString = excelData.trim();
      if (cleanedString.startsWith("```")) {
        const lines = cleanedString.split("\n");
        if (lines[0].startsWith("```")) lines.shift();
        if (lines[lines.length - 1].startsWith("```")) lines.pop();
        cleanedString = lines.join("\n").trim();
      }
      cleanedString = cleanedString.replace(/\\"/g, '"');
      try {
        excelData = JSON.parse(cleanedString);
      } catch (e) {
        throw new Error(`Could not parse Excel data string as JSON. Cleaned string: ${cleanedString.substring(0, 100)}...`);
      }
    }

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

    const buffer = await generateExcelBuffer(excelData);
    const filename = `Data_${Date.now()}.xlsx`;
    const mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    
    if (params.recipientEmail) {
      await sendEmailHelper(params.recipientEmail, params.subject || "Your Excel Report", params.bodyText || "Here is your Excel report.", filename, buffer, mimeType);
    }
    
    return {
      filename,
      mimeType,
      base64: buffer.toString("base64"),
      emailedTo: params.recipientEmail || null
    };
  } catch (error) {
    console.error("[generateExcelTool] Error:", error);
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
