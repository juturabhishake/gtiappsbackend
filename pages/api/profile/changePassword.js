import { PrismaClient } from "@prisma/client";
import Cors from "cors";

const prisma = new PrismaClient();

const cors = Cors({
  methods: ["POST"],
  origin: "*",
  allowedHeaders: ["Content-Type"],
  credentials: true,
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

function encodePasswordToBase64(password) {
  try {
    const encDataByte = new TextEncoder().encode(password);
    const encodedData = btoa(String.fromCharCode(...encDataByte));
    return encodedData;
  } catch (ex) {
    throw new Error("Base64 Encode Error: " + ex.message);
  }
}

export default async function handler(req, res) {
  await runMiddleware(req, res, cors);

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { employeeId, currentPassword, newPassword, confirmPassword } = req.body;

  if (!employeeId || !currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const encodedCurrent = encodePasswordToBase64(currentPassword);
  const encodedNew = encodePasswordToBase64(newPassword);
  const encodedConfirm = encodePasswordToBase64(confirmPassword);

  try {
    const result = await prisma.$queryRaw`
      DECLARE @output_message NVARCHAR(255);
      EXEC SP_Update_Employee_Password ${employeeId}, ${encodedCurrent}, ${encodedNew}, ${encodedConfirm}, @output_message OUTPUT;
      SELECT @output_message as message;
    `;

    const msg = result[0]?.message || "Unknown error";

    if (msg === "Password changed successfully") {
      return res.status(200).json({ success: true, message: msg });
    } else {
      return res.status(400).json({ success: false, message: msg });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
