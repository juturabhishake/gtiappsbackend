import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req, res) {
    if (req.method !== "GET") {
        res.setHeader("Allow", ["GET"]);
        return res.status(405).json({ message: "Method not allowed" });
    }

    try {
        const parts = await prisma.$queryRaw`
            SELECT productId, partNo
            FROM dbo.GetProductMatrixPartNumbers()
            ORDER BY partNo, productId
        `;

        return res.status(200).json({ data: parts });
    } catch (error) {
        console.error("Failed to fetch ProductMatrix part numbers:", error);
        return res.status(500).json({ message: "Unable to fetch part numbers" });
    }
}
