import { PrismaClient } from "@prisma/client";
import Cors from 'cors';

const prisma = new PrismaClient();

const cors = Cors({
    methods: ['POST', 'GET', 'HEAD'],
    origin: "*",
    allowedHeaders: ['Content-Type'],
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

export default async function handler(req, res) {
    await runMiddleware(req, res, cors);

    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).json({ message: "Method not allowed" });
    }

    const productId = Number(req.body?.productId);
    const partNo = typeof req.body?.partNo === "string" ? req.body.partNo.trim() : "";

    if (!Number.isInteger(productId) || productId <= 0 || !partNo) {
        return res.status(400).json({ message: "A valid productId and partNo are required." });
    }

    try {
        const rows = await prisma.$queryRaw`
            EXEC dbo.GetProductMatrixPartDetails
                @ProductId = ${productId},
                @PartNo = ${partNo}
        `;

        if (!rows.length) {
            return res.status(404).json({ message: `No Product Matrix row found for Product ID ${productId}.` });
        }

        return res.status(200).json({ data: rows[0] });
    } catch (error) {
        console.error("Failed to fetch Product Matrix part details:", error);
        return res.status(500).json({ message: "Unable to fetch Product Matrix part details." });
    }
}
