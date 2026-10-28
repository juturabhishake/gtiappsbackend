import { PrismaClient } from "@prisma/client";
import Cors from 'cors';

const prisma = new PrismaClient();
const cors = Cors({ methods: ['POST', 'HEAD'], origin: "*" });

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
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: `Method ${req.method} not allowed` });
    }

    try {
        const formData = req.body;
        console.log("Received form data:", formData);
        const jsonPayload = JSON.stringify(formData);
        
        await prisma.$executeRaw`EXEC SP_InsertMachineRejection @JsonPayload = ${jsonPayload}`;

        return res.status(200).json({ message: "Rejection data submitted successfully." });

    } catch (error) {
        console.error("API Error submitting rejection:", error);

        const errorMessage = error.message.includes('unique constraint')
            ? "A record with this combination already exists."
            : "An unexpected error occurred while submitting the data.";

        return res.status(500).json({ message: "Internal Server Error", error: errorMessage });
    }
}