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

    if (req.method === "POST") {
        const { partNumber, machineNumber, rejectReason, username ,isreject} = req.body;
         console.log("Request Body:", req.body);
        if (!username || !partNumber || !machineNumber) {
            return res.status(400).json({ message: "Username, part number, and machine number are required" });
        }

        try {
            const insertResult = await prisma.$queryRaw`
                EXEC Save_PartTrace ${partNumber}, ${machineNumber}, ${isreject}, ${rejectReason ?? 'Not rejected'}, ${username};
            `;

            if (insertResult) {
                return res.status(200).json({ message: "Inserted Successfully", data: insertResult });
            } else {
                return res.status(500).json({ message: "Failed to Store data" });
            }
        } catch (error) {
            return res.status(500).json({ message: "Internal Server Error", error: error.message });
        }
    } else {
        return res.status(405).json({ message: "Method not allowed" });
    }
}
