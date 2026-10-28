import { PrismaClient } from "@prisma/client";
import cors, { runMiddleware } from "../../../lib/cors";

const prisma = new PrismaClient();

export default async function handler(req, res) {
    await runMiddleware(req, res, cors);

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: `Method ${req.method} not allowed` });
    }
    
    const { productId, date, shift } = req.body;

    if (!productId || !date) {
        return res.status(400).json({ message: "Product ID and Date are required." });
    }

    try {
        const result = await prisma.$queryRaw`
            exec sp_getUsedRejectionQty @ProductId = ${productId}, @RejectionDate = ${date}, @ShiftName = ${shift}
        `;

        const usedQty = result.length > 0 ? result[0].usedQty : 0;
        return res.status(200).json({ usedQty });

    } catch (error) {
        console.error("API Error getting used quantity:", error);
        return res.status(500).json({ message: "Failed to retrieve used quantity", error: error.message });
    }
}