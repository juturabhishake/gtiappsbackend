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
    try {
        const result = await prisma.$queryRaw`
            select label,value from reject_options;
        `;

        if (result.length > 0) {
            return res.status(200).json({ message: "Data fetched successfully", data: result });
        } else {            
            return res.status(500).json({ message: "Failed to fetch data" });
        }
    } catch (error) {
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
}
