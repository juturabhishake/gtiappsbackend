import { PrismaClient } from "@prisma/client";
import Cors from 'cors';

const prisma = new PrismaClient();
const cors = Cors({ methods: ['POST'], origin: "*" });

function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) return reject(result);
            return resolve(result);
        });
    });
}

export default async function handler(req, res) {
    await runMiddleware(req, res, cors);

    if (req.method !== "POST") {
        return res.status(405).json({ message: `Method ${req.method} not allowed` });
    }

    try {
        const formData = req.body;
        const jsonPayload = JSON.stringify(formData);
        
        const result = await prisma.$queryRaw`EXEC SP_InsertCastingRejection @JsonPayload = ${jsonPayload}`;

        return res.status(200).json({ 
            message: "Rejection data submitted successfully.",
            TransactionId: result[0]?.TransactionId 
        });

    } catch (error) {
        console.error("API Error submitting rejection:", error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
}