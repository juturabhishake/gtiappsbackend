import { PrismaClient } from "@prisma/client";
import Cors from "cors";

const prisma = new PrismaClient();

const cors = Cors({
    methods: ["GET", "POST", "OPTIONS"],
    origin: "*",
    allowedHeaders: ["Content-Type"],
    preflightContinue: true,
});

function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) return reject(result);
            return resolve(result);
        });
    });
}

function serializeSqlRow(row) {
    if (!row || typeof row !== "object") return row ?? null;
    return Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, typeof value === "bigint" ? value.toString() : value]),
    );
}

export default async function handler(req, res) {
    try {
        await runMiddleware(req, res, cors);

        if (req.method === "OPTIONS") {
            return res.status(204).end();
        }

        if (req.method !== "GET") {
            res.setHeader("Allow", ["GET"]);
            return res.status(405).json({ message: "Method not allowed" });
        }

        const transId = typeof req.query?.transId === "string" ? req.query.transId.trim() : "";

        if (!transId) {
            return res.status(400).json({ message: "A transId is required." });
        }

        const rows = await prisma.$queryRaw`
            EXEC dbo.Get_RejectionEntry
                @TransId = ${transId}
        `;

        if (!rows.length) {
            return res.status(404).json({ message: "No Rejection Entry found." });
        }

        return res.status(200).json({ data: serializeSqlRow(rows[0]) });
    } catch (error) {
        console.error("Failed to fetch rejection entry:", error);
        return res.status(500).json({ message: "Unable to fetch rejection entry." });
    }
}