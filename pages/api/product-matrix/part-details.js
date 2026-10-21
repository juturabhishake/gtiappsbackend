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

    let partNo = typeof req.body?.partNo === "string" ? req.body.partNo.trim() : "";
    const postedTransId = typeof req.body?.transId === "string" ? req.body.transId.trim() : "";
    const transId = postedTransId || (partNo.includes("|") ? partNo : null);

    // The posted value may still be the full QR transId (partNo|serialNo) —
    // split it so only the real part number is used for the matrix lookup.
    if (partNo.includes("|")) {
        partNo = partNo.slice(0, partNo.lastIndexOf("|")).trim();
    }

    if (!partNo) {
        return res.status(400).json({ message: "A partNo is required." });
    }

    try {
        const rows = await prisma.$queryRaw`
            EXEC dbo.GetProductMatrixPartDetails
                @PartNo = ${partNo}
        `;

        if (!rows.length) {
            return res.status(404).json({ message: `No Product Matrix row found for part number ${partNo}.` });
        }

        const row = rows[0];
        const data = { ...row };

        // Always expose the Product Id in the GET response. Product_Id is the
        // canonical column returned by the ProductMatrix part lookup.
        if (data.Product_Id !== undefined && data.Product_Id !== null) {
            data.productId = data.Product_Id;
        }

        const serialNo = transId && transId.includes("|")
            ? transId.slice(transId.lastIndexOf("|") + 1).trim()
            : null;

        return res.status(200).json({
            data,
            productId: data.Product_Id,
            partNo,
            transId,
            serialNo,
        });
    } catch (error) {
        console.error("Failed to fetch Product Matrix part details:", error);
        return res.status(500).json({ message: "Unable to fetch Product Matrix part details." });
    }
}
